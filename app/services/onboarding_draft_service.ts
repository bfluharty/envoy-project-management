import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import VendorListing from '#models/vendor_listing'
import VendorService from '#services/vendor_service'

export const ANONYMOUS_ONBOARDING_SESSION_KEY = 'onboarding.anonymous_session_uuid'
export const ONBOARDING_TOKEN_SESSION_KEY = 'onboarding.token'

export class OnboardingDraftError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 422
  ) {
    super(message)
  }
}

export type CreateDraftInput = {
  projectDescription: string
  postalCode: string
  anonymousSessionUuid: string
  vendorSearches?: unknown[]
  recommendedVendorListingUuids?: string[]
  expiresAt?: DateTime
}

export type RecommendationUpdateInput = {
  vendorSearches?: unknown[]
  recommendedVendorListingUuids?: string[]
}

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && validateUuid(value) && uuidVersion(value) === 4
}

export default class OnboardingDraftService {
  public static getOrCreateAnonymousSessionUuid(session: HttpContext['session']) {
    const existingValue = session.get(ANONYMOUS_ONBOARDING_SESSION_KEY)

    if (isUuidV4(existingValue)) {
      logger.debug('Reusing existing anonymous onboarding session')
      return existingValue
    }

    const anonymousSessionUuid = uuidv4()
    session.put(ANONYMOUS_ONBOARDING_SESSION_KEY, anonymousSessionUuid)
    logger.info('Created anonymous onboarding session')
    return anonymousSessionUuid
  }

  public static async createDraft(input: CreateDraftInput) {
    this.assertUuidV4(input.anonymousSessionUuid, 'Anonymous onboarding session is invalid')
    const abandonedDraftCount = await this.abandonActiveDraftsForAnonymousSession(
      input.anonymousSessionUuid
    )

    const draft = await AnonymousOnboardingDraft.create({
      tokenUuid: uuidv4(),
      projectDescription: input.projectDescription,
      postalCode: input.postalCode,
      vendorSearches: input.vendorSearches ?? [],
      recommendedVendorListingUuids: input.recommendedVendorListingUuids ?? [],
      selectedVendorListingUuids: [],
      status: 'ACTIVE',
      anonymousSessionUuid: input.anonymousSessionUuid,
      registeredUserUuid: null,
      consumedByUserUuid: null,
      consumedProjectUuid: null,
      expiresAt: input.expiresAt ?? DateTime.utc().plus({ hours: 24 }),
    })

    logger.info(
      {
        draftUuid: draft.uuid,
        postalCode: draft.postalCode,
        abandonedDraftCount,
        expiresAt: draft.expiresAt.toISO(),
      },
      'Created anonymous onboarding draft'
    )

    return { draft, tokenUuid: draft.tokenUuid }
  }

  public static async getActiveDraftByToken(token: string) {
    if (!isUuidV4(token)) {
      logger.debug('Rejected invalid onboarding draft token')
      return null
    }

    const draft = await AnonymousOnboardingDraft.query().where('token_uuid', token).first()
    return this.ensureDraftIsActiveAndFresh(draft)
  }

  public static async getActiveDraftByUserUuid(userUuid: string) {
    if (!isUuidV4(userUuid)) {
      logger.debug('Rejected invalid user UUID during onboarding draft lookup')
      return null
    }

    const draft = await AnonymousOnboardingDraft.query()
      .where('registered_user_uuid', userUuid)
      .where('status', 'ACTIVE')
      .orderBy('updated_timestamp', 'desc')
      .first()

    return this.ensureDraftIsActiveAndFresh(draft)
  }

  public static async getConsumedDraftByUserUuid(userUuid: string) {
    if (!isUuidV4(userUuid)) {
      return null
    }

    return AnonymousOnboardingDraft.query()
      .where('registered_user_uuid', userUuid)
      .where('status', 'CONSUMED')
      .whereNotNull('consumed_project_uuid')
      .orderBy('updated_timestamp', 'desc')
      .first()
  }

  public static async getLatestConsumedDraftByUserUuid(userUuid: string) {
    if (!isUuidV4(userUuid)) {
      return null
    }

    return AnonymousOnboardingDraft.query()
      .where('registered_user_uuid', userUuid)
      .where('status', 'CONSUMED')
      .orderBy('updated_timestamp', 'desc')
      .first()
  }

  public static async getExpiredDraftByUserUuid(userUuid: string) {
    if (!isUuidV4(userUuid)) {
      return null
    }

    return AnonymousOnboardingDraft.query()
      .where('registered_user_uuid', userUuid)
      .where('status', 'EXPIRED')
      .orderBy('updated_timestamp', 'desc')
      .first()
  }

