import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import ModelTrainingExtractionAudit from '#models/model_training_extraction_audit'
import ModelTrainingExtractionUserSnapshot from '#models/model_training_extraction_user_snapshot'
import Project from '#models/project'
import ProjectPrompt from '#models/project_prompt'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import UserInboxConnection from '#models/user_inbox_connection'
import { ModelTrainingDeidentificationApprovalRequiredError } from '#services/model_training_deidentification_service'
import ModelTrainingEligibilityService, {
  ModelTrainingEligibilityError,
} from '#services/model_training_eligibility_service'
import UserConsentService from '#services/user_consent_service'

async function createConsumer(label: string) {
  const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
  return User.create({
    fullName: `${label} Consumer`,
    email: `training-${label.toLowerCase()}-${uuidv4()}@example.com`,
    password: 'Password123!',
    entitlementId: entitlement.id,
    isActive: true,
  })
}

async function createHistoricalProject(user: User, title: string, description?: string) {
  return Project.create({
    title,
    description: description ?? `${title} historical eligible project input`,
    userUuid: user.uuid,
    isActive: true,
  })
}

test.group('model-training extraction eligibility', (group) => {
  group.setup(async () => {
    const cleanup = await testUtils.db().truncate()
    // Other functional fixtures may have opted-in users in a developer database. This suite owns
    // its extraction snapshot, so make the pre-existing baseline fail closed.
    await db.from('envoy_schema.user_consent_preferences').update({ model_training_opt_in: false })
    await db.from('envoy_schema.model_training_extraction_audits').delete()
    return cleanup
  })

  test('fails closed, preserves historical eligibility, and quarantines unrestricted content', async () => {
    const optedIn = await createConsumer('opted-in')
    const optedOut = await createConsumer('opted-out')
    const missingPreference = await createConsumer('missing')
    const embeddedSecret = `embedded-secret-${uuidv4()}`
    const unlabeledApiKey = `sk-proj-${uuidv4().replaceAll('-', '')}`
    const optedInProject = await createHistoricalProject(
      optedIn,
      'Eligible history',
      `${optedIn.fullName} can be reached at ${optedIn.email}, (804) 555-0199, or 123 Main Street from 203.0.113.8. password=${embeddedSecret}; card 4111 1111 1111 1111.`
    )
    const optedInSecondProject = await createHistoricalProject(optedIn, 'Eligible second history')
    optedInProject.location = { address: '456 Private Avenue' }
    optedInProject.description = `${optedInProject.description} Record ${optedInProject.uuid}; ${unlabeledApiKey}; SSN 123-45-6789; contact: Jane Example. Jane Doe at 2001:db8::1 or +44 20 7946 0958.`
    await optedInProject.save()
    await ProjectPrompt.create({
      projectUuid: optedInProject.uuid,
      agentType: 'PLANNING',
      data: {
        'summary': `Contact ${optedIn.email} and use token=${embeddedSecret}`,
        'accessToken': embeddedSecret,
        [optedIn.email]: 'direct identifier used as a JSON key',
        'Jane Example': 'third-party name used as a JSON key',
        'phone': 8045550199,
        'ssn': 123456789,
        'ip': 2130706433,
        'projectUuid': optedInProject.uuid,
        'safeProjectTitle': 'Mobile App Redesign',
      },
      createdByUserUuid: optedIn.uuid,
      modifiedByUserUuid: optedIn.uuid,
    })
    await createHistoricalProject(optedOut, 'Excluded opt-out history')
    await createHistoricalProject(missingPreference, 'Excluded missing history')

    // The project predates the choice. Current opt-in still makes that history eligible.
    await UserConsentService.completeOnboarding({
      userUuid: optedIn.uuid,
      termsAccepted: true,
      modelTrainingOptIn: true,
    })
    await UserConsentService.completeOnboarding({
      userUuid: optedOut.uuid,
      termsAccepted: true,
      modelTrainingOptIn: false,
    })

    assert.equal(await ModelTrainingEligibilityService.isUserEligible(optedIn.uuid), true)
    assert.equal(await ModelTrainingEligibilityService.isUserEligible(optedOut.uuid), false)
    assert.equal(
      await ModelTrainingEligibilityService.isUserEligible(missingPreference.uuid),
      false
    )

    // A raw opted-in value cannot bypass the database evidence constraint.
    await assert.rejects(
      db.from('envoy_schema.user_consent_preferences').where('user_uuid', optedOut.uuid).update({
        model_training_opt_in: true,
        model_training_notice_version: null,
        model_training_preference_updated_at: null,
      }),
      /user_consent_preferences_training_metadata_check/
    )
    assert.equal(await ModelTrainingEligibilityService.isUserEligible(optedOut.uuid), false)

    const mailboxSecret = `mailbox-secret-${uuidv4()}`
    await UserInboxConnection.create({
      userUuid: optedIn.uuid,
      provider: 'gmail',
      email: optedIn.email,
      accessToken: mailboxSecret,
      refreshToken: `refresh-${mailboxSecret}`,
      accessTokenExpiresAt: null,
      scopes: 'openid gmail.readonly gmail.send',
      status: 'active',
      isPrimary: true,
      providerUserId: `provider-${uuidv4()}`,
      tokenEncryptionVersion: 'plaintext_legacy',
      watchStatus: 'not_configured',
    })

    const firstJob = `training-export-${uuidv4()}`
    let callbackReceivedRecords = false
    await assert.rejects(
      ModelTrainingEligibilityService.runExtraction(
        {
          jobIdentifier: firstJob,
          categories: ['PROJECT_INPUTS', 'ENVOY_GENERATED_OUTPUTS'],
        },
        async (scope) => {
          assert.deepEqual(Object.keys(scope).sort(), ['extractedAt', 'readRecords'])
          await assert.rejects(
            scope.readRecords('CONNECTED_MAILBOX_DATA' as never),
            (error: unknown) =>
              error instanceof ModelTrainingEligibilityError && /not eligible/.test(error.message)
          )

          const records = await scope.readRecords('PROJECT_INPUTS')
          callbackReceivedRecords = records.length > 0
          return records
        }
      ),
      (error: unknown) =>
        error instanceof ModelTrainingDeidentificationApprovalRequiredError &&
        error.code === 'MODEL_TRAINING_DEIDENTIFICATION_APPROVAL_REQUIRED' &&
        !error.message.includes(optedIn.email) &&
        !error.message.includes('Jane Doe') &&
        !error.message.includes('+44 20 7946 0958')
    )
    assert.equal(callbackReceivedRecords, false)

    const firstAudit = await ModelTrainingExtractionAudit.findByOrFail('jobIdentifier', firstJob)
    assert.equal(firstAudit.jobIdentifier, firstJob)
    assert.equal(firstAudit.eligibleUserCount, 1)
    assert.equal(firstAudit.status, 'FAILED')
    assert.ok(firstAudit.finishedAt)
    assert.ok(firstAudit.finishedAt >= firstAudit.extractedAt)
    assert.deepEqual(firstAudit.requestedCategories, ['PROJECT_INPUTS', 'ENVOY_GENERATED_OUTPUTS'])
    const firstSnapshot = await ModelTrainingExtractionUserSnapshot.findByOrFail(
      'extractionAuditUuid',
      firstAudit.uuid
    )
    assert.equal(firstSnapshot.userUuid, optedIn.uuid)
    assert.equal(firstSnapshot.modelTrainingOptIn, true)

    const eligibleHistoricalRows = await db
      .from('envoy_schema.model_training_project_inputs')
      .where('owner_user_uuid', optedIn.uuid)
      .select('record_uuid')
    assert.deepEqual(
      eligibleHistoricalRows.map((row) => row.record_uuid).sort(),
      [optedInProject.uuid, optedInSecondProject.uuid].sort()
    )

    await UserConsentService.updateModelTrainingPreference({
      userUuid: optedIn.uuid,
      modelTrainingOptIn: false,
    })
    const afterOptOut = await ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier: `training-export-${uuidv4()}`, categories: ['PROJECT_INPUTS'] },
      async (scope) => scope.readRecords('PROJECT_INPUTS')
    )
    assert.deepEqual(afterOptOut.result, [])
    assert.equal(await ModelTrainingEligibilityService.isUserEligible(optedIn.uuid), false)

    await UserConsentService.updateModelTrainingPreference({
      userUuid: optedIn.uuid,
      modelTrainingOptIn: true,
    })
    const eligibleAgainRows = await db
      .from('envoy_schema.model_training_project_inputs')
      .where('owner_user_uuid', optedIn.uuid)
      .select('record_uuid')
    assert.deepEqual(
      eligibleAgainRows.map((row) => row.record_uuid).sort(),
      [optedInProject.uuid, optedInSecondProject.uuid].sort()
    )
    assert.equal(await ModelTrainingEligibilityService.isUserEligible(optedIn.uuid), true)
    assert.equal(
      await ModelTrainingExtractionAudit.query()
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      2
    )

    await optedInProject.delete()
    await optedInSecondProject.delete()
    await optedIn.delete()
    assert.equal(await ModelTrainingExtractionUserSnapshot.findBy('userUuid', optedIn.uuid), null)
    assert.ok(await ModelTrainingExtractionAudit.findBy('uuid', firstAudit.uuid))
  })

  test('retains failed audit evidence and its committed consent snapshot', async () => {
    const user = await createConsumer('failed-extraction')
    const project = await createHistoricalProject(user, 'Failed extraction evidence')
    await UserConsentService.completeOnboarding({
      userUuid: user.uuid,
      termsAccepted: true,
      modelTrainingOptIn: true,
    })

    const jobIdentifier = `training-export-failed-${uuidv4()}`
    await assert.rejects(
      ModelTrainingEligibilityService.runExtraction(
        { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
        async (scope) => {
          const records = await scope.readRecords('PRODUCT_FEEDBACK')
          assert.deepEqual(records, [])
          throw new Error('simulated extraction callback failure')
        }
      ),
      /simulated extraction callback failure/
    )

    const audit = await ModelTrainingExtractionAudit.findByOrFail('jobIdentifier', jobIdentifier)
    assert.equal(audit.status, 'FAILED')
    assert.ok(audit.finishedAt)
    assert.ok(audit.finishedAt >= audit.extractedAt)
    assert.equal(audit.eligibleUserCount, 1)

    const snapshot = await ModelTrainingExtractionUserSnapshot.query()
      .where('extraction_audit_uuid', audit.uuid)
      .where('user_uuid', user.uuid)
      .firstOrFail()
    assert.equal(snapshot.modelTrainingOptIn, true)

    await project.delete()
    await user.delete()
  })

  test('rejects excluded source categories and duplicate job identifiers', async () => {
    let excludedCategoryCallbackRan = false
    await assert.rejects(
      ModelTrainingEligibilityService.runExtraction(
        {
          jobIdentifier: `training-export-${uuidv4()}`,
          categories: ['CONNECTED_MAILBOX_DATA' as never],
        },
        async () => {
          excludedCategoryCallbackRan = true
        }
      ),
      (error: unknown) =>
        error instanceof ModelTrainingEligibilityError && /not eligible/.test(error.message)
    )
    assert.equal(excludedCategoryCallbackRan, false)

    const jobIdentifier = `training-export-${uuidv4()}`
    await ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => null
    )
    let duplicateCallbackRan = false
    await assert.rejects(
      ModelTrainingEligibilityService.runExtraction(
        { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
        async () => {
          duplicateCallbackRan = true
        }
      ),
      (error: unknown) =>
        error instanceof ModelTrainingEligibilityError &&
        /already been recorded/.test(error.message)
    )
    assert.equal(duplicateCallbackRan, false)
  })

  test('approved source views never reference excluded mailbox or identity tables', async () => {
    const definitions = await db
      .from('information_schema.views')
      .where('table_schema', 'envoy_schema')
      .whereIn('table_name', [
        'model_training_project_inputs',
        'model_training_prompts_and_chats',
        'model_training_generated_outputs',
        'model_training_product_feedback',
        'model_training_deidentified_product_signals',
      ])
      .select('table_name', 'view_definition')

    assert.equal(definitions.length, 5)
    for (const definition of definitions) {
      assert.doesNotMatch(
        definition.view_definition,
        /\b(users|user_inbox_connections|messages|communications|vendor_conversations)\b/i,
        definition.table_name
      )
    }
  })
})
