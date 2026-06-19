import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { DateTime } from 'luxon'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
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

  test('updates vendor selection only for known email-ready candidates', async () => {
    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a plumber and electrician for a remodel.',
      postalCode: '23223',
      anonymousSessionUuid: uuidv4(),
      recommendedVendors: [
        { candidateId: 'search:vendor-a', name: 'Vendor A', email: 'a@example.com' },
        { candidateId: 'search:vendor-b', name: 'Vendor B', email: 'b@example.com' },
        { candidateId: 'search:vendor-no-email', name: 'No Email Vendor', email: '' },
      ],
    })

    await assert.rejects(
      () => OnboardingDraftService.updateSelection(tokenUuid, ['search:missing']),
      (error: unknown) =>
        error instanceof OnboardingDraftError &&
        error.message === 'Selected vendor does not exist in this draft'
    )

    await assert.rejects(
      () => OnboardingDraftService.updateSelection(tokenUuid, ['search:vendor-no-email']),
      (error: unknown) =>
        error instanceof OnboardingDraftError &&
        error.message === 'Selected vendors must have email addresses'
    )

    await assert.rejects(
      () =>
        OnboardingDraftService.updateSelection(
          tokenUuid,
          Array.from({ length: 9 }, (_, index) => `search:${index}`)
        ),
      (error: unknown) =>
        error instanceof OnboardingDraftError && error.message === 'Select between 1 and 8 vendors'
    )

    const updated = await OnboardingDraftService.updateSelection(tokenUuid, [
      'search:vendor-a',
      'search:vendor-b',
    ])

    assert.deepEqual(
      updated.selectedVendors.map((vendor) => (vendor as { candidateId: string }).candidateId),
      ['search:vendor-a', 'search:vendor-b']
    )

    const reloaded = await AnonymousOnboardingDraft.findOrFail(draft.id)
    assert.equal(reloaded.selectedVendors.length, 2)
  })

  test('cleanup marks expired active drafts and leaves fresh drafts active', async () => {
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
