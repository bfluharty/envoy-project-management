import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import ProjectService from '#services/project_service'
import ProjectVendorAttachmentService from '#services/project_vendor_attachment_service'
import VendorService from '#services/vendor_service'
import type { ProjectRequest } from '../../types/request.js'
import { normalizeVendorListingEmail } from '#utils/vendor_listing_utils'

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

export type OnboardingVendorEmailUpdate = {
  vendorListingUuid: string
  email: string
}

export type OnboardingProjectCompletionOptions = {
  selectedVendorListingUuids?: string[]
  vendorEmailUpdates?: OnboardingVendorEmailUpdate[]
}

export default class OnboardingProjectCompletionService {
  public static async completeProject(
    userUuid: string,
    projectRequest: ProjectRequest,
    options: OnboardingProjectCompletionOptions = {}
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

      const selectedVendorListingUuids = await this.resolveSelectedVendorListingUuids(
        draft.selectedVendorListingUuids ?? [],
        options.selectedVendorListingUuids,
        trx
      )

      await this.applyVendorEmailUpdates(
        userUuid,
        selectedVendorListingUuids,
        options.vendorEmailUpdates ?? [],
        trx
      )
      await this.assertSelectedVendorsHaveEmail(selectedVendorListingUuids, trx)

      const project = await ProjectService.createProjectInTransaction(userUuid, projectRequest, trx)
      const attachment = await ProjectVendorAttachmentService.attachListingsInTransaction(
        userUuid,
        project.uuid,
        selectedVendorListingUuids,
        trx,
        { skipUnavailable: true }
      )

      draft.useTransaction(trx)
      draft.selectedVendorListingUuids = selectedVendorListingUuids
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

  private static async resolveSelectedVendorListingUuids(
    draftSelectedVendorListingUuids: string[],
    requestedSelectedVendorListingUuids: string[] | undefined,
    trx: TransactionClientContract
  ) {
    const requestedVendorListingUuids =
      requestedSelectedVendorListingUuids ?? draftSelectedVendorListingUuids

    if (requestedVendorListingUuids.length < 1 || requestedVendorListingUuids.length > 8) {
      throw new OnboardingProjectCompletionError('Select between 1 and 8 vendors', 422)
    }

    const uniqueRequestedUuids = new Set(requestedVendorListingUuids)
    if (uniqueRequestedUuids.size !== requestedVendorListingUuids.length) {
      throw new OnboardingProjectCompletionError('Selected vendors must be unique', 422)
    }

    const allowedSelectionUuids = new Set(draftSelectedVendorListingUuids)
    for (const draftSelectedUuid of draftSelectedVendorListingUuids) {
      const canonical = await VendorService.resolveCanonicalListing(draftSelectedUuid, trx)
      if (canonical?.isActive) {
        allowedSelectionUuids.add(canonical.uuid)
      }
    }

    const canonicalSelectedUuids: string[] = []
    for (const requestedUuid of requestedVendorListingUuids) {
      if (!allowedSelectionUuids.has(requestedUuid)) {
        throw new OnboardingProjectCompletionError(
          'Selected vendor does not exist in this onboarding draft',
          422
        )
      }

      const canonical = await VendorService.resolveCanonicalListing(requestedUuid, trx)
      const selectedUuid = canonical?.isActive ? canonical.uuid : requestedUuid
      if (canonicalSelectedUuids.includes(selectedUuid)) {
        throw new OnboardingProjectCompletionError(
          'Selected vendors must resolve to unique listings',
          422
        )
      }

      canonicalSelectedUuids.push(selectedUuid)
    }

    return canonicalSelectedUuids
  }

  private static async applyVendorEmailUpdates(
    userUuid: string,
    selectedVendorListingUuids: string[],
    vendorEmailUpdates: OnboardingVendorEmailUpdate[],
    trx: TransactionClientContract
  ) {
    if (vendorEmailUpdates.length === 0) return

    const selectedVendorListingUuidSet = new Set(selectedVendorListingUuids)
    const seenUpdateUuids = new Set<string>()

    for (const update of vendorEmailUpdates) {
      if (seenUpdateUuids.has(update.vendorListingUuid)) {
        throw new OnboardingProjectCompletionError(
          'Vendor contact email updates must be unique',
          422
        )
      }
      seenUpdateUuids.add(update.vendorListingUuid)

      const listing = await VendorService.resolveCanonicalListing(
        update.vendorListingUuid,
        trx,
        true
      )
      const targetVendorListingUuid = listing?.isActive ? listing.uuid : update.vendorListingUuid
      if (!selectedVendorListingUuidSet.has(targetVendorListingUuid)) {
        throw new OnboardingProjectCompletionError(
          'Vendor contact email updates must match selected vendors',
          422
        )
      }

      if (!listing?.isActive || listing.supersededByVendorListingUuid) {
        continue
      }

      if (normalizeVendorListingEmail(listing.email)) {
        continue
      }

      const email = normalizeVendorListingEmail(update.email)
      if (!email) {
        throw new OnboardingProjectCompletionError('Vendor contact email is required', 422)
      }

      const canUpdateListing =
        listing.originator === 'SEARCH' &&
        listing.claimStatus !== 'CLAIMED' &&
        (!listing.ownerUserUuid || listing.ownerUserUuid === userUuid)
      if (!canUpdateListing) {
        throw new OnboardingProjectCompletionError(
          `Contact details for ${listing.name} cannot be updated. Remove this vendor or choose another one.`,
          422
        )
      }

      listing.useTransaction(trx)
      listing.email = email
      if (!listing.ownerUserUuid) {
        listing.ownerUserUuid = userUuid
      }
      listing.modifiedBy = userUuid
      await listing.save()
    }
  }

  private static async assertSelectedVendorsHaveEmail(
    selectedVendorListingUuids: string[],
    trx: TransactionClientContract
  ) {
    const missingContactDetailNames: string[] = []

    for (const selectedUuid of selectedVendorListingUuids) {
      const listing = await VendorService.resolveCanonicalListing(selectedUuid, trx)
      if (!listing?.isActive || listing.supersededByVendorListingUuid) {
        continue
      }

      if (!normalizeVendorListingEmail(listing.email)) {
        missingContactDetailNames.push(listing.name)
      }
    }

    if (missingContactDetailNames.length > 0) {
      throw new OnboardingProjectCompletionError(
        `Add contact email or remove ${
          missingContactDetailNames.length === 1
            ? missingContactDetailNames[0]
            : `${missingContactDetailNames.length} selected vendors`
        } before continuing.`,
        422
      )
    }
  }
}
