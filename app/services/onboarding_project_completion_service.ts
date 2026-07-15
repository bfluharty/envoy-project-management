import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import ProjectService from '#services/project_service'
import ProjectVendorAttachmentService from '#services/project_vendor_attachment_service'
import type { ProjectRequest } from '../../types/request.js'

export class OnboardingProjectCompletionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'OnboardingProjectCompletionError'
  }
}

export type OnboardingProjectCompletionResult =
  | {
      status: 'CREATED' | 'ALREADY_CONSUMED'
      projectUuid: string
      linkedVendorCount: number
      warnings?: string[]
      unavailableVendorListingUuids?: string[]
    }
  | {
      status: 'EXPIRED'
      projectUuid: null
      linkedVendorCount: 0
    }

export default class OnboardingProjectCompletionService {
  public static async completeProject(
    userUuid: string,
    projectRequest: ProjectRequest
  ): Promise<OnboardingProjectCompletionResult> {
    const result = await db.transaction<OnboardingProjectCompletionResult>(async (trx) => {
      const draft = await AnonymousOnboardingDraft.query()
        .useTransaction(trx)
        .where('registered_user_uuid', userUuid)
        .where('status', 'ACTIVE')
        .orderBy('updated_timestamp', 'desc')
        .forUpdate()
        .first()

      if (!draft) {
        const consumedDraft = await AnonymousOnboardingDraft.query()
          .useTransaction(trx)
          .where('registered_user_uuid', userUuid)
          .where('status', 'CONSUMED')
          .orderBy('updated_timestamp', 'desc')
          .first()

        if (consumedDraft?.consumedProjectUuid) {
          return {
            status: 'ALREADY_CONSUMED',
            projectUuid: consumedDraft.consumedProjectUuid,
            linkedVendorCount: 0,
          }
        }

        if (consumedDraft) {
          logger.error(
            { draftUuid: consumedDraft.uuid, userUuid },
            'Consumed onboarding draft is missing its project UUID'
          )
          throw new OnboardingProjectCompletionError(
            'Onboarding completion could not recover the created project',
            409
          )
        }

        const expiredDraft = await AnonymousOnboardingDraft.query()
          .useTransaction(trx)
          .where('registered_user_uuid', userUuid)
          .where('status', 'EXPIRED')
          .orderBy('updated_timestamp', 'desc')
          .first()

        if (expiredDraft) {
          return { status: 'EXPIRED', projectUuid: null, linkedVendorCount: 0 }
        }

        throw new OnboardingProjectCompletionError('Active onboarding draft not found', 404)
      }

      if (draft.expiresAt.toMillis() <= DateTime.utc().toMillis()) {
        draft.useTransaction(trx)
        draft.status = 'EXPIRED'
        await draft.save()
        return { status: 'EXPIRED', projectUuid: null, linkedVendorCount: 0 }
      }

      const project = await ProjectService.createProjectInTransaction(userUuid, projectRequest, trx)
      const attachment = await ProjectVendorAttachmentService.attachListingsInTransaction(
        userUuid,
        project.uuid,
        draft.selectedVendorListingUuids ?? [],
        trx,
        { skipUnavailable: true }
      )

      draft.useTransaction(trx)
      draft.status = 'CONSUMED'
      draft.consumedByUserUuid = userUuid
      draft.consumedProjectUuid = project.uuid
      await draft.save()

      return {
        status: 'CREATED',
        projectUuid: project.uuid,
        linkedVendorCount: attachment.vendors.length,
        unavailableVendorListingUuids: attachment.unavailableVendorListingUuids,
        warnings:
          attachment.unavailableVendorListingUuids.length > 0
            ? [
                `${attachment.unavailableVendorListingUuids.length} selected vendor${
                  attachment.unavailableVendorListingUuids.length === 1 ? '' : 's'
                } could not be linked because the listing was no longer available.`,
              ]
            : undefined,
      }
    })

    return result
  }
}
