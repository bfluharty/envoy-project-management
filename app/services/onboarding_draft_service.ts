import type { HttpContext } from '@adonisjs/core/http'
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
      return existingValue
    }

    const anonymousSessionUuid = uuidv4()
    session.put(ANONYMOUS_ONBOARDING_SESSION_KEY, anonymousSessionUuid)
    return anonymousSessionUuid
  }

  public static async createDraft(input: CreateDraftInput) {
    this.assertUuidV4(input.anonymousSessionUuid, 'Anonymous onboarding session is invalid')
    await this.abandonActiveDraftsForAnonymousSession(input.anonymousSessionUuid)

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

    return { draft, tokenUuid: draft.tokenUuid }
  }

  public static async getActiveDraftByToken(token: string) {
    if (!isUuidV4(token)) {
      return null
    }

    const draft = await AnonymousOnboardingDraft.query().where('token_uuid', token).first()
    return this.ensureDraftIsActiveAndFresh(draft)
  }

  public static async getActiveDraftByUserUuid(userUuid: string) {
    if (!isUuidV4(userUuid)) {
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
    return draft
  }

  public static async updateSelection(token: string, selectedCandidateIds: string[]) {
    if (selectedCandidateIds.length < 1 || selectedCandidateIds.length > 8) {
      throw new OnboardingDraftError('Select between 1 and 8 vendors')
    }

    const uniqueCandidateIds = new Set(selectedCandidateIds)
    if (uniqueCandidateIds.size !== selectedCandidateIds.length) {
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
        throw new OnboardingDraftError('Selected vendor does not exist in this draft')
      }

      if (!hasEmail(candidate)) {
        throw new OnboardingDraftError('Selected vendors must have email addresses')
      }

      return candidate
    })

    draft.selectedVendors = selectedVendors
    await draft.save()
    return draft
  }

  public static async associateDraftToUser(token: string, userUuid: string) {
    this.assertUuidV4(userUuid, 'User UUID is invalid')

    const draft = await this.getActiveDraftOrFail(token)
    if (draft.registeredUserUuid && draft.registeredUserUuid !== userUuid) {
      throw new OnboardingDraftError('Onboarding draft is already associated', 409)
    }

    draft.registeredUserUuid = userUuid
    await draft.save()
    return draft
  }

  public static async consumeDraft(token: string, userUuid: string, projectUuid: string) {
    this.assertUuidV4(userUuid, 'User UUID is invalid')
    this.assertUuidV4(projectUuid, 'Project UUID is invalid')

    const draft = await this.getActiveDraftOrFail(token)
    if (draft.registeredUserUuid && draft.registeredUserUuid !== userUuid) {
      throw new OnboardingDraftError('Onboarding draft is not associated with this user', 403)
    }

    await this.markDraftConsumed(draft, userUuid, projectUuid)
  }

  public static async consumeDraftByUserUuid(userUuid: string, projectUuid: string) {
    this.assertUuidV4(projectUuid, 'Project UUID is invalid')

    const draft = await this.getActiveDraftByUserUuid(userUuid)
    if (!draft) {
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

    return activeDrafts.length
  }

  public static async markExpiredDrafts() {
    const now = DateTime.utc()
    const expiredDrafts = await AnonymousOnboardingDraft.query()
      .where('status', 'ACTIVE')
      .where('expires_at', '<=', now.toSQL())
      .select('id')

    if (expiredDrafts.length === 0) {
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

    return expiredDrafts.length
  }

  private static async getActiveDraftOrFail(token: string) {
    this.assertUuidV4(token, 'Onboarding token must be a UUID v4')

    const draft = await this.getActiveDraftByToken(token)
    if (!draft) {
      throw new OnboardingDraftError('Onboarding draft not found', 404)
    }

    return draft
  }

  private static async ensureDraftIsActiveAndFresh(draft: AnonymousOnboardingDraft | null) {
    if (!draft || draft.status !== 'ACTIVE') {
      return null
    }

    if (draft.expiresAt.toMillis() <= DateTime.utc().toMillis()) {
      draft.status = 'EXPIRED'
      await draft.save()
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
  }
}