  public static async updateRecommendations(token: string, data: RecommendationUpdateInput) {
    const draft = await this.getActiveDraftOrFail(token)
    const recommendedVendorListingUuids =
      data.recommendedVendorListingUuids ?? draft.recommendedVendorListingUuids ?? []
    await this.assertAvailableListingUuids(recommendedVendorListingUuids)

    draft.vendorSearches = data.vendorSearches ?? draft.vendorSearches ?? []
    draft.recommendedVendorListingUuids = recommendedVendorListingUuids
    await draft.save()
    logger.info(
      {
        draftUuid: draft.uuid,
        vendorSearchCount: draft.vendorSearches.length,
        recommendedVendorCount: draft.recommendedVendorListingUuids.length,
      },
      'Updated onboarding draft recommendations'
    )
    return draft
  }

  public static async updateSelection(token: string, selectedVendorListingUuids: string[]) {
    if (selectedVendorListingUuids.length > 8) {
      logger.warn(
        { selectedVendorCount: selectedVendorListingUuids.length },
        'Rejected onboarding vendor selection count'
      )
      throw new OnboardingDraftError('Select up to 8 vendors')
    }

    if (!selectedVendorListingUuids.every(isUuidV4)) {
      throw new OnboardingDraftError('Selected vendor IDs must be UUID v4 values')
    }

    const uniqueVendorListingUuids = new Set(selectedVendorListingUuids)
    if (uniqueVendorListingUuids.size !== selectedVendorListingUuids.length) {
      logger.warn(
        { selectedVendorCount: selectedVendorListingUuids.length },
        'Rejected duplicate onboarding vendor selections'
      )
      throw new OnboardingDraftError('Selected vendor IDs must be unique')
    }

    const draft = await this.getActiveDraftOrFail(token)
    const canonicalRecommendedUuids: string[] = []
    const allowedSelectionUuids = new Set(draft.recommendedVendorListingUuids ?? [])
    for (const recommendedUuid of draft.recommendedVendorListingUuids ?? []) {
      const canonical = await VendorService.resolveCanonicalListing(recommendedUuid)
      if (!canonical?.isActive) continue
      allowedSelectionUuids.add(canonical.uuid)
      if (!canonicalRecommendedUuids.includes(canonical.uuid)) {
        canonicalRecommendedUuids.push(canonical.uuid)
      }
    }

    if (selectedVendorListingUuids.some((uuid) => !allowedSelectionUuids.has(uuid))) {
      logger.warn({ draftUuid: draft.uuid }, 'Rejected unknown onboarding vendor selection')
      throw new OnboardingDraftError('Selected vendor does not exist in this draft')
    }

    const canonicalSelectedUuids: string[] = []
    for (const selectedUuid of selectedVendorListingUuids) {
      const canonical = await VendorService.resolveCanonicalListing(selectedUuid)
      if (!canonical?.isActive) {
        throw new OnboardingDraftError('One or more vendor listings are unavailable')
      }
      if (canonicalSelectedUuids.includes(canonical.uuid)) {
        throw new OnboardingDraftError('Selected vendors must resolve to unique listings')
      }
      canonicalSelectedUuids.push(canonical.uuid)
    }

    draft.recommendedVendorListingUuids = canonicalRecommendedUuids
    draft.selectedVendorListingUuids = canonicalSelectedUuids
    await draft.save()
    logger.info(
      { draftUuid: draft.uuid, selectedVendorCount: draft.selectedVendorListingUuids.length },
      'Updated onboarding draft vendor selection'
    )
    return draft
  }

  public static async associateDraftToUser(token: string, userUuid: string) {
    this.assertUuidV4(userUuid, 'User UUID is invalid')

    const draft = await this.getActiveDraftOrFail(token)
    if (draft.registeredUserUuid && draft.registeredUserUuid !== userUuid) {
      logger.warn({ draftUuid: draft.uuid }, 'Onboarding draft is already associated')
      throw new OnboardingDraftError('Onboarding draft is already associated', 409)
    }

    draft.registeredUserUuid = userUuid
    await draft.save()
    logger.info({ draftUuid: draft.uuid, userUuid }, 'Associated onboarding draft to user')
    return draft
  }

  public static async consumeDraft(token: string, userUuid: string, projectUuid: string) {
    this.assertUuidV4(userUuid, 'User UUID is invalid')
    this.assertUuidV4(projectUuid, 'Project UUID is invalid')

    const draft = await this.getActiveDraftOrFail(token)
    if (draft.registeredUserUuid && draft.registeredUserUuid !== userUuid) {
      logger.warn({ draftUuid: draft.uuid }, 'Rejected onboarding draft consumption by wrong user')
      throw new OnboardingDraftError('Onboarding draft is not associated with this user', 403)
    }

    await this.markDraftConsumed(draft, userUuid, projectUuid)
  }

