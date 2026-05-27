import VendorListing from '#models/vendor_listing'
import Vendor from '#models/vendor'
import { VendorRequest } from '../../types/request.js'

export default class VendorService {
  private static readonly DEFAULT_VENDOR_LIMIT = 10
  private static readonly DEFAULT_VENDOR_OFFSET = 0

  /**
   * Get all vendor listings that the user has mapped (chosen) via the vendors table.
   */
  public static async getUserVendors(userUuid: string, limit?: number, offset?: number) {
    return await VendorListing.query()
      .whereHas('vendors', (vendorQuery) => {
        vendorQuery.where('user_uuid', userUuid).where('is_active', true)
      })
      .where('is_active', true)
      .orderBy('name', 'asc')
      .limit(limit ?? this.DEFAULT_VENDOR_LIMIT)
      .offset(offset ?? this.DEFAULT_VENDOR_OFFSET)
  }

  /**
   * Get a single vendor listing by its UUID, scoped to the user's ownership.
   */
  public static async getUserVendorByUuid(userUuid: string, vendorListingUuid: string) {
    const listing = await VendorListing.query()
      .where('uuid', vendorListingUuid)
      .where('is_active', true)
      .whereHas('vendors', (vendorQuery) => {
        vendorQuery.where('user_uuid', userUuid).where('is_active', true)
      })
      .first()

    return listing ?? null
  }

  /**
   * Create a new vendor listing (global) and a vendor mapping (user ownership).
   */
  public static async createVendor(userUuid: string, request: VendorRequest) {
    const listing = await VendorListing.create({
      name: request.name,
      email: request.email,
      originator: 'USER',
      isActive: true,
      modifiedBy: userUuid,
    })

    await Vendor.create({
      userUuid,
      vendorListingUuid: listing.uuid,
      isActive: true,
      modifiedBy: userUuid,
    })

    return listing
  }

  /**
   * Update a vendor listing's fields (name, email) or deactivate the user's mapping.
   * When isActive is set to false, we deactivate the user's Vendor mapping, not the global listing.
   */
  public static async updateVendor(
    userUuid: string,
    vendorListingUuid: string,
    request: Partial<VendorRequest>,
    isOnlyActivatingRecord: boolean
  ) {
    // Find the user's mapping to this listing
    let vendorQuery = Vendor.query()
      .where('user_uuid', userUuid)
      .whereHas('vendorListing', (q) => {
        q.where('uuid', vendorListingUuid)
      })
    if (!isOnlyActivatingRecord) {
      vendorQuery = vendorQuery.where('is_active', true)
    }
    const vendorMapping = await vendorQuery.preload('vendorListing').first()

    if (!vendorMapping) {
      return null
    }

    // Handle deactivation: deactivate the user mapping, not the global listing
    if (request.isActive === false) {
      vendorMapping.isActive = false
      vendorMapping.modifiedBy = userUuid
      await vendorMapping.save()
      return vendorMapping.vendorListing
    }

    // Handle reactivation
    if (isOnlyActivatingRecord && request.isActive === true) {
      vendorMapping.isActive = true
      vendorMapping.modifiedBy = userUuid
      await vendorMapping.save()
    }

    // Update the global listing fields
    const listing = vendorMapping.vendorListing
    if (request.name !== undefined) listing.name = request.name!
    if (request.email !== undefined) listing.email = request.email!
    listing.modifiedBy = userUuid
    await listing.save()

    return listing
  }
}
