import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import ModelTrainingExtractionAudit from '#models/model_training_extraction_audit'
import ModelTrainingEligibilityService, {
  MODEL_TRAINING_EXCLUSION_POLICY_VERSION,
  ModelTrainingEligibilityError,
} from '#services/model_training_eligibility_service'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test.group('model-training extraction attempt lifecycle', (group) => {
  group.setup(async () => {
    const cleanup = await testUtils.db().truncate()
    await db.from('envoy_schema.user_consent_preferences').update({ model_training_opt_in: false })
    await db.from('envoy_schema.model_training_extraction_audits').delete()
    return cleanup
  })

  test('retries failed attempts with increasing attempt numbers and blocks completed jobs', async () => {
    const jobIdentifier = `lifecycle-failed-${uuidv4()}`

    await assert.rejects(
      ModelTrainingEligibilityService.runExtraction(
        { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
        async () => {
          throw new Error('simulated retryable extraction failure')
        }
      ),
      /simulated retryable extraction failure/
    )

    const failed = await ModelTrainingExtractionAudit.query()
      .where('job_identifier', jobIdentifier)
      .firstOrFail()
    assert.equal(failed.attemptNumber, 1)
    assert.equal(failed.status, 'FAILED')
    assert.ok(failed.finishedAt)
    assert.equal(failed.leaseExpiresAt, null)

    const retry = await ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => 'retry completed'
    )
    assert.equal(retry.result, 'retry completed')
    assert.equal(retry.audit.attemptNumber, 2)
    assert.equal(retry.audit.status, 'COMPLETED')
    assert.ok(retry.audit.finishedAt)
    assert.equal(retry.audit.leaseExpiresAt, null)

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

    const attempts = await ModelTrainingExtractionAudit.query()
      .where('job_identifier', jobIdentifier)
      .orderBy('attempt_number')
    assert.deepEqual(
      attempts.map(({ attemptNumber, status }) => ({ attemptNumber, status })),
      [
        { attemptNumber: 1, status: 'FAILED' },
        { attemptNumber: 2, status: 'COMPLETED' },
      ]
    )
  })

  test('blocks a duplicate while an attempt has a live lease', async () => {
    const jobIdentifier = `lifecycle-live-${uuidv4()}`
    const enteredCallback = deferred()
    const releaseCallback = deferred()
    const firstRun = ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => {
        enteredCallback.resolve()
        await releaseCallback.promise
        return 'first completed'
      }
    )

    await enteredCallback.promise
    try {
      const liveAudit = await ModelTrainingExtractionAudit.findByOrFail(
        'jobIdentifier',
        jobIdentifier
      )
      assert.equal(liveAudit.status, 'STARTED')
      assert.ok(liveAudit.leaseExpiresAt)
      assert.equal(liveAudit.finishedAt, null)

      let duplicateCallbackRan = false
      await assert.rejects(
        ModelTrainingEligibilityService.runExtraction(
          { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
          async () => {
            duplicateCallbackRan = true
          }
        ),
        (error: unknown) =>
          error instanceof ModelTrainingEligibilityError && /live attempt/.test(error.message)
      )
      assert.equal(duplicateCallbackRan, false)
    } finally {
      releaseCallback.resolve()
    }

    const completed = await firstRun
    assert.equal(completed.result, 'first completed')
    assert.equal(completed.audit.status, 'COMPLETED')
    assert.equal(completed.audit.leaseExpiresAt, null)
  })

  test('publicly reconciles expired attempts and permits a numbered retry', async () => {
    const jobIdentifier = `lifecycle-public-reconcile-${uuidv4()}`
    const now = DateTime.utc()
    const staleAudit = await ModelTrainingExtractionAudit.create({
      jobIdentifier,
      attemptNumber: 1,
      extractedAt: now.minus({ minutes: 10 }),
      requestedCategories: ['PRODUCT_FEEDBACK'],
      eligibleUserCount: 0,
      exclusionPolicyVersion: MODEL_TRAINING_EXCLUSION_POLICY_VERSION,
      status: 'STARTED',
      finishedAt: null,
      leaseExpiresAt: now.minus({ minutes: 5 }),
    })

    assert.equal(await ModelTrainingEligibilityService.reconcileStaleAttempts(now), 1)
    await staleAudit.refresh()
    assert.equal(staleAudit.status, 'ABANDONED')
    assert.ok(staleAudit.finishedAt)
    assert.equal(staleAudit.leaseExpiresAt, null)

    const retry = await ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => null
    )
    assert.equal(retry.audit.attemptNumber, 2)
    assert.equal(retry.audit.status, 'COMPLETED')
  })

  test('globally abandons stale work and prevents its former worker from completing', async () => {
    const staleJobIdentifier = `lifecycle-global-stale-${uuidv4()}`
    const unrelatedJobIdentifier = `lifecycle-global-trigger-${uuidv4()}`
    const enteredCallback = deferred()
    const releaseCallback = deferred()
    const staleRun = ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier: staleJobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => {
        enteredCallback.resolve()
        await releaseCallback.promise
        return 'obsolete worker result'
      }
    )

    await enteredCallback.promise
    const staleAudit = await ModelTrainingExtractionAudit.findByOrFail(
      'jobIdentifier',
      staleJobIdentifier
    )
    await db
      .from('envoy_schema.model_training_extraction_audits')
      .where('uuid', staleAudit.uuid)
      .update({ lease_expires_at: DateTime.utc().minus({ minutes: 1 }).toJSDate() })

    const unrelatedRun = await ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier: unrelatedJobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => null
    )
    assert.equal(unrelatedRun.audit.status, 'COMPLETED')

    await staleAudit.refresh()
    assert.equal(staleAudit.status, 'ABANDONED')
    assert.equal(staleAudit.leaseExpiresAt, null)
    assert.ok(staleAudit.finishedAt)

    const rejectedCompletion = assert.rejects(
      staleRun,
      (error: unknown) =>
        error instanceof ModelTrainingEligibilityError &&
        /lost its active lease/.test(error.message)
    )
    releaseCallback.resolve()
    await rejectedCompletion

    await staleAudit.refresh()
    assert.equal(staleAudit.status, 'ABANDONED')

    const retry = await ModelTrainingEligibilityService.runExtraction(
      { jobIdentifier: staleJobIdentifier, categories: ['PRODUCT_FEEDBACK'] },
      async () => 'replacement worker result'
    )
    assert.equal(retry.result, 'replacement worker result')
    assert.equal(retry.audit.attemptNumber, 2)
    assert.equal(retry.audit.status, 'COMPLETED')
  })
})
