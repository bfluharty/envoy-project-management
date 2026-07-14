import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import VendorListing from '#models/vendor_listing'
import OnboardingDraftService from '#services/onboarding_draft_service'
import OnboardingVendorDiscoveryService from '#services/onboarding_vendor_discovery_service'

function cookieHeader(response: any) {
  const rawSetCookieHeader = response.header('set-cookie')
  const setCookieValues = Array.isArray(rawSetCookieHeader)
    ? rawSetCookieHeader
    : rawSetCookieHeader
      ? [rawSetCookieHeader]
      : []

  return setCookieValues.map((cookie: string) => cookie.split(';', 1)[0]).join('; ')
}

function setCookieHeader(response: any) {
  const value = response.header('set-cookie')
  return Array.isArray(value) ? value.join('; ') : (value ?? '')
}

test.group('onboarding draft routes', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('vendor search validates intake and delegates with an anonymous session UUID', async ({
    client,
  }) => {
    const originalSearch = OnboardingVendorDiscoveryService.search
    const onboardingToken = uuidv4()
    const draftUuid = uuidv4()
    const projectDescription = 'I need a commercial electrician for a new restaurant buildout.'
    const received: Array<{
      projectDescription: string
      postalCode: string
      anonymousSessionUuid: string
    }> = []

    OnboardingVendorDiscoveryService.search = (async (input) => {
      received.push(input)

      return {
        onboardingToken,
        draftUuid,
        vendorSearches: [{ classification: 'Electrician', query: 'commercial electrician' }],
        vendors: [],
        emptyStateReason: 'NO_VENDOR_RESULTS',
        expiresAt: '2026-06-20T00:00:00.000Z',
      }
    }) as typeof OnboardingVendorDiscoveryService.search

    try {
      const invalidResponse = await client
        .post('/onboarding/vendor-search')
        .json({ projectDescription: 'no', postalCode: '23220' })

      invalidResponse.assertStatus(422)

      const response = await client
        .post('/onboarding/vendor-search')
        .json({ projectDescription, postalCode: '23220' })

      response.assertOk()
      response.assertBodyContains({ onboardingToken, draftUuid, vendors: [] })
      assert.equal(received.length, 1)
      const [searchInput] = received
      assert.ok(searchInput)
      assert.equal(searchInput.projectDescription, projectDescription)
      assert.equal(searchInput.postalCode, '23220')
      assert.equal(validateUuid(searchInput.anonymousSessionUuid), true)
      assert.equal(uuidVersion(searchInput.anonymousSessionUuid), 4)
      assert.match(cookieHeader(response), /adonis-session=/)
    } finally {
      OnboardingVendorDiscoveryService.search = originalSearch
    }
  })

  test('restore returns canonical draft state for an active token', async ({ client }) => {
    const vendor = await VendorListing.create({
      name: 'Vendor A',
      email: 'a@example.com',
      originator: 'SEARCH',
      sourcePayload: { raw: true },
      isActive: true,
    })
    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a general contractor for a cafe renovation.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
      vendorSearches: [{ classification: 'general contractor', query: 'general contractor' }],
      recommendedVendorListingUuids: [vendor.uuid],
    })
    await OnboardingDraftService.updateSelection(tokenUuid, [vendor.uuid])

    const response = await client
      .post('/onboarding/draft/restore')
      .json({ onboardingToken: tokenUuid })

    response.assertOk()
    response.assertBodyContains({
      draftUuid: draft.uuid,
      projectDescription: 'I need a general contractor for a cafe renovation.',
      postalCode: '23220',
      selectedVendorListingUuids: [vendor.uuid],
      step: 'selection',
    })
    assert.equal(response.body().vendors[0].hasEmail, true)
    assert.equal('email' in response.body().vendors[0], false)
    assert.equal('sourcePayload' in response.body().vendors[0], false)
  })

  test('restore preserves a completed empty-results recommendation step', async ({ client }) => {
    const { tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a highly specialized contractor for an unusual renovation.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
    })
    await OnboardingDraftService.updateRecommendations(tokenUuid, {
      vendorSearches: [{ classification: 'Specialist', query: 'specialist contractor' }],
      recommendedVendorListingUuids: [],
    })

    const response = await client
      .post('/onboarding/draft/restore')
      .json({ onboardingToken: tokenUuid })

    response.assertOk()
    response.assertBodyContains({
      step: 'recommendations',
      vendors: [],
      selectedVendorListingUuids: [],
    })
  })

  test('restore rejects invalid UUID v4 tokens', async ({ client }) => {
    const response = await client
      .post('/onboarding/draft/restore')
      .json({ onboardingToken: 'not-a-token' })

    response.assertStatus(422)
  })

  test('vendor selection updates active drafts and enforces candidate membership', async ({
    client,
  }) => {
    const vendor = await VendorListing.create({
      name: 'Vendor A',
      email: null,
      originator: 'SEARCH',
      isActive: true,
    })
    const { tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need flooring and painting for a small office.',
      postalCode: '23226',
      anonymousSessionUuid: uuidv4(),
      recommendedVendorListingUuids: [vendor.uuid],
    })

    const unknownResponse = await client
      .patch('/onboarding/vendor-selection')
      .json({ onboardingToken: tokenUuid, selectedVendorListingUuids: [uuidv4()] })

    unknownResponse.assertStatus(422)

    const successResponse = await client
      .patch('/onboarding/vendor-selection')
      .json({ onboardingToken: tokenUuid, selectedVendorListingUuids: [vendor.uuid] })

    successResponse.assertOk()
    successResponse.assertBodyContains({ selectedCount: 1 })
  })

  test('vendor selection accepts and persists a canonical replacement', async ({ client }) => {
    const superseded = await VendorListing.create({
      name: 'Superseded Recommendation',
      email: 'superseded-selection@example.com',
      originator: 'SEARCH',
      isActive: true,
    })
    const canonical = await VendorListing.create({
      name: 'Canonical Recommendation',
      email: 'canonical-selection@example.com',
      originator: 'VENDOR',
      claimStatus: 'CLAIMED',
      isActive: true,
    })
    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a contractor whose listing may be claimed during selection.',
      postalCode: '23220',
      anonymousSessionUuid: uuidv4(),
      recommendedVendorListingUuids: [superseded.uuid],
    })
    superseded.supersededByVendorListingUuid = canonical.uuid
    await superseded.save()

    const selectionResponse = await client.patch('/onboarding/vendor-selection').json({
      onboardingToken: tokenUuid,
      selectedVendorListingUuids: [canonical.uuid],
    })

    selectionResponse.assertOk()
    selectionResponse.assertBodyContains({ selectedCount: 1 })
    await draft.refresh()
    assert.deepEqual(draft.recommendedVendorListingUuids, [canonical.uuid])
    assert.deepEqual(draft.selectedVendorListingUuids, [canonical.uuid])

    const restoreResponse = await client
      .post('/onboarding/draft/restore')
      .json({ onboardingToken: tokenUuid })
    restoreResponse.assertOk()
    restoreResponse.assertBodyContains({
      selectedVendorListingUuids: [canonical.uuid],
      step: 'selection',
    })
  })

  test('registration handoff stores token server-side and returns a token-free redirect target', async ({
    client,
  }) => {
    const { tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need signage and electrical work for a shop.',
      postalCode: '23227',
      anonymousSessionUuid: uuidv4(),
    })

    const response = await client
      .post('/onboarding/registration-handoff')
      .json({ onboardingToken: tokenUuid })

    response.assertOk()
    response.assertBodyContains({ redirectTo: '/register?accountType=consumer' })
    assert.equal(response.body().redirectTo.includes(tokenUuid), false)
    assert.match(setCookieHeader(response), /HttpOnly/i)
    assert.match(cookieHeader(response), /adonis-session=/)
  })
})
