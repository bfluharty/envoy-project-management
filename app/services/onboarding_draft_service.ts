import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { validate as validateUuid, version as uuidVersion, v4 as uuidv4 } from 'uuid'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'

export const ANONYMOUS_ONBOARDING_SESSION_KEY = 'onboarding.anonymous_session_uuid'
export const ONBOARDING_TOKEN_SESSION_KEY = 'onboarding.token'

export type OnboardingDraftCandidate = {
  candidateId?: unknown
  email?: unknown
  [key: string]: unknown
}

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
  recommendedVendors?: unknown[]
  expiresAt?: DateTime
}

export type RecommendationUpdateInput = {
  vendorSearches?: unknown[]
  recommendedVendors?: unknown[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getCandidateId(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const candidateId = (candidate as OnboardingDraftCandidate).candidateId
  return isNonEmptyString(candidateId) ? candidateId.trim() : null
}

function hasEmail(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object') {
    return false
  }

  return isNonEmptyString((candidate as OnboardingDraftCandidate).email)
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
      recommendedVendors: input.recommendedVendors ?? [],
      selectedVendors: [],
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

  public static async updateRecommendations(token: string, data: RecommendationUpdateInput) {
    const draft = await this.getActiveDraftOrFail(token)
    draft.vendorSearches = data.vendorSearches ?? draft.vendorSearches ?? []
    draft.recommendedVendors = data.recommendedVendors ?? draft.recommendedVendors ?? []
    await draft.save()
    logger.info(
      {
        draftUuid: draft.uuid,
        vendorSearchCount: draft.vendorSearches.length,
        recommendedVendorCount: draft.recommendedVendors.length,
      },
      'Updated onboarding draft recommendations'
    )
    return draft
  }

  public static async updateSelection(token: string, selectedCandidateIds: string[]) {
    if (selectedCandidateIds.length < 1 || selectedCandidateIds.length > 8) {
      logger.warn(
        { selectedCandidateCount: selectedCandidateIds.length },
        'Rejected onboarding vendor selection count'
      )
      throw new OnboardingDraftError('Select between 1 and 8 vendors')
    }

    const uniqueCandidateIds = new Set(selectedCandidateIds)
    if (uniqueCandidateIds.size !== selectedCandidateIds.length) {
      logger.warn(
        { selectedCandidateCount: selectedCandidateIds.length },
        'Rejected duplicate onboarding vendor selections'
      )
      throw new OnboardingDraftError('Selected vendor IDs must be unique')
    }

    const draft = await this.getActiveDraftOrFail(token)
    const recommendedVendors = Array.isArray(draft.recommendedVendors)
      ? draft.recommendedVendors
      : []
    const candidatesById = new Map<string, unknown>()

    for (const candidate of recommendedVendors) {
      const candidateId = getCandidateId(candidate)
      if (candidateId) {
        candidatesById.set(candidateId, candidate)
      }
    }

    const selectedVendors = selectedCandidateIds.map((candidateId) => {
      const candidate = candidatesById.get(candidateId)

      if (!candidate) {
        logger.warn({ draftUuid: draft.uuid }, 'Rejected unknown onboarding vendor selection')
        throw new OnboardingDraftError('Selected vendor does not exist in this draft')
      }

      if (!hasEmail(candidate)) {
        logger.warn({ draftUuid: draft.uuid }, 'Rejected onboarding vendor selection without email')
        throw new OnboardingDraftError('Selected vendors must have email addresses')
      }

      return candidate
    })

    draft.selectedVendors = selectedVendors
    await draft.save()
    logger.info(
      { draftUuid: draft.uuid, selectedVendorCount: draft.selectedVendors.length },
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
