import type { HttpContext } from '@adonisjs/core/http'
import OnboardingDraftService, {
  ONBOARDING_TOKEN_SESSION_KEY,
  OnboardingDraftError,
} from '#services/onboarding_draft_service'
import OnboardingVendorDiscoveryService, {
  VendorDiscoveryDependencyError,
  stripVendorSourcePayloads,
} from '#services/onboarding_vendor_discovery_service'
import UserRoleService from '#services/user_role_service'
import {
  registrationHandoffValidator,
  restoreOnboardingDraftValidator,
  vendorSearchValidator,
  vendorSelectionValidator,
} from '#validators/onboarding_validator'

function getCandidateId(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const candidateId = (candidate as { candidateId?: unknown }).candidateId
  return typeof candidateId === 'string' && candidateId.trim() ? candidateId.trim() : null
}

function getSelectedCandidateIds(selectedVendors: unknown[]) {
  return selectedVendors.map((vendor) => getCandidateId(vendor)).filter((id): id is string => !!id)
}

function getDraftStep(draft: { recommendedVendors: unknown[]; selectedVendors: unknown[] }) {
  if (draft.selectedVendors.length > 0) {
    return 'selection'
  }

  if (draft.recommendedVendors.length > 0) {
    return 'recommendations'
  }

  return 'intake'
}

function serializeDraft(draft: {
  uuid: string
  projectDescription: string
  postalCode: string
  vendorSearches: unknown[]
  recommendedVendors: unknown[]
  selectedVendors: unknown[]
  expiresAt: { toISO(): string | null }
}) {
  const selectedVendors = Array.isArray(draft.selectedVendors) ? draft.selectedVendors : []
  const recommendedVendors = Array.isArray(draft.recommendedVendors) ? draft.recommendedVendors : []

  return {
    draftUuid: draft.uuid,
    projectDescription: draft.projectDescription,
    postalCode: draft.postalCode,
    vendorSearches: Array.isArray(draft.vendorSearches) ? draft.vendorSearches : [],
    vendors: stripVendorSourcePayloads(recommendedVendors),
    selectedCandidateIds: getSelectedCandidateIds(selectedVendors),
    step: getDraftStep({ recommendedVendors, selectedVendors }),
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
      return response.notFound({ error: 'Onboarding draft not found' })
    }

    return response.ok(serializeDraft(draft))
  }

  async searchVendors({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(vendorSearchValidator)
    const anonymousSessionUuid = OnboardingDraftService.getOrCreateAnonymousSessionUuid(session)

    try {
      return response.ok(
        await OnboardingVendorDiscoveryService.search({
          projectDescription: payload.projectDescription,
          postalCode: payload.postalCode,
          anonymousSessionUuid,
        })
      )
    } catch (error) {
      if (error instanceof VendorDiscoveryDependencyError) {
        return response.status(502).send({
          error: error.message,
          retryable: true,
        })
      }

      throw error
    }
  }

  async updateSelection({ request, response }: HttpContext) {
    const { onboardingToken, selectedCandidateIds } =
      await request.validateUsing(vendorSelectionValidator)

    try {
      const draft = await OnboardingDraftService.updateSelection(
        onboardingToken,
        selectedCandidateIds
      )

      return response.ok({
        selectedCount: draft.selectedVendors.length,
        expiresAt: draft.expiresAt.toISO(),
      })
    } catch (error) {
      if (error instanceof OnboardingDraftError) {
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
      return response.notFound({ error: 'Onboarding draft not found' })
    }

    OnboardingDraftService.getOrCreateAnonymousSessionUuid(session)
    session.put(ONBOARDING_TOKEN_SESSION_KEY, onboardingToken)

    return response.ok({ redirectTo: '/register?accountType=consumer' })
  }
}
