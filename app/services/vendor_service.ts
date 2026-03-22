import Vendor from '#models/vendor'
import { VendorRequest } from '../../types/request.js'

export default class VendorService {
  private static readonly DEFAULT_VENDOR_LIMIT = 10
  private static readonly DEFAULT_VENDOR_OFFSET = 0

  public static async getUserVendors(userUuid: string, limit?: number, offset?: number) {
    return await Vendor.query()
      .where('user_uuid', userUuid)
      .andWhere('is_active', true)
      .orderBy('name', 'asc')
      .limit(limit ?? this.DEFAULT_VENDOR_LIMIT)
      .offset(offset ?? this.DEFAULT_VENDOR_OFFSET)
  }

  public static async getUserVendorByUuid(userUuid: string, vendorUuid: string) {
    const vendor = await Vendor.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', vendorUuid)
      .andWhere('is_active', true)
      .first()

    if (!vendor) {
      return null
    }

    return vendor
  }

  public static async createVendor(userUuid: string, request: VendorRequest) {
    const mappedRequest = this.mapRequest(request, userUuid)
    mappedRequest['createdBy'] = userUuid
    mappedRequest['userUuid'] = userUuid
    return await Vendor.create(mappedRequest)
  }

  public static async updateVendor(
    userUuid: string,
    vendorUuid: string,
    request: Partial<VendorRequest>,
    isOnlyActivatingRecord: boolean
  ) {
    let query = Vendor.query().where('user_uuid', userUuid).andWhere('uuid', vendorUuid)
    if (!isOnlyActivatingRecord) {
      query = query.andWhere('is_active', true)
    }
    const vendor = await query.first()

    if (!vendor) {
      return { vendor, errors: [] }
    }
    await vendor.merge(this.mapRequest(request, userUuid)).save()

    return await Vendor.query().where('user_uuid', userUuid).andWhere('uuid', vendorUuid).first()
  }

  private static mapRequest(request: Partial<VendorRequest>, userUuid?: string): any {
    return {
      name: request.name,
      email: request.email,
      isActive: request.isActive ?? true,
      modifiedBy: userUuid,
    }
  }
}
