import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import Vendor from '#models/vendor'
import VendorListing from '#models/vendor_listing'
import ReasoningEngineService from '#services/reasoning_engine_service'
import VendorSearchService from '#services/vendor_search_service'
import VendorService from '#services/vendor_service'

test.group('authenticated vendor discovery API', (group) => {
  const restores: Array<() => void> = []
  let consumer: User

  group.setup(() => testUtils.db().truncate())
  group.setup(async () => {
    const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
    consumer = await User.create({
      fullName: 'Authenticated Search Consumer',
      email: `authenticated-search-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: entitlement.id,
      isActive: true,
    })
  })
  group.each.teardown(() => {
    while (restores.length) restores.pop()?.()
  })

  function stubReasoning(output: unknown | (() => unknown | Promise<unknown>)) {
    const original = ReasoningEngineService.requestVendorDiscovery
    restores.push(() => {
      ReasoningEngineService.requestVendorDiscovery = original
    })
    ReasoningEngineService.requestVendorDiscovery = (async () =>
      typeof output === 'function'
        ? await output()
        : output) as typeof ReasoningEngineService.requestVendorDiscovery
  }

  function stubFoursquare(output: unknown[] | (() => unknown[] | Promise<unknown[]>)) {
    const original = VendorSearchService.searchPlaces
    restores.push(() => {
      VendorSearchService.searchPlaces = original
    })
    VendorSearchService.searchPlaces = (async () =>
      typeof output === 'function'
        ? await output()
        : output) as typeof VendorSearchService.searchPlaces
  }

  test('returns contact state without creating drafts or mappings for unsaved results', async ({
    client,
  }) => {
    const existingFsqPlaceId = `authenticated-existing-${uuidv4()}`
    const newFsqPlaceId = `authenticated-new-${uuidv4()}`
    const existing = await VendorListing.create({
      name: 'Existing Claimed Electric',
      email: 'existing-authenticated@example.com',
      originator: 'VENDOR',
      fsqPlaceId: existingFsqPlaceId,
      categories: ['Electrician'],
      claimStatus: 'CLAIMED',
      claimedByUserUuid: consumer.uuid,
      isActive: true,
    })
    const existingMapping = await VendorService.ensureUserVendorMapping(
      consumer.uuid,
      existing.uuid
    )
    assert.ok(existingMapping)

    stubReasoning({
      vendorSearches: [{ classification: 'Electrician', query: 'commercial electrician' }],
    })
    stubFoursquare([
      {
        fsq_place_id: newFsqPlaceId,
        name: 'No Email Search Electric',
        date_refreshed: '2026-06-20',
        categories: [{ name: 'Electrician' }],
        location: { postcode: '23220' },
      },
      {
        fsq_place_id: existingFsqPlaceId,
        name: 'External Name Must Not Overwrite',
        email: 'changed@example.com',
        date_refreshed: '2026-06-21',
      },
    ])

    const draftsBefore = await AnonymousOnboardingDraft.query().count('* as total')
    const mappingsBefore = await Vendor.query()
      .where('user_uuid', consumer.uuid)
      .count('* as total')

    const response = await client.post('/api/vendors/search').loginAs(consumer).json({
      projectDescription: 'I need a commercial electrician for an office renovation project.',
      postalCode: '23220',
    })

    response.assertStatus(200)
    assert.equal(response.body().vendors.length, 2)
    assert.equal(response.body().vendors[0].vendorListingUuid, existing.uuid)
    assert.equal(response.body().vendors[0].inContacts, true)
    assert.equal(response.body().vendors[0].vendorUuid, existingMapping.uuid)
    assert.equal(response.body().vendors[0].onboardedToEnvoy, true)
    assert.equal(response.body().vendors[1].hasEmail, false)
    assert.equal(response.body().vendors[1].inContacts, false)
    assert.equal(response.body().vendors[1].vendorUuid, null)
    assert.equal('email' in response.body().vendors[0], false)
    assert.equal('sourcePayload' in response.body().vendors[0], false)
    assert.equal('onboardingToken' in response.body(), false)
    assert.equal('draftUuid' in response.body(), false)

    await existing.refresh()
    assert.equal(existing.name, 'Existing Claimed Electric')
    assert.equal(existing.email, 'existing-authenticated@example.com')
    assert.ok(await VendorListing.findBy('fsqPlaceId', newFsqPlaceId))

    const draftsAfter = await AnonymousOnboardingDraft.query().count('* as total')
    const mappingsAfter = await Vendor.query().where('user_uuid', consumer.uuid).count('* as total')
    assert.equal(draftsAfter[0].$extras.total, draftsBefore[0].$extras.total)
    assert.equal(mappingsAfter[0].$extras.total, mappingsBefore[0].$extras.total)
  })

  test('validates authenticated search input', async ({ client }) => {
    stubReasoning({
      vendorSearches: [{ classification: 'Painter', query: 'commercial painter' }],
    })
    stubFoursquare([])

    const invalidResponse = await client
      .post('/api/vendors/search')
      .loginAs(consumer)
      .json({ projectDescription: 'nope', postalCode: '23220' })

    invalidResponse.assertStatus(422)

    const validResponse = await client
      .post('/api/vendors/search')
      .loginAs(consumer)
      .json({ projectDescription: 'paint', postalCode: '23220' })

    validResponse.assertStatus(200)
  })

  test('rejects authenticated vendor accounts', async ({ client }) => {
    const vendorEntitlement = await UserEntitlement.findByOrFail('canonicalName', 'VENDOR')
    const vendorUser = await User.create({
      fullName: 'Authenticated Search Vendor',
      email: `authenticated-search-vendor-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: vendorEntitlement.id,
      isActive: true,
    })

    const response = await client.post('/api/vendors/search').loginAs(vendorUser).json({
      projectDescription: 'I need a commercial electrician for an office renovation project.',
      postalCode: '23220',
    })

    response.assertStatus(403)
  })

  test('returns retryable dependency errors without creating personal mappings', async ({
    client,
  }) => {
    stubReasoning(() => {
      throw new Error('reasoning unavailable')
    })
    const mappingsBefore = await Vendor.query()
      .where('user_uuid', consumer.uuid)
      .count('* as total')

    const response = await client.post('/api/vendors/search').loginAs(consumer).json({
      projectDescription: 'I need a commercial plumber for a restaurant renovation.',
      postalCode: '23220',
    })

    response.assertStatus(502)
    response.assertBodyContains({ retryable: true })
    const mappingsAfter = await Vendor.query().where('user_uuid', consumer.uuid).count('* as total')
    assert.equal(mappingsAfter[0].$extras.total, mappingsBefore[0].$extras.total)
  })
})
