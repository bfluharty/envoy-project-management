import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import Project from '#models/project'
import {
  ACCOUNT_MODEL_TRAINING_DISCLOSURE_TEXT,
  MODEL_TRAINING_DISCLOSURE_TEXT,
} from '#constants/user_consent'

const PREFERENCES_TABLE = 'envoy_schema.user_consent_preferences'
const EVENTS_TABLE = 'envoy_schema.user_consent_events'
const EXPECTED_ONBOARDING_TRAINING_DISCLOSURE =
  'Allow Envoy to use eligible content I submit to improve and train Envoy models. This is optional, does not affect access to Envoy, and can be changed later in Account Settings. When enabled, eligible historical and future Envoy-native data may be used. Connected Google or Microsoft mailbox data is always excluded. Turning this off stops new training-data extractions but may not reverse training that has already completed.'

async function createConsumer(label: string) {
  const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')

  return User.create({
    fullName: `${label} Consumer`,
    email: `consent-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${uuidv4()}@example.com`,
    password: 'Password123!',
    entitlementId: entitlement.id,
    isActive: true,
  })
}

async function preferenceFor(user: User) {
  return db.from(PREFERENCES_TABLE).where('user_uuid', user.uuid).first()
}

async function eventsFor(user: User) {
  return db
    .from(EVENTS_TABLE)
    .where('user_uuid', user.uuid)
    .orderBy('created_timestamp', 'asc')
    .orderBy('id', 'asc')
}

async function renderConsentPage(client: any, user: User) {
  const response = await client.get('/onboarding/consent').loginAs(user).withInertia()
  response.assertOk()
  response.assertBodyContains({ component: 'onboarding/consent' })

  const props = response.body().props
  assert.equal(typeof props.termsVersion, 'string')
  assert.ok(props.termsVersion.length > 0)
  assert.equal(typeof props.privacyPolicyVersion, 'string')
  assert.ok(props.privacyPolicyVersion.length > 0)
  assert.equal(typeof props.modelTrainingNoticeVersion, 'string')
  assert.ok(props.modelTrainingNoticeVersion.length > 0)

  return props as {
    termsVersion: string
    privacyPolicyVersion: string
    modelTrainingNoticeVersion: string
  }
}

async function completeConsent(
  client: any,
  user: User,
  modelTrainingOptIn: boolean,
  session?: Record<string, unknown>
) {
  let request = client
    .post('/onboarding/consent')
    .loginAs(user)
    .header('user-agent', 'envoy-consent-functional-test')
    .json({ termsAccepted: true, modelTrainingOptIn })
    .redirects(0)

  if (session) {
    request = request.withSession(session)
  }

  return request
}

