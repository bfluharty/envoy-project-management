import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import VendorListing from '#models/vendor_listing'
import OnboardingVendorDiscoveryService, {
  NO_EMAIL_READY_VENDORS,
  VendorDiscoveryDependencyError,
  normalizeFoursquarePlace,
  normalizeVendorName,
  validateVendorSearches,
} from '#services/onboarding_vendor_discovery_service'
import ReasoningEngineService from '#services/reasoning_engine_service'
import VendorSearchService from '#services/vendor_search_service'

test.group('OnboardingVendorDiscoveryService', (group) => {
  const restores: Array<() => void> = []

  group.setup(() => testUtils.db().truncate())
  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
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

  function stubFoursquare(
    handler: (query: string, postalCode: string, limit: number) => Promise<unknown[]> | unknown[]
  ) {
    const original = VendorSearchService.searchPlaces
    restores.push(() => {
      VendorSearchService.searchPlaces = original
    })

    VendorSearchService.searchPlaces = (async (query: string, postalCode: string, limit = 50) =>
      handler(query, postalCode, limit)) as typeof VendorSearchService.searchPlaces
  }

  test('validates reasoning searches by dropping duplicates and capping at four', () => {
    const searches = validateVendorSearches({
      vendorSearches: [
        { classification: 'Painter', query: 'commercial painter' },
        { classification: 'Painter duplicate', query: 'Commercial, painter!' },
        { classification: 'Electrician', query: 'commercial electrician' },
        { classification: '', query: 'ignored' },
        { classification: 'Plumber', query: 'commercial plumber' },
        { classification: 'HVAC', query: 'commercial hvac' },
        { classification: 'Extra', query: 'commercial extra' },
      ],
    })

    assert.deepEqual(
      searches.map((search) => search.query),
      ['commercial painter', 'commercial electrician', 'commercial plumber', 'commercial hvac']
    )
  })

  test('normalizes names for weak matching', () => {
    assert.equal(normalizeVendorName('The Smith & Sons, LLC'), 'smith sons')
    assert.equal(normalizeVendorName('Acme Incorporated'), 'acme')
  })

  test('normalizes Foursquare places and filters category labels to human-readable values', () => {
    const candidate = normalizeFoursquarePlace(
      {
        fsq_place_id: 'fsq-1',
        name: 'Richmond Build Co.',
        email: 'HELLO@example.com',
        tel: '+18045550199',
        website: 'https://richmondbuild.example',
        date_refreshed: '2026-05-20T00:00:00Z',
        categories: [{ name: 'Commercial Contractor' }, { short_name: 'Construction' }],
        location: {
          address: '456 Broad St',
          locality: 'Richmond',
          region: 'VA',
          postcode: '23220',
          country: 'US',
          formatted_address: '456 Broad St, Richmond, VA 23220',
        },
      },
      3
    )

    assert.ok(candidate)
    assert.equal(candidate.candidateId, 'search:fsq-1')
    assert.equal(candidate.email, 'hello@example.com')
    assert.deepEqual(candidate.categories, ['Commercial Contractor', 'Construction'])
    assert.equal(candidate.dateRefreshed, '2026-05-20')
  })

  test('creates draft, searches Foursquare, dedupes, ranks, matches listings, and persists recommendations', async () => {
    const existingFsqPlaceId = `existing-fsq-${uuidv4()}`
    const existingEmail = `existing-${uuidv4()}@example.com`

    await VendorListing.create({
      name: 'Existing Electric',
      email: existingEmail,
      originator: 'VENDOR',
      fsqPlaceId: existingFsqPlaceId,
      phoneNumber: '+18045550222',
      location: { postcode: '23220' },
      isActive: true,
      modifiedBy: 'test',
    })

    const calls: Array<{ query: string; postalCode: string; limit: number }> = []
    stubReasoning({
      vendorSearches: [
        { classification: 'Painter', query: 'commercial painter' },
        { classification: 'Painter duplicate', query: 'commercial painter!' },
        { classification: 'Electrician', query: 'commercial electrician' },
        { classification: 'Plumber', query: 'commercial plumber' },
        { classification: 'HVAC', query: 'commercial hvac' },
        { classification: 'Extra', query: 'commercial extra' },
      ],
    })
    stubFoursquare((query, postalCode, limit) => {
      calls.push({ query, postalCode, limit })

      if (query === 'commercial painter') {
        return [
          {
            fsq_place_id: 'old-shared',
            name: 'Shared Co',
            email: 'shared@example.com',
            tel: '+18045550111',
            date_refreshed: '2026-01-01',
            categories: [{ name: 'Painter' }],
            location: { postcode: '23220' },
          },
          {
            fsq_place_id: 'no-email',
            name: 'No Email Vendor',
            date_refreshed: '2026-09-01',
            categories: [{ name: 'Ignored' }],
            location: { postcode: '23220' },
          },
        ]
      }

      if (query === 'commercial electrician') {
        return [
          {
            fsq_place_id: existingFsqPlaceId,
            name: 'Existing Electric',
            email: existingEmail,
            tel: '+18045550222',
            date_refreshed: '2026-06-01',
            categories: [{ name: 'Electrician' }],
            location: { postcode: '23220' },
          },
        ]
      }

      if (query === 'commercial plumber') {
        return [
          {
            fsq_place_id: 'new-shared',
            name: 'Shared Co Updated',
            email: 'shared@example.com',
            tel: '+18045550333',
            website: 'https://shared.example',
            date_refreshed: '2026-07-01',
            categories: [{ name: 'Plumber' }],
            location: { postcode: '23220' },
          },
        ]
      }

      return [
        {
          fsq_place_id: 'hvac-1',
          name: 'HVAC One',
          email: 'hvac@example.com',
          date_refreshed: '2026-05-01',
          categories: [{ name: 'HVAC' }],
          location: { postcode: '23220' },
        },
      ]
    })

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need a commercial renovation with painting, electrical, and HVAC.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.equal(validateUuid(response.onboardingToken), true)
    assert.equal(uuidVersion(response.onboardingToken), 4)
    assert.equal(response.vendorSearches.length, 4)
    assert.deepEqual(
      calls.map((call) => call.query),
      ['commercial painter', 'commercial electrician', 'commercial plumber', 'commercial hvac']
    )
    assert.equal(
      calls.every((call) => call.postalCode === '23220' && call.limit === 50),
      true
    )
    assert.deepEqual(
      response.vendors.map((vendor) => vendor.email),
      ['shared@example.com', existingEmail, 'hvac@example.com']
    )
    assert.equal(response.vendors[0].name, 'Shared Co Updated')
    assert.equal('sourcePayload' in response.vendors[0], false)
    assert.equal(response.vendors[1].vendorListingUuid !== null, true)
    assert.equal(response.vendors[1].onboardedToEnvoy, true)

    const draft = await AnonymousOnboardingDraft.findByOrFail('tokenUuid', response.onboardingToken)
    assert.equal(draft.vendorSearches.length, 4)
    assert.equal(draft.recommendedVendors.length, 3)
    assert.equal('sourcePayload' in (draft.recommendedVendors[0] as Record<string, unknown>), true)
  })

  test('returns empty-state reason when Foursquare has no email-ready vendors', async () => {
    stubReasoning({
      vendorSearches: [{ classification: 'Painter', query: 'commercial painter' }],
    })
    stubFoursquare(() => [
      {
        fsq_place_id: 'no-email',
        name: 'No Email Vendor',
        date_refreshed: '2026-09-01',
      },
    ])

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need a painter for a commercial office refresh.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.deepEqual(response.vendors, [])
    assert.equal(response.emptyStateReason, NO_EMAIL_READY_VENDORS)
  })

  test('wraps reasoning and Foursquare failures as retryable dependency errors', async () => {
    stubReasoning(() => {
      throw new Error('reasoning unavailable')
    })

    await assert.rejects(
      () =>
        OnboardingVendorDiscoveryService.search({
          projectDescription: 'I need a plumber for a commercial kitchen.',
          postalCode: '23220',
          anonymousSessionUuid: uuidv4(),
        }),
      (error: unknown) =>
        error instanceof VendorDiscoveryDependencyError &&
        error.message === 'Reasoning engine vendor discovery failed'
    )

    stubReasoning({
      vendorSearches: [{ classification: 'Painter', query: 'commercial painter' }],
    })
    stubFoursquare(() => {
      throw new Error('foursquare unavailable')
    })

    await assert.rejects(
      () =>
        OnboardingVendorDiscoveryService.search({
          projectDescription: 'I need a painter for a commercial office refresh.',
          postalCode: '23220',
          anonymousSessionUuid: uuidv4(),
        }),
      (error: unknown) =>
        error instanceof VendorDiscoveryDependencyError &&
        error.message === 'Foursquare vendor search failed'
    )
  })
})
