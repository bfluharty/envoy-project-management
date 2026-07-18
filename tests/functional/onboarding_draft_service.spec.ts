import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { DateTime } from 'luxon'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import VendorListing from '#models/vendor_listing'
import OnboardingDraftService, {
  ANONYMOUS_ONBOARDING_SESSION_KEY,
  OnboardingDraftError,
} from '#services/onboarding_draft_service'

function fakeSession(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial))

  return {
    get(key: string) {
      return values.get(key)
    },
    put(key: string, value: unknown) {
      values.set(key, value)
    },
    value(key: string) {
      return values.get(key)
    },
  }
}

test.group('OnboardingDraftService', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('creates a server-side anonymous session UUID v4 and reuses it', () => {
    const session = fakeSession()

    const first = OnboardingDraftService.getOrCreateAnonymousSessionUuid(session as any)
    const second = OnboardingDraftService.getOrCreateAnonymousSessionUuid(session as any)

    assert.equal(first, second)
    assert.equal(validateUuid(first), true)
    assert.equal(uuidVersion(first), 4)
    assert.equal(session.value(ANONYMOUS_ONBOARDING_SESSION_KEY), first)
  })

  test('creating a new draft abandons prior active drafts for the same anonymous session', async () => {
    const anonymousSessionUuid = uuidv4()
    const first = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a contractor for a small restaurant renovation.',
      postalCode: '23220',
      anonymousSessionUuid,
    })

    const second = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a painter for a retail refresh.',
      postalCode: '23221',
      anonymousSessionUuid,
    })

    const firstReloaded = await AnonymousOnboardingDraft.findOrFail(first.draft.id)
    const secondReloaded = await AnonymousOnboardingDraft.findOrFail(second.draft.id)

    assert.equal(firstReloaded.status, 'ABANDONED')
    assert.equal(secondReloaded.status, 'ACTIVE')
    assert.equal(validateUuid(second.tokenUuid), true)
    assert.equal(uuidVersion(second.tokenUuid), 4)
  })

  test('active lookup lazily expires stale drafts', async () => {
    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need HVAC help for a buildout.',
      postalCode: '23222',
      anonymousSessionUuid: uuidv4(),
      expiresAt: DateTime.utc().minus({ minute: 1 }),
    })

    const activeDraft = await OnboardingDraftService.getActiveDraftByToken(tokenUuid)
    const reloaded = await AnonymousOnboardingDraft.findOrFail(draft.id)

    assert.equal(activeDraft, null)
    assert.equal(reloaded.status, 'EXPIRED')
  })

  test('updates vendor selection only for available recommended listing UUIDs', async () => {
    const vendorA = await VendorListing.create({
      name: 'Vendor A',
      email: 'a@example.com',
      originator: 'SEARCH',
      isActive: true,
    })
    const vendorB = await VendorListing.create({
      name: 'Vendor B',
      email: 'b@example.com',
      originator: 'SEARCH',
      isActive: true,
    })
    const noEmailVendor = await VendorListing.create({
      name: 'No Email Vendor',
      email: null,
      originator: 'SEARCH',
      isActive: true,
    })
    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a plumber and electrician for a remodel.',
      postalCode: '23223',
      anonymousSessionUuid: uuidv4(),
      recommendedVendorListingUuids: [vendorA.uuid, vendorB.uuid, noEmailVendor.uuid],
    })

    await assert.rejects(
      () => OnboardingDraftService.updateSelection(tokenUuid, [uuidv4()]),
      (error: unknown) =>
        error instanceof OnboardingDraftError &&
        error.message === 'Selected vendor does not exist in this draft'
    )

    const noEmailSelection = await OnboardingDraftService.updateSelection(tokenUuid, [
      noEmailVendor.uuid,
    ])
    assert.deepEqual(noEmailSelection.selectedVendorListingUuids, [noEmailVendor.uuid])

    await assert.rejects(
      () =>
        OnboardingDraftService.updateSelection(
          tokenUuid,
          Array.from({ length: 9 }, () => uuidv4())
        ),
      (error: unknown) =>
        error instanceof OnboardingDraftError && error.message === 'Select up to 8 vendors'
    )

    const updated = await OnboardingDraftService.updateSelection(tokenUuid, [
      vendorA.uuid,
      vendorB.uuid,
    ])

    assert.deepEqual(updated.selectedVendorListingUuids, [vendorA.uuid, vendorB.uuid])

    const reloaded = await AnonymousOnboardingDraft.findOrFail(draft.id)
    assert.deepEqual(reloaded.selectedVendorListingUuids, [vendorA.uuid, vendorB.uuid])
  })

  test('rejects unavailable and duplicate recommendation UUIDs', async () => {
    const active = await VendorListing.create({
      name: 'Active Vendor',
      email: null,
      originator: 'SEARCH',
      isActive: true,
    })
    const inactive = await VendorListing.create({
      name: 'Inactive Vendor',
      email: null,
      originator: 'SEARCH',
      isActive: false,
    })
    const { tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need vendors for a commercial renovation project.',
      postalCode: '23223',
      anonymousSessionUuid: uuidv4(),
    })

    await assert.rejects(
      () =>
        OnboardingDraftService.updateRecommendations(tokenUuid, {
          recommendedVendorListingUuids: [active.uuid, active.uuid],
        }),
      (error: unknown) =>
        error instanceof OnboardingDraftError &&
        error.message === 'Vendor listing IDs must be unique'
    )
    await assert.rejects(
      () =>
        OnboardingDraftService.updateRecommendations(tokenUuid, {
          recommendedVendorListingUuids: [inactive.uuid],
        }),
      (error: unknown) =>
        error instanceof OnboardingDraftError &&
        error.message === 'One or more vendor listings are unavailable'
    )
  })

  test('cleanup marks expired active drafts and leaves fresh drafts active', async () => {
    await OnboardingDraftService.markExpiredDrafts()
    const expired = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a roofer for a leak.',
      postalCode: '23224',
      anonymousSessionUuid: uuidv4(),
      expiresAt: DateTime.utc().minus({ hour: 1 }),
    })
    const fresh = await OnboardingDraftService.createDraft({
      projectDescription: 'I need landscaping for a storefront.',
      postalCode: '23225',
      anonymousSessionUuid: uuidv4(),
      expiresAt: DateTime.utc().plus({ hour: 1 }),
    })

    const expiredCount = await OnboardingDraftService.markExpiredDrafts()
    const expiredReloaded = await AnonymousOnboardingDraft.findOrFail(expired.draft.id)
    const freshReloaded = await AnonymousOnboardingDraft.findOrFail(fresh.draft.id)

    assert.equal(expiredCount, 1)
    assert.equal(expiredReloaded.status, 'EXPIRED')
    assert.equal(freshReloaded.status, 'ACTIVE')
  })
})