test.group('onboarding consent', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('requires authentication', async ({ client }) => {
    const response = await client
      .get('/onboarding/consent')
      .header('accept', 'text/html')
      .redirects(0)

    response.assertFound()
    response.assertHeader('location', '/login')
  })

  test('renders the legal and training notice versions for an unaccepted user', async ({
    client,
  }) => {
    const user = await createConsumer('render')

    await Project.create({
      title: 'Must remain gated',
      description: 'This product data must not be serialized into the consent page.',
      userUuid: user.uuid,
      isActive: true,
    })

    const props = await renderConsentPage(client, user)
    assert.deepEqual((props as Record<string, unknown>).projects, [])
  })

  test('rejects missing or false Terms acceptance without mutating consent state', async ({
    client,
  }) => {
    const user = await createConsumer('required-terms')

    const falseResponse = await client
      .post('/onboarding/consent')
      .loginAs(user)
      .json({ termsAccepted: false, modelTrainingOptIn: true })
    falseResponse.assertStatus(422)

    const missingResponse = await client
      .post('/onboarding/consent')
      .loginAs(user)
      .json({ modelTrainingOptIn: true })
    missingResponse.assertStatus(422)

    const preference = await preferenceFor(user)
    assert.ok(!preference || preference.terms_accepted === false)
    const events = await eventsFor(user)
    assert.equal(events.length, 0)
  })

  test('rejects consent writes from a foreign browser origin', async ({ client }) => {
    const user = await createConsumer('cross-origin')

    const response = await client
      .post('/onboarding/consent')
      .loginAs(user)
      .header('origin', 'https://attacker.example')
      .json({ termsAccepted: true, modelTrainingOptIn: true })

    response.assertStatus(403)
    response.assertBodyContains({ code: 'INVALID_REQUEST_ORIGIN' })
    const preference = await preferenceFor(user)
    const events = await eventsFor(user)
    assert.ok(!preference || preference.terms_accepted === false)
    assert.equal(events.length, 0)
  })

  test('accepts an explicit model-training opt-out and stores auditable events', async ({
    client,
  }) => {
    const user = await createConsumer('opt-out')
    const versions = await renderConsentPage(client, user)

    const response = await completeConsent(client, user, false)
    response.assertFound()
    response.assertHeader('location', '/dashboard')

    const preference = await preferenceFor(user)
    assert.ok(preference)
    assert.equal(preference.terms_accepted, true)
    assert.equal(preference.terms_version, versions.termsVersion)
    assert.ok(preference.terms_accepted_at)
    assert.equal(preference.privacy_policy_version, versions.privacyPolicyVersion)
    assert.ok(preference.privacy_policy_acknowledged_at)
    assert.equal(preference.model_training_opt_in, false)
    assert.equal(preference.model_training_notice_version, versions.modelTrainingNoticeVersion)
    assert.ok(preference.model_training_preference_updated_at)
    assert.equal(preference.created_by_user_uuid, user.uuid)
    assert.equal(preference.modified_by_user_uuid, user.uuid)

    const events = await eventsFor(user)
    assert.deepEqual(events.map((event) => event.event_type).sort(), [
      'MODEL_TRAINING_OPTED_OUT',
      'PRIVACY_POLICY_ACKNOWLEDGED',
      'TERMS_ACCEPTED',
    ])
    for (const event of events) {
      assert.equal(event.actor_user_uuid, user.uuid)
      assert.equal(event.source, 'ONBOARDING')
      assert.equal(event.user_agent, 'envoy-consent-functional-test')
      assert.equal(typeof event.disclosure_text, 'string')
      assert.ok(event.disclosure_text.length > 0)
      assert.ok(event.created_timestamp)
    }

    const trainingEvent = events.find((event) => event.event_type === 'MODEL_TRAINING_OPTED_OUT')
    assert.ok(trainingEvent)
    assert.equal(trainingEvent.model_training_opt_in, false)
    assert.equal(trainingEvent.model_training_notice_version, versions.modelTrainingNoticeVersion)
    assert.equal(MODEL_TRAINING_DISCLOSURE_TEXT, EXPECTED_ONBOARDING_TRAINING_DISCLOSURE)
    assert.equal(trainingEvent.disclosure_text, EXPECTED_ONBOARDING_TRAINING_DISCLOSURE)
  })

  test('accepts model-training opt-in and exposes all eligible history through current state', async ({
    client,
  }) => {
    const user = await createConsumer('opt-in')

    const response = await completeConsent(client, user, true)
    response.assertFound()

    const preference = await preferenceFor(user)
    assert.equal(preference?.terms_accepted, true)
    assert.equal(preference?.model_training_opt_in, true)

    const events = await eventsFor(user)
    const trainingEvent = events.find((event) => event.event_type === 'MODEL_TRAINING_OPTED_IN')
    assert.ok(trainingEvent)
    assert.equal(trainingEvent.model_training_opt_in, true)
  })

  test('is idempotent when onboarding completion is submitted more than once', async ({
    client,
  }) => {
    const user = await createConsumer('idempotent')

    const firstResponse = await completeConsent(client, user, true)
    firstResponse.assertFound()
    const firstEvents = await eventsFor(user)
    assert.equal(firstEvents.length, 3)

    const secondResponse = await completeConsent(client, user, true)
    secondResponse.assertFound()

    const secondEvents = await eventsFor(user)
    assert.equal(secondEvents.length, 3)
    assert.deepEqual(
      secondEvents.map((event) => event.uuid),
      firstEvents.map((event) => event.uuid)
    )
  })

  test('redirects an already accepted user without requiring a newer Terms version', async ({
    client,
  }) => {
    const user = await createConsumer('accepted')
    await completeConsent(client, user, false)
    await db.from(PREFERENCES_TABLE).where('user_uuid', user.uuid).update({
      terms_version: 'historical-terms-version',
    })

    const consentResponse = await client.get('/onboarding/consent').loginAs(user).redirects(0)
    consentResponse.assertFound()
    consentResponse.assertHeader('location', '/dashboard')

    const dashboardResponse = await client.get('/dashboard').loginAs(user).withInertia()
    dashboardResponse.assertOk()
  })
})

