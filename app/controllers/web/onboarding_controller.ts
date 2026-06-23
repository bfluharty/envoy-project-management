import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import OnboardingDraftService, {
  ONBOARDING_TOKEN_SESSION_KEY,
  OnboardingDraftError,
} from '#services/onboarding_draft_service'
import OnboardingVendorDiscoveryService, {
  VendorDiscoveryDependencyError,
} from '#services/onboarding_vendor_discovery_service'
import VendorService from '#services/vendor_service'
import UserRoleService from '#services/user_role_service'
import {
  registrationHandoffValidator,
  restoreOnboardingDraftValidator,
  vendorSearchValidator,
  vendorSelectionValidator,
} from '#validators/onboarding_validator'
import {
  anonymousVendorSearchRateLimitRules,
  getClientIp,
  rejectWhenRateLimited,
} from '#utils/rate_limit_utils'

function getDraftStep(draft: {
  recommendedVendorListingUuids: string[]
  selectedVendorListingUuids: string[]
}) {
  if (draft.selectedVendorListingUuids.length > 0) {
    return 'selection'
  }

  if (draft.recommendedVendorListingUuids.length > 0) {
    return 'recommendations'
  }

  return 'intake'
}

async function serializeDraft(draft: {
  uuid: string
  projectDescription: string
  postalCode: string
  vendorSearches: unknown[]
  recommendedVendorListingUuids: string[]
  selectedVendorListingUuids: string[]
  expiresAt: { toISO(): string | null }
}) {
  const recommendedVendorListingUuids = draft.recommendedVendorListingUuids ?? []
  const selectedVendorListingUuids = draft.selectedVendorListingUuids ?? []
  const recommendedListings = await VendorService.getListingsByUuidsPreservingOrder(
    recommendedVendorListingUuids
  )

  return {
    draftUuid: draft.uuid,
    projectDescription: draft.projectDescription,
    postalCode: draft.postalCode,
    vendorSearches: Array.isArray(draft.vendorSearches) ? draft.vendorSearches : [],
    vendors: recommendedListings.map((listing) => VendorService.toPublicRecommendation(listing)),
    selectedVendorListingUuids,
    step: getDraftStep({ recommendedVendorListingUuids, selectedVendorListingUuids }),
    expiresAt: draft.expiresAt.toISO(),
  }
}

export default class OnboardingController {
  async show({ auth, inertia, response }: HttpContext) {
    const isAuthenticated = await auth.check()

    if (!isAuthenticated || !auth.user) {
      return inertia.render('landing')
    }

    if (await UserRoleService.isVendor(auth.user)) {
      if (await UserRoleService.isApprovedVendor(auth.user)) {
        return response.redirect('/vendor/listing')
      }

      return response.redirect('/vendor/pending')
    }

    return response.redirect().toRoute('dashboard')
  }

  async restoreDraft({ request, response }: HttpContext) {
    const { onboardingToken } = await request.validateUsing(restoreOnboardingDraftValidator)
    const draft = await OnboardingDraftService.getActiveDraftByToken(onboardingToken)

    if (!draft) {
      logger.warn('Onboarding draft restore requested for missing or inactive draft')
      return response.notFound({ error: 'Onboarding draft not found' })
    }

    const serializedDraft = await serializeDraft(draft)
    logger.info(
      {
        draftUuid: serializedDraft.draftUuid,
        step: serializedDraft.step,
        vendorCount: serializedDraft.vendors.length,
        selectedVendorCount: serializedDraft.selectedVendorListingUuids.length,
      },
      'Restored onboarding draft'
    )

    return response.ok(serializedDraft)
  }

  async searchVendors({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(vendorSearchValidator)
    const anonymousSessionUuid = OnboardingDraftService.getOrCreateAnonymousSessionUuid(session)
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      anonymousVendorSearchRateLimitRules({
        anonymousSessionUuid,
        ip: getClientIp(request),
      })
    )
    if (rateLimitResponse) return rateLimitResponse

    logger.info(
      {
        postalCode: payload.postalCode,
        projectDescriptionLength: payload.projectDescription.length,
      },
      'Received onboarding vendor search request'
    )

    try {
      const result = await OnboardingVendorDiscoveryService.search({
        projectDescription: payload.projectDescription,
        postalCode: payload.postalCode,
        anonymousSessionUuid,
      })

      logger.info(
        {
          draftUuid: result.draftUuid,
          vendorSearchCount: result.vendorSearches.length,
          vendorCount: result.vendors.length,
          emptyStateReason: result.emptyStateReason,
        },
        'Completed onboarding vendor search request'
      )

      return response.ok(result)
    } catch (error) {
      if (error instanceof VendorDiscoveryDependencyError) {
        logger.warn(
          { err: error },
          'Onboarding vendor search failed with retryable dependency error'
        )
        return response.status(502).send({
          error: error.message,
          retryable: true,
        })
      }

      throw error
    }
  }

  async updateSelection({ request, response }: HttpContext) {
    const { onboardingToken, selectedVendorListingUuids } =
      await request.validateUsing(vendorSelectionValidator)

    try {
      const draft = await OnboardingDraftService.updateSelection(
        onboardingToken,
        selectedVendorListingUuids
      )

      logger.info(
        { selectedVendorCount: draft.selectedVendorListingUuids.length },
        'Updated onboarding vendor selection'
      )

      return response.ok({
        selectedCount: draft.selectedVendorListingUuids.length,
        expiresAt: draft.expiresAt.toISO(),
      })
    } catch (error) {
      if (error instanceof OnboardingDraftError) {
        logger.warn(
          { err: error, statusCode: error.statusCode },
          'Onboarding vendor selection failed'
        )
        if (error.statusCode === 404) {
          return response.notFound({ error: error.message })
        }

        return response.status(error.statusCode).send({ error: error.message })
      }

      throw error
    }
  }

  async registrationHandoff({ request, response, session }: HttpContext) {
    const { onboardingToken } = await request.validateUsing(registrationHandoffValidator)
    const draft = await OnboardingDraftService.getActiveDraftByToken(onboardingToken)

    if (!draft) {
      logger.warn('Onboarding registration handoff requested for missing or inactive draft')
      return response.notFound({ error: 'Onboarding draft not found' })
    }

    OnboardingDraftService.getOrCreateAnonymousSessionUuid(session)
    session.put(ONBOARDING_TOKEN_SESSION_KEY, onboardingToken)

    logger.info({ draftUuid: draft.uuid }, 'Prepared onboarding registration handoff')

    return response.ok({ redirectTo: '/register?accountType=consumer' })
  }
}