  public static async consumeDraftByUserUuid(userUuid: string, projectUuid: string) {
    this.assertUuidV4(projectUuid, 'Project UUID is invalid')

    const draft = await this.getActiveDraftByUserUuid(userUuid)
    if (!draft) {
      logger.warn({ userUuid }, 'Active onboarding draft not found for user consumption')
      throw new OnboardingDraftError('Onboarding draft not found', 404)
    }

    await this.markDraftConsumed(draft, userUuid, projectUuid)
  }

  public static async abandonActiveDraftsForAnonymousSession(anonymousSessionUuid: string) {
    this.assertUuidV4(anonymousSessionUuid, 'Anonymous onboarding session is invalid')

    const activeDrafts = await AnonymousOnboardingDraft.query()
      .where('anonymous_session_uuid', anonymousSessionUuid)
      .where('status', 'ACTIVE')
      .select('id')

    if (activeDrafts.length === 0) {
      logger.debug('No active anonymous onboarding drafts to abandon')
      return 0
    }

    await AnonymousOnboardingDraft.query()
      .whereIn(
        'id',
        activeDrafts.map((draft) => draft.id)
      )
      .update({
        status: 'ABANDONED',
        updatedTimestamp: DateTime.utc(),
      })

    logger.info({ abandonedDraftCount: activeDrafts.length }, 'Abandoned active onboarding drafts')
    return activeDrafts.length
  }

  public static async markExpiredDrafts() {
    const now = DateTime.utc()
    const expiredDrafts = await AnonymousOnboardingDraft.query()
      .where('status', 'ACTIVE')
      .where('expires_at', '<=', now.toSQL())
      .select('id')

    if (expiredDrafts.length === 0) {
      logger.debug('No expired anonymous onboarding drafts to mark')
      return 0
    }

    await AnonymousOnboardingDraft.query()
      .whereIn(
        'id',
        expiredDrafts.map((draft) => draft.id)
      )
      .update({
        status: 'EXPIRED',
        updatedTimestamp: now,
      })

    logger.info({ expiredDraftCount: expiredDrafts.length }, 'Marked onboarding drafts expired')
    return expiredDrafts.length
  }

  private static async getActiveDraftOrFail(token: string) {
    this.assertUuidV4(token, 'Onboarding token must be a UUID v4')

    const draft = await this.getActiveDraftByToken(token)
    if (!draft) {
      logger.warn('Active onboarding draft lookup failed')
      throw new OnboardingDraftError('Onboarding draft not found', 404)
    }

    return draft
  }

  private static async ensureDraftIsActiveAndFresh(draft: AnonymousOnboardingDraft | null) {
    if (!draft || draft.status !== 'ACTIVE') {
      logger.debug('Onboarding draft is missing or not active')
      return null
    }

    if (draft.expiresAt.toMillis() <= DateTime.utc().toMillis()) {
      draft.status = 'EXPIRED'
      await draft.save()
      logger.info({ draftUuid: draft.uuid }, 'Expired stale onboarding draft during lookup')
      return null
    }

    return draft
  }

  private static assertUuidV4(value: string, message: string) {
    if (!isUuidV4(value)) {
      throw new OnboardingDraftError(message)
    }
  }

  private static async assertAvailableListingUuids(vendorListingUuids: string[]) {
    if (vendorListingUuids.length === 0) return
    if (!vendorListingUuids.every(isUuidV4)) {
      throw new OnboardingDraftError('Vendor listing IDs must be UUID v4 values')
    }

    const uniqueUuids = [...new Set(vendorListingUuids)]
    if (uniqueUuids.length !== vendorListingUuids.length) {
      throw new OnboardingDraftError('Vendor listing IDs must be unique')
    }

    const availableCount = await VendorListing.query()
      .whereIn('uuid', uniqueUuids)
      .where('is_active', true)
      .whereNull('superseded_by_vendor_listing_uuid')
      .count('* as total')

    if (Number(availableCount[0]?.$extras.total ?? 0) !== uniqueUuids.length) {
      throw new OnboardingDraftError('One or more vendor listings are unavailable')
    }
  }

  private static async markDraftConsumed(
    draft: AnonymousOnboardingDraft,
    userUuid: string,
    projectUuid: string
  ) {
    draft.status = 'CONSUMED'
    draft.consumedByUserUuid = userUuid
    draft.consumedProjectUuid = projectUuid
    await draft.save()
    logger.info({ draftUuid: draft.uuid, userUuid, projectUuid }, 'Consumed onboarding draft')
  }
}