test.group('consent-required middleware', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('gates browser navigation and preserves a safe local destination', async ({ client }) => {
    const user = await createConsumer('browser-gate')

    const gatedResponse = await client
      .get('/account')
      .loginAs(user)
      .header('accept', 'text/html')
      .redirects(0)
    gatedResponse.assertFound()
    gatedResponse.assertHeader('location', '/onboarding/consent')

    const completionResponse = await completeConsent(client, user, false, gatedResponse.session())
    completionResponse.assertFound()
    completionResponse.assertHeader('location', '/account')
  })

  test('returns a stable 428 response for authenticated API requests', async ({ client }) => {
    const user = await createConsumer('api-gate')

    const response = await client.get('/api/projects').loginAs(user)

    response.assertStatus(428)
    response.assertBodyContains({
      code: 'CONSENT_REQUIRED',
      consentUrl: '/onboarding/consent',
    })
  })

  test('returns 428 for explicit JSON page requests without overwriting a browser destination', async ({
    client,
  }) => {
    const user = await createConsumer('json-gate')

    const browserResponse = await client
      .get('/account')
      .loginAs(user)
      .header('accept', 'text/html')
      .redirects(0)
    browserResponse.assertFound()

    const jsonResponse = await client
      .get('/dashboard')
      .loginAs(user)
      .withSession(browserResponse.session())
      .header('accept', 'application/json')
    jsonResponse.assertStatus(428)
    jsonResponse.assertBodyContains({ code: 'CONSENT_REQUIRED' })

    const completionResponse = await completeConsent(client, user, false, jsonResponse.session())
    completionResponse.assertFound()
    completionResponse.assertHeader('location', '/account')
  })

  test('treats a missing preference row as opted out and allows accepted users through', async ({
    client,
  }) => {
    const missingPreferenceUser = await createConsumer('missing-preference')
    assert.equal(await preferenceFor(missingPreferenceUser), null)

    const blockedResponse = await client
      .get('/dashboard')
      .loginAs(missingPreferenceUser)
      .header('accept', 'text/html')
      .redirects(0)
    blockedResponse.assertFound()
    blockedResponse.assertHeader('location', '/onboarding/consent')

    const acceptedUser = await createConsumer('allowed')
    await completeConsent(client, acceptedUser, false)
    const allowedResponse = await client.get('/dashboard').loginAs(acceptedUser).withInertia()
    allowedResponse.assertOk()
  })

  test('does not gate legal pages, consent completion, or logout', async ({ client }) => {
    const user = await createConsumer('exemptions')

    const termsResponse = await client.get('/terms').withInertia()
    termsResponse.assertOk()
    const privacyResponse = await client.get('/privacy').withInertia()
    privacyResponse.assertOk()
    const consentResponse = await client.get('/onboarding/consent').loginAs(user).withInertia()
    consentResponse.assertOk()

    const logoutResponse = await client
      .post('/logout')
      .loginAs(user)
      .withSession({
        auth: {
          intended_url: '/account',
          post_consent_return_path: '/projects/project-1',
        },
        onboarding: { token: uuidv4() },
      })
      .redirects(0)
    logoutResponse.assertFound()
    logoutResponse.assertHeader('location', '/')
    assert.equal(logoutResponse.session().auth?.intended_url, undefined)
    assert.equal(logoutResponse.session().auth?.post_consent_return_path, undefined)
    assert.equal(logoutResponse.session().onboarding?.token, undefined)
  })

  test('requires a designated Privacy re-acknowledgment without changing Terms or training state', async ({
    client,
  }) => {
    const user = await createConsumer('privacy-reack')
    await completeConsent(client, user, true)
    const acceptedPreference = await preferenceFor(user)
    assert.ok(acceptedPreference)

    await db.from(PREFERENCES_TABLE).where('user_uuid', user.uuid).update({
      privacy_policy_version: 'historical-privacy-version',
    })

    const gatedResponse = await client
      .get('/dashboard')
      .loginAs(user)
      .header('accept', 'text/html')
      .redirects(0)
    gatedResponse.assertFound()
    gatedResponse.assertHeader('location', '/onboarding/consent')

    const consentPage = await client.get('/onboarding/consent').loginAs(user).withInertia()
    consentPage.assertOk()
    consentPage.assertBodyContains({
      component: 'onboarding/consent',
      props: { privacyReackOnly: true },
    })

    const response = await client
      .post('/onboarding/consent')
      .loginAs(user)
      .header('user-agent', 'envoy-privacy-reack-test')
      .json({ termsAccepted: true, modelTrainingOptIn: false })
      .redirects(0)
    response.assertFound()
    response.assertHeader('location', '/dashboard')

    const updatedPreference = await preferenceFor(user)
    assert.equal(updatedPreference?.terms_accepted, true)
    assert.equal(updatedPreference?.terms_version, acceptedPreference.terms_version)
    assert.deepEqual(updatedPreference?.terms_accepted_at, acceptedPreference.terms_accepted_at)
    assert.equal(updatedPreference?.model_training_opt_in, true)
    assert.equal(
      updatedPreference?.privacy_policy_version,
      consentPage.body().props.privacyPolicyVersion
    )

    const events = await eventsFor(user)
    assert.equal(events.length, 4)
    const reackEvent = events.at(-1)
    assert.equal(reackEvent?.event_type, 'PRIVACY_POLICY_ACKNOWLEDGED')
    assert.equal(reackEvent?.source, 'PRIVACY_REACK')
    assert.equal(reackEvent?.user_agent, 'envoy-privacy-reack-test')
  })
})

