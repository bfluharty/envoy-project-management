import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import VendorService from '#services/vendor_service'

const MAX_VENDOR_ATTACHMENTS = 8

export class ProjectVendorAttachmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly unavailableVendorListingUuids: string[] = []
  ) {
    super(message)
    this.name = 'ProjectVendorAttachmentError'
  }
}

export type AttachedProjectVendor = {
  vendorListingUuid: string
  vendorUuid: string
  projectVendorUuid: string
}

type AttachmentOptions = {
  skipUnavailable?: boolean
}

export type ProjectVendorAttachmentResult = {
  projectUuid: string
  vendors: AttachedProjectVendor[]
  unavailableVendorListingUuids: string[]
}

export default class ProjectVendorAttachmentService {
  public static async attachListings(
    userUuid: string,
    projectUuid: string,
    vendorListingUuids: string[]
  ) {
    const result = await db.transaction((trx) =>
      this.attachListingsInTransaction(userUuid, projectUuid, vendorListingUuids, trx)
    )

    logger.info(
      {
        userUuid,
        projectUuid,
        attachedVendorCount: result.vendors.length,
      },
      'Attached vendor listings to project'
    )
    return result
  }

  public static async attachListingsInTransaction(
    userUuid: string,
    projectUuid: string,
    vendorListingUuids: string[],
    trx: TransactionClientContract,
    options: AttachmentOptions = {}
  ): Promise<ProjectVendorAttachmentResult> {
    if (vendorListingUuids.length < 1 || vendorListingUuids.length > MAX_VENDOR_ATTACHMENTS) {
      throw new ProjectVendorAttachmentError('Attach between 1 and 8 vendor listings', 422)
    }

    const project = await Project.query()
      .useTransaction(trx)
      .where('uuid', projectUuid)
      .where('user_uuid', userUuid)
      .where('is_active', true)
      .forUpdate()
      .first()
    if (!project) {
      throw new ProjectVendorAttachmentError('Project not found', 404)
    }

    const uniqueRequestedUuids = [...new Set(vendorListingUuids)]
    const canonicalByRequestedUuid = new Map<string, string>()
    const unavailableVendorListingUuids: string[] = []

    for (const requestedUuid of uniqueRequestedUuids) {
      const canonical = await VendorService.resolveCanonicalListing(requestedUuid, trx)
      if (!canonical?.isActive) {
        unavailableVendorListingUuids.push(requestedUuid)
        continue
      }
      canonicalByRequestedUuid.set(requestedUuid, canonical.uuid)
    }

    if (unavailableVendorListingUuids.length > 0 && !options.skipUnavailable) {
      throw new ProjectVendorAttachmentError(
        'One or more vendor listings are unavailable',
        422,
        unavailableVendorListingUuids
      )
    }

    const canonicalUuids = [...new Set(canonicalByRequestedUuid.values())].sort()
    const attachedVendors: AttachedProjectVendor[] = []
    const attachedListingUuids = new Set<string>()

    const markCanonicalUnavailable = (canonicalUuid: string) => {
      const requestedUuids = [...canonicalByRequestedUuid.entries()]
        .filter(([, resolvedUuid]) => resolvedUuid === canonicalUuid)
        .map(([requestedUuid]) => requestedUuid)
      unavailableVendorListingUuids.push(
        ...(requestedUuids.length ? requestedUuids : [canonicalUuid])
      )
    }

    for (const canonicalUuid of canonicalUuids) {
      const listing = await VendorService.resolveCanonicalListing(canonicalUuid, trx, true)
      if (!listing?.isActive || listing.supersededByVendorListingUuid) {
        if (!options.skipUnavailable) {
          throw new ProjectVendorAttachmentError(
            'One or more vendor listings are unavailable',
            422,
            [canonicalUuid]
          )
        }
        markCanonicalUnavailable(canonicalUuid)
        continue
      }
      if (attachedListingUuids.has(listing.uuid)) continue
      attachedListingUuids.add(listing.uuid)

      await VendorService.adoptOwnerlessNoEmailSearchListing(userUuid, listing.uuid, trx)
      const mapping = await VendorService.ensureUserVendorMapping(userUuid, listing.uuid, trx)
      if (!mapping) {
        if (!options.skipUnavailable) {
          throw new ProjectVendorAttachmentError(
            'One or more vendor listings are unavailable',
            422,
            [listing.uuid]
          )
        }
        markCanonicalUnavailable(canonicalUuid)
        continue
      }

      let projectVendor = await ProjectVendor.query()
        .useTransaction(trx)
        .where('project_uuid', projectUuid)
        .where('vendor_uuid', mapping.uuid)
        .first()

      if (projectVendor) {
        if (!projectVendor.isActive) {
          projectVendor.useTransaction(trx)
          projectVendor.isActive = true
          await projectVendor.save()
        }
      } else {
        projectVendor = await ProjectVendor.create(
          {
            projectUuid,
            vendorUuid: mapping.uuid,
            isActive: true,
          },
          { client: trx }
        )
      }

      attachedVendors.push({
        vendorListingUuid: listing.uuid,
        vendorUuid: mapping.uuid,
        projectVendorUuid: projectVendor.uuid,
      })
    }

    return {
      projectUuid,
      vendors: attachedVendors,
      unavailableVendorListingUuids: [...new Set(unavailableVendorListingUuids)],
    }
  }
}
