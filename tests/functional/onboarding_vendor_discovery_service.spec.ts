import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { DateTime } from 'luxon'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import VendorListing from '#models/vendor_listing'
import OnboardingVendorDiscoveryService, {
  VendorDiscoveryDependencyError,
  normalizeFoursquarePlace,
  normalizeVendorName,
  rankPersistedListings,
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
    handler: (
      query: string,
      postalCode: string,
      fsqCategoryIds: string[]
    ) => Promise<unknown[]> | unknown[]
  ) {
    const original = VendorSearchService.searchPlaces
    restores.push(() => {
      VendorSearchService.searchPlaces = original
    })

    VendorSearchService.searchPlaces = (async (
      query: string,
      postalCode: string,
      fsqCategoryIds: string[] = []
    ) => handler(query, postalCode, fsqCategoryIds)) as typeof VendorSearchService.searchPlaces
  }

  test('validates reasoning searches by dropping duplicates and capping at six', () => {
    const searches = validateVendorSearches({
      vendorSearches: [
        { classification: 'Painter', query: 'commercial painter' },
        {
          classification: 'Electrician',
          query: 'commercial electrician',
          fsqCategoryIds: ['electrician-category-id', 'lighting-category-id'],
        },
        { classification: 'Painter duplicate', query: 'Commercial, painter!' },
        { classification: '', query: 'ignored' },
        { classification: 'Plumber', query: 'commercial plumber' },
        { classification: 'HVAC', query: 'commercial hvac' },
        { classification: 'Extra', query: 'commercial extra' },
        { classification: 'Extra two', query: 'commercial extra two' },
        { classification: 'Extra three', query: 'commercial extra three' },
      ],
    })

    assert.deepEqual(
      searches.map((search) => search.query),
      [
        'commercial painter',
        'commercial electrician',
        'commercial plumber',
        'commercial hvac',
        'commercial extra',
        'commercial extra two',
      ]
    )
    assert.deepEqual(searches[1].fsqCategoryIds, [
      'electrician-category-id',
      'lighting-category-id',
    ])
  })

  test('accepts an explicit empty search list but rejects a non-empty list with no usable searches', () => {
    assert.deepEqual(validateVendorSearches({ vendorSearches: [] }), [])
    assert.throws(
      () => validateVendorSearches({ vendorSearches: [{ classification: '', query: '' }] }),
      (error: unknown) =>
        error instanceof VendorDiscoveryDependencyError &&
        error.message === 'Reasoning response contained no usable searches'
    )
  })

  test('persists an ambiguous empty result without searching Foursquare', async () => {
    stubReasoning({ vendorSearches: [] })
    let foursquareCallCount = 0
    stubFoursquare(() => {
      foursquareCallCount += 1
      return []
    })

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'event help',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.deepEqual(response.vendorSearches, [])
    assert.deepEqual(response.vendors, [])
    assert.equal(response.emptyStateReason, undefined)
    assert.equal(foursquareCallCount, 0)

    const draft = await AnonymousOnboardingDraft.findByOrFail('tokenUuid', response.onboardingToken)
    assert.deepEqual(draft.vendorSearches, [])
    assert.deepEqual(draft.recommendedVendorListingUuids, [])
  })

  test('normalizes names for weak matching', () => {
    assert.equal(normalizeVendorName('The Smith & Sons, LLC'), 'smith sons')
    assert.equal(normalizeVendorName('Acme Incorporated'), 'acme')
  })

  test('normalizes Foursquare category labels and IDs', () => {
    const candidate = normalizeFoursquarePlace(
      {
        fsq_place_id: 'fsq-1',
        name: 'Richmond Build Co.',
        email: 'HELLO@example.com',
        tel: '+18045550199',
        website: 'https://richmondbuild.example',
        date_refreshed: '2026-05-20T00:00:00Z',
        categories: [
          { fsq_category_id: 'contractor-id', name: 'Commercial Contractor' },
          { fsq_category_id: 'construction-id', short_name: 'Construction' },
          { fsq_category_id: 'construction-id', name: 'Duplicate Construction' },
        ],
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
    assert.equal(candidate.fsqPlaceId, 'fsq-1')
    assert.equal(candidate.email, 'hello@example.com')
    assert.deepEqual(candidate.categories, [
      'Commercial Contractor',
      'Construction',
      'Duplicate Construction',
    ])
    assert.deepEqual(candidate.fsqCategoryIds, ['contractor-id', 'construction-id'])
    assert.equal(candidate.dateRefreshed, '2026-05-20')
  })

  test('ranks relevant existing listings first, then by email, freshness, relevance, and name', async () => {
    const createListing = (input: {
      name: string
      email: string | null
      dateRefreshed: string
      claimStatus?: 'CLAIMED' | 'UNCLAIMED'
    }) =>
      VendorListing.create({
        name: input.name,
        email: input.email,
        originator: 'SEARCH',
        dateRefreshed: DateTime.fromISO(input.dateRefreshed),
        claimStatus: input.claimStatus ?? 'UNCLAIMED',
        isActive: true,
      })

    const [
      olderEmail,
      lowerRelevance,
      nameZulu,
      nameAlpha,
      claimedNoEmail,
      relevantExistingNoEmail,
    ] = await Promise.all([
      createListing({
        name: 'Older Email',
        email: 'older@example.com',
        dateRefreshed: '2026-06-01',
      }),
      createListing({
        name: 'Lower Relevance',
        email: 'lower@example.com',
        dateRefreshed: '2026-07-01',
      }),
      createListing({ name: 'Zulu', email: 'zulu@example.com', dateRefreshed: '2026-07-01' }),
      createListing({ name: 'Alpha', email: 'alpha@example.com', dateRefreshed: '2026-07-01' }),
      createListing({
        name: 'Claimed Without Email',
        email: null,
        dateRefreshed: '2026-12-01',
        claimStatus: 'CLAIMED',
      }),
      createListing({
        name: 'Relevant Existing Without Email',
        email: null,
        dateRefreshed: '2025-01-01',
      }),
    ])

    const ranked = rankPersistedListings([
      { listing: olderEmail, relevanceRank: 0 },
      { listing: lowerRelevance, relevanceRank: 4 },
      { listing: nameZulu, relevanceRank: 1 },
      { listing: nameAlpha, relevanceRank: 1 },
      { listing: claimedNoEmail, relevanceRank: 0 },
      {
        listing: relevantExistingNoEmail,
        relevanceRank: 3,
        isRelevantExistingListing: true,
      },
    ])

    assert.deepEqual(
      ranked.map(({ listing }) => listing.name),
      [
        'Relevant Existing Without Email',
        'Alpha',
        'Zulu',
        'Lower Relevance',
        'Older Email',
        'Claimed Without Email',
      ]
    )
  })

  test('creates draft, searches Foursquare, dedupes, ranks, matches listings, and persists recommendations', async () => {
    const existingFsqPlaceId = `existing-fsq-${uuidv4()}`
    const existingEmail = `existing-${uuidv4()}@example.com`
    const noEmailFsqPlaceId = `no-email-${uuidv4()}`
    const sharedEmail = `shared-${uuidv4()}@example.com`
    const oldSharedFsqPlaceId = `old-shared-${uuidv4()}`
    const newSharedFsqPlaceId = `new-shared-${uuidv4()}`
    const hvacFsqPlaceId = `hvac-${uuidv4()}`

    await VendorListing.create({
      name: 'Existing Electric',
      email: existingEmail,
      originator: 'VENDOR',
      claimStatus: 'CLAIMED',
      fsqPlaceId: existingFsqPlaceId,
      phoneNumber: '+18045550222',
      location: { postcode: '23220' },
      isActive: true,
      modifiedBy: 'test',
    })

    const calls: Array<{ query: string; postalCode: string; fsqCategoryIds: string[] }> = []
    stubReasoning({
      vendorSearches: [
        { classification: 'Painter', query: 'commercial painter' },
        { classification: 'Painter duplicate', query: 'commercial painter!' },
        {
          classification: 'Electrician',
          query: 'commercial electrician',
          fsqCategoryIds: ['electrician-category-id', 'lighting-category-id'],
        },
        { classification: 'Plumber', query: 'commercial plumber' },
        { classification: 'HVAC', query: 'commercial hvac' },
        { classification: 'Extra', query: 'commercial extra' },
        { classification: 'Extra two', query: 'commercial extra two' },
        { classification: 'Extra three', query: 'commercial extra three' },
      ],
    })
    stubFoursquare((query, postalCode, fsqCategoryIds) => {
      calls.push({ query, postalCode, fsqCategoryIds })

      if (query === 'commercial painter') {
        return [
          {
            fsq_place_id: oldSharedFsqPlaceId,
            name: 'Shared Co',
            email: sharedEmail,
            date_refreshed: '2026-01-01',
            categories: [{ name: 'Painter' }],
            location: { postcode: '23220' },
          },
          {
            fsq_place_id: noEmailFsqPlaceId,
            name: 'No Email Vendor',
            date_refreshed: '2026-09-01',
            categories: [{ fsq_category_id: 'ignored-category-id', name: 'Ignored' }],
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
            fsq_place_id: newSharedFsqPlaceId,
            name: 'Shared Co Updated',
            email: sharedEmail,
            website: 'https://shared.example',
            date_refreshed: '2026-07-01',
            categories: [{ name: 'Plumber' }],
            location: { postcode: '23220' },
          },
        ]
      }

      return [
        {
          fsq_place_id: hvacFsqPlaceId,
          name: 'HVAC One',
          email: `hvac-${uuidv4()}@example.com`,
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
    assert.equal(response.vendorSearches.length, 6)
    assert.deepEqual(
      calls.map((call) => call.query),
      [
        'commercial painter',
        'commercial electrician',
        'commercial plumber',
        'commercial hvac',
        'commercial extra',
        'commercial extra two',
      ]
    )
    assert.equal(
      calls.every((call) => call.postalCode === '23220'),
      true
    )
    assert.deepEqual(calls[1].fsqCategoryIds, ['electrician-category-id', 'lighting-category-id'])
    assert.deepEqual(calls[0].fsqCategoryIds, [])
    assert.deepEqual(
      response.vendors.map((vendor) => vendor.name),
      ['HVAC One', 'Shared Co', 'Existing Electric', 'No Email Vendor']
    )
    assert.deepEqual(
      response.vendors.map((vendor) => vendor.hasEmail),
      [true, true, true, false]
    )
    assert.equal(response.vendors[0].name, 'HVAC One')
    assert.equal(response.vendors[3].name, 'No Email Vendor')
    assert.equal('email' in response.vendors[0], false)
    assert.equal('sourcePayload' in response.vendors[0], false)
    const existingRecommendation = response.vendors.find(
      (vendor) => vendor.vendorListingUuid === existingFsqPlaceId
    )
    assert.equal(existingRecommendation, undefined)
    assert.equal(
      response.vendors.find((vendor) => vendor.name === 'Existing Electric')?.onboardedToEnvoy,
      true
    )

    const noEmailListing = await VendorListing.findByOrFail('fsqPlaceId', noEmailFsqPlaceId)
    assert.equal(noEmailListing.email, null)
    assert.equal(noEmailListing.ownerUserUuid, null)
    assert.equal(noEmailListing.originator, 'SEARCH')
    assert.deepEqual(noEmailListing.fsqCategoryIds, ['ignored-category-id'])
    assert.deepEqual(noEmailListing.sourcePayload, {
      fsq_place_id: noEmailFsqPlaceId,
      name: 'No Email Vendor',
      date_refreshed: '2026-09-01',
      categories: [{ fsq_category_id: 'ignored-category-id', name: 'Ignored' }],
      location: { postcode: '23220' },
    })

    const draft = await AnonymousOnboardingDraft.findByOrFail('tokenUuid', response.onboardingToken)
    assert.equal(draft.vendorSearches.length, 6)
    assert.equal(draft.recommendedVendorListingUuids.length, 4)
    assert.deepEqual(
      draft.recommendedVendorListingUuids,
      response.vendors.map((vendor) => vendor.vendorListingUuid)
    )
  })

  test('returns the matched search category first when Foursquare returns multiple categories', async () => {
    const fsqPlaceId = `kitchen-cabinets-${uuidv4()}`
    stubReasoning({
      vendorSearches: [
        {
          classification: 'Kitchen Remodeler',
          query: 'kitchen renovation contractor',
          fsqCategoryIds: ['kitchen-category-id'],
        },
      ],
    })
    stubFoursquare(() => [
      {
        fsq_place_id: fsqPlaceId,
        name: 'Us Industries New Cabinets',
        email: `kitchen-${uuidv4()}@example.com`,
        categories: [
          { fsq_category_id: 'bathroom-category-id', name: 'Bathroom Contractor' },
          { fsq_category_id: 'general-category-id', name: 'General Contractor' },
          { fsq_category_id: 'kitchen-category-id', name: 'Kitchen Remodeler' },
        ],
        location: { postcode: '23831' },
      },
    ])

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'Renovate a 1920s kitchen',
      postalCode: '23831',
      anonymousSessionUuid: uuidv4(),
    })

    assert.deepEqual(response.vendors[0].categories, [
      'Kitchen Remodeler',
      'Bathroom Contractor',
      'General Contractor',
    ])

    const persistedListing = await VendorListing.findByOrFail('fsqPlaceId', fsqPlaceId)
    assert.deepEqual(persistedListing.categories, [
      'Bathroom Contractor',
      'General Contractor',
      'Kitchen Remodeler',
    ])
  })

  test('returns no-email Foursquare results instead of an empty state', async () => {
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

    assert.equal(response.vendors.length, 1)
    assert.equal(response.vendors[0].name, 'No Email Vendor')
    assert.equal(response.vendors[0].hasEmail, false)
    assert.equal(response.emptyStateReason, undefined)
  })

  test('persists all normalized listings while limiting recommendations to eight', async () => {
    stubReasoning({
      vendorSearches: [{ classification: 'Contractor', query: 'commercial contractor' }],
    })
    stubFoursquare(() =>
      Array.from({ length: 10 }, (_, index) => ({
        fsq_place_id: `cap-${index}`,
        name: `Vendor ${index}`,
        email: index < 5 ? `vendor-${index}@example.com` : undefined,
        date_refreshed: `2026-06-${String(index + 1).padStart(2, '0')}`,
      }))
    )

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need several contractors for a commercial development project.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.equal(response.vendors.length, 8)
    assert.deepEqual(
      response.vendors.slice(0, 5).map((vendor) => vendor.hasEmail),
      [true, true, true, true, true]
    )
    assert.equal(
      await VendorListing.query()
        .whereLike('fsq_place_id', 'cap-%')
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      10
    )
  })

  test('applies the eight-result cap across multiple inferred searches', async () => {
    stubReasoning({
      vendorSearches: [
        { classification: 'Contractor', query: 'multi contractor' },
        { classification: 'Designer', query: 'multi designer' },
      ],
    })
    const batchUuid = uuidv4()
    stubFoursquare((query) =>
      Array.from({ length: 6 }, (_, index) => ({
        fsq_place_id: `${batchUuid}-${query}-${index}`,
        name: `${query} Vendor ${index}`,
        email: `${batchUuid}-${query}-${index}@example.com`,
        date_refreshed: `2026-06-${String(index + 1).padStart(2, '0')}`,
      }))
    )

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need contractors and designers for a commercial renovation project.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.equal(response.vendors.length, 8)
    assert.equal(
      await VendorListing.query()
        .whereLike('fsq_place_id', `${batchUuid}-%`)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      12
    )
  })

  test('always calls Foursquare and falls back to relevant nearby listings when live results are empty', async () => {
    const categoryId = `internal-category-${uuidv4()}`
    await VendorListing.createMany([
      ...['23220', '23173', '23219', '23221', '23222'].map((postcode, index) => ({
        name: `Internal Vendor ${index}`,
        email: `internal-${index}@example.com`,
        originator: (index === 4 ? 'VENDOR' : 'SEARCH') as 'VENDOR' | 'SEARCH',
        categories: ['Internal Category'],
        fsqCategoryIds: [categoryId],
        location: { postcode },
        claimStatus: (index === 4 ? 'CLAIMED' : 'UNCLAIMED') as 'CLAIMED' | 'UNCLAIMED',
        isActive: true,
      })),
      {
        name: 'Distant Internal Vendor',
        email: 'distant@example.com',
        originator: 'SEARCH' as const,
        categories: ['Internal Category'],
        fsqCategoryIds: [categoryId],
        location: { postcode: '90210' },
        claimStatus: 'UNCLAIMED' as const,
        isActive: true,
      },
      {
        name: 'Wrong Category Vendor',
        email: 'wrong-category@example.com',
        originator: 'SEARCH' as const,
        categories: ['Wrong Category'],
        fsqCategoryIds: [`wrong-${categoryId}`],
        location: { postcode: '23220' },
        claimStatus: 'UNCLAIMED' as const,
        isActive: true,
      },
    ])

    stubReasoning({
      vendorSearches: [
        {
          classification: 'Internal Category',
          query: 'internal category',
          fsqCategoryIds: [categoryId],
        },
      ],
    })
    let foursquareCallCount = 0
    stubFoursquare(() => {
      foursquareCallCount += 1
      return []
    })

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need an internal category vendor for this project.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.equal(foursquareCallCount, 1)
    assert.equal(response.vendors.length, 5)
    assert.equal(response.vendors[0].name, 'Internal Vendor 0')
    assert.equal(
      response.vendors.find((vendor) => vendor.name === 'Internal Vendor 4')?.onboardedToEnvoy,
      true
    )
    assert.equal(
      response.vendors.some((vendor) => vendor.name === 'Distant Internal Vendor'),
      false
    )
    assert.equal(
      response.vendors.some((vendor) => vendor.name === 'Wrong Category Vendor'),
      false
    )
  })

  test('prioritizes relevant existing listings and then fills with successful live results', async () => {
    const categoryId = `supplement-category-${uuidv4()}`
    await VendorListing.createMany([
      ...['Claimed Internal', 'Unclaimed Internal A', 'Unclaimed Internal B'].map(
        (name, index) => ({
          name,
          email: `supplement-internal-${index}@example.com`,
          originator: (index === 0 ? 'VENDOR' : 'SEARCH') as 'VENDOR' | 'SEARCH',
          categories: ['Supplement Category'],
          fsqCategoryIds: [categoryId],
          location: { postcode: '23220' },
          claimStatus: (index === 0 ? 'CLAIMED' : 'UNCLAIMED') as 'CLAIMED' | 'UNCLAIMED',
          isActive: true,
        })
      ),
      {
        name: 'Unrelated Claimed Vendor',
        email: 'unrelated-claimed@example.com',
        originator: 'VENDOR' as const,
        categories: ['Unrelated Category'],
        fsqCategoryIds: [`unrelated-${categoryId}`],
        location: { postcode: '23220' },
        claimStatus: 'CLAIMED' as const,
        isActive: true,
      },
    ])

    stubReasoning({
      vendorSearches: [
        {
          classification: 'Supplement Category',
          query: 'supplement category',
          fsqCategoryIds: [categoryId],
        },
      ],
    })
    let foursquareCallCount = 0
    stubFoursquare(() => {
      foursquareCallCount += 1
      return Array.from({ length: 8 }, (_, index) => ({
        fsq_place_id: `supplement-external-${uuidv4()}`,
        name: `External Vendor ${index}`,
        email: `supplement-external-${index}@example.com`,
        categories: [{ fsq_category_id: categoryId, name: 'Supplement Category' }],
        location: { postcode: '23220' },
      }))
    })

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need a supplement category vendor for this project.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.equal(foursquareCallCount, 1)
    assert.equal(response.vendors.length, 8)
    assert.deepEqual(
      response.vendors.slice(0, 3).map((vendor) => vendor.name),
      ['Claimed Internal', 'Unclaimed Internal A', 'Unclaimed Internal B']
    )
    assert.equal(
      response.vendors.slice(3).every((vendor) => vendor.name.startsWith('External Vendor')),
      true
    )
    assert.equal(
      response.vendors.some((vendor) => vendor.name === 'Unrelated Claimed Vendor'),
      false
    )
  })

  test('returns cached matching listings with a live-search warning when Foursquare is unavailable', async () => {
    const categoryId = `fallback-category-${uuidv4()}`
    const listing = await VendorListing.create({
      name: 'Cached Fallback Vendor',
      email: `cached-fallback-${uuidv4()}@example.com`,
      originator: 'SEARCH',
      categories: ['Fallback Category'],
      fsqCategoryIds: [categoryId],
      location: { postcode: '23220' },
      claimStatus: 'UNCLAIMED',
      isActive: true,
    })
    stubReasoning({
      vendorSearches: [
        {
          classification: 'Fallback Category',
          query: 'fallback category',
          fsqCategoryIds: [categoryId],
        },
      ],
    })
    stubFoursquare(() => {
      throw new Error('foursquare unavailable')
    })

    const response = await OnboardingVendorDiscoveryService.search({
      projectDescription: 'I need a fallback category vendor for a commercial project.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })

    assert.deepEqual(
      response.vendors.map((vendor) => vendor.vendorListingUuid),
      [listing.uuid]
    )
    assert.equal(response.liveSearchUnavailable, true)
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
        error.message === 'Reasoning engine contact discovery failed'
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
        error.message === 'Foursquare search failed'
    )
  })
})