test.group('account data preferences', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('loads the persisted model-training preference on the account page', async ({ client }) => {
    const user = await createConsumer('account-props')
    await completeConsent(client, user, true)

    const response = await client.get('/account').loginAs(user).withInertia()

    response.assertOk()
    response.assertBodyContains({
      component: 'account',
      props: {
        dataPrivacy: {
          modelTrainingOptIn: true,
        },
      },
    })
    assert.equal(
      typeof response.body().props.dataPrivacy.modelTrainingPreferenceUpdatedAt,
      'string'
    )
  })

  test('updates only training fields and records an event only when the value changes', async ({
    client,
  }) => {
    const user = await createConsumer('account-update')
    await completeConsent(client, user, false)
    const before = await preferenceFor(user)
    const beforeEvents = await eventsFor(user)
    assert.equal(beforeEvents.length, 3)

    const updateResponse = await client
      .patch('/account/data-preferences')
      .loginAs(user)
      .header('user-agent', 'envoy-account-preference-test')
      .json({ modelTrainingOptIn: true })
      .redirects(0)
    updateResponse.assertFound()
    updateResponse.assertHeader('location', '/account')

    const after = await preferenceFor(user)
    assert.equal(after?.model_training_opt_in, true)
    assert.equal(after?.terms_accepted, before?.terms_accepted)
    assert.equal(after?.terms_version, before?.terms_version)
    assert.deepEqual(after?.terms_accepted_at, before?.terms_accepted_at)
    assert.equal(after?.privacy_policy_version, before?.privacy_policy_version)
    assert.deepEqual(after?.privacy_policy_acknowledged_at, before?.privacy_policy_acknowledged_at)

    const changedEvents = await eventsFor(user)
    assert.equal(changedEvents.length, 4)
    const accountEvent = changedEvents.at(-1)
    assert.equal(accountEvent?.event_type, 'MODEL_TRAINING_OPTED_IN')
    assert.equal(accountEvent?.model_training_opt_in, true)
    assert.equal(accountEvent?.source, 'ACCOUNT')
    assert.equal(accountEvent?.actor_user_uuid, user.uuid)
    assert.equal(accountEvent?.user_agent, 'envoy-account-preference-test')
    assert.equal(accountEvent?.disclosure_text, ACCOUNT_MODEL_TRAINING_DISCLOSURE_TEXT)

    const unchangedResponse = await client
      .patch('/account/data-preferences')
      .loginAs(user)
      .json({ modelTrainingOptIn: true })
      .redirects(0)
    unchangedResponse.assertFound()
    const unchangedEvents = await eventsFor(user)
    assert.equal(unchangedEvents.length, 4)
  })

  test('requires a strict boolean and leaves the preference unchanged on validation failure', async ({
    client,
  }) => {
    const user = await createConsumer('account-validation')
    await completeConsent(client, user, false)

    const response = await client
      .patch('/account/data-preferences')
      .loginAs(user)
      .json({ modelTrainingOptIn: 'yes' })
    response.assertStatus(422)

    const preference = await preferenceFor(user)
    const events = await eventsFor(user)
    assert.equal(preference?.model_training_opt_in, false)
    assert.equal(events.length, 3)
  })
})

