import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import Currency from '#models/currency'
import OnboardingDraftService from '#services/onboarding_draft_service'
import OnboardingProjectCompletionService, {
  OnboardingProjectCompletionError,
} from '#services/onboarding_project_completion_service'
import { ProjectVendorAttachmentError } from '#services/project_vendor_attachment_service'
import UserRoleService from '#services/user_role_service'
import VendorService from '#services/vendor_service'
import { completeOnboardingProjectValidator } from '#validators/projects_validator'
import { parseDateFields } from '#utils/date_helper'
import type { ProjectRequest } from '../../../types/request.js'

export default class OnboardingProjectController {
  async show({ auth, inertia, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!(await UserRoleService.isConsumer(user))) {
      return response.status(403).send({ error: 'Consumer account required' })
    }

    const draft = await OnboardingDraftService.getActiveDraftByUserUuid(user.uuid)
    if (!draft) {
      const consumedDraft = await OnboardingDraftService.getLatestConsumedDraftByUserUuid(user.uuid)
      if (consumedDraft?.consumedProjectUuid) {
        return response.redirect(`/projects/${consumedDraft.consumedProjectUuid}`)
      }

      if (consumedDraft) {
        logger.error(
          { draftUuid: consumedDraft.uuid, userUuid: user.uuid },
          'Consumed onboarding draft is missing its project UUID'
        )
        return response.status(409).send({
          error: 'Onboarding completion could not recover the created project',
        })
      }

      const expiredDraft = await OnboardingDraftService.getExpiredDraftByUserUuid(user.uuid)
      if (expiredDraft) {
        return inertia.render('onboarding/project', {
          state: 'expired',
          project: null,
          selectedVendors: [],
          currencies: [],
          recovery: {
            dashboardUrl: '/dashboard',
            vendorSearchUrl: '/',
          },
        })
      }

      return response.status(404).send({ error: 'Active onboarding draft not found' })
    }

    const selectedListings = await VendorService.getListingsByUuidsPreservingOrder(
      draft.selectedVendorListingUuids ?? []
    )
    const currencies = await Currency.query().where('is_active', true).orderBy('code', 'asc')

    return inertia.render('onboarding/project', {
      state: 'active',
      project: {
        title: '',
        description: draft.projectDescription,
        location: {
          postalCode: draft.postalCode,
          formatted_address: draft.postalCode,
        },
      },
      selectedVendors: selectedListings.map((listing) =>
        VendorService.toPublicRecommendation(listing)
      ),
      selectedVendorListingUuids: selectedListings.map((listing) => listing.uuid),
      currencies: currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
      })),
      recovery: null,
    })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!(await UserRoleService.isConsumer(user))) {
      return response.status(403).send({ error: 'Consumer account required' })
    }

    if (request.input('onboardingToken') !== undefined) {
      return response.status(422).send({
        error: 'Onboarding tokens are not accepted after authentication',
      })
    }

    const body = parseDateFields(request)
    const projectRequest = await completeOnboardingProjectValidator.validate(body)

    try {
      const result = await OnboardingProjectCompletionService.completeProject(
        user.uuid,
        projectRequest as ProjectRequest
      )

      if (result.status === 'EXPIRED') {
        session.flash(
          'error',
          'Your onboarding draft expired. Start a new project or run a fresh vendor search.'
        )
        return response.redirect('/onboarding/project')
      }

      if (result.status === 'CREATED') {
        if (result.errors?.length) {
          session.flash(
            'partial_success',
            'Project created with errors: ' + result.errors.join('; ')
          )
        } else {
          session.flash('success', 'Project created successfully!')
        }
      }
      return response.redirect(`/projects/${result.projectUuid}`)
    } catch (error) {
      if (error instanceof ProjectVendorAttachmentError) {
        return response.status(error.statusCode).send({
          error: error.message,
          unavailableVendorListingUuids: error.unavailableVendorListingUuids,
        })
      }

      if (error instanceof OnboardingProjectCompletionError) {
        return response.status(error.statusCode).send({ error: error.message })
      }

      logger.error({ err: error, userUuid: user.uuid }, 'Onboarding project completion failed')
      throw error
    }
  }
}