test.group('consent persistence constraints', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('allows only one current-state row per user', async ({ client }) => {
    const user = await createConsumer('one-current-row')
    await completeConsent(client, user, false)

    await assert.rejects(
      db.table(PREFERENCES_TABLE).insert({
        uuid: uuidv4(),
        user_uuid: user.uuid,
        terms_accepted: false,
        model_training_opt_in: false,
        created_timestamp: new Date(),
        modified_timestamp: new Date(),
      }),
      (error: any) => error?.code === '23505'
    )
  })

  test('requires acceptance version and timestamp when Terms are accepted', async () => {
    const user = await createConsumer('acceptance-constraint')

    await assert.rejects(
      db.table(PREFERENCES_TABLE).insert({
        uuid: uuidv4(),
        user_uuid: user.uuid,
        terms_accepted: true,
        model_training_opt_in: false,
        created_timestamp: new Date(),
        modified_timestamp: new Date(),
      }),
      (error: any) => error?.code === '23514'
    )

    await assert.rejects(
      db.table(PREFERENCES_TABLE).insert({
        uuid: uuidv4(),
        user_uuid: user.uuid,
        terms_accepted: true,
        terms_version: 'test-terms-version',
        terms_accepted_at: new Date(),
        model_training_opt_in: true,
        created_timestamp: new Date(),
        modified_timestamp: new Date(),
      }),
      (error: any) =>
        error?.code === '23514' &&
        error?.constraint === 'user_consent_preferences_training_metadata_check'
    )

    await assert.rejects(
      db.table(PREFERENCES_TABLE).insert({
        uuid: uuidv4(),
        user_uuid: user.uuid,
        terms_accepted: true,
        terms_version: 'test-terms-version',
        terms_accepted_at: new Date(),
        model_training_opt_in: false,
        created_timestamp: new Date(),
        modified_timestamp: new Date(),
      }),
      (error: any) =>
        error?.code === '23514' &&
        error?.constraint === 'user_consent_preferences_training_metadata_check'
    )
  })

  test('prevents direct mutation or deletion of append-only consent events', async ({ client }) => {
    const user = await createConsumer('append-only-events')
    await completeConsent(client, user, false)
    const [event] = await eventsFor(user)
    assert.ok(event)

    await assert.rejects(
      db
        .from('envoy_schema.user_consent_events')
        .where('uuid', event.uuid)
        .update({ disclosure_text: 'tampered' }),
      (error: any) => error?.code === '55000'
    )
    await assert.rejects(
      db.from('envoy_schema.user_consent_events').where('uuid', event.uuid).delete(),
      (error: any) => error?.code === '55000'
    )
    const persistedEvents = await eventsFor(user)
    assert.equal(persistedEvents.length, 3)
  })

  test('cascades current consent state and event history when the user is deleted', async ({
    client,
  }) => {
    const user = await createConsumer('cascade')
    await completeConsent(client, user, true)
    assert.ok(await preferenceFor(user))
    const existingEvents = await eventsFor(user)
    assert.equal(existingEvents.length, 3)

    await user.delete()

    assert.equal(await preferenceFor(user), null)
    const remainingEvents = await eventsFor(user)
    assert.equal(remainingEvents.length, 0)
  })
})
