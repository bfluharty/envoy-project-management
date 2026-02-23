import Vendor from '#models/vendor'
import { VendorRequest } from '../../types/request.js'

export default class ProjectService {
  private static readonly DEFAULT_PROJECT_LIMIT = 10
  private static readonly DEFAULT_PROJECT_OFFSET = 0

  public static async getVendors(limit?: number, offset?: number) {
    return await Vendor.query()
      .where('is_active', true)
      .orderBy('name', 'asc')
      .limit(limit ?? this.DEFAULT_PROJECT_LIMIT)
      .offset(offset ?? this.DEFAULT_PROJECT_OFFSET)
  }

  public static async getVendorByUuid(vendorUuid: string) {
    const vendor = await Vendor.query()
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
    return await Vendor.create(mappedRequest)
  }

  public static async updateVendor(
    userUuid: string,
    vendorUuid: string,
    request: Partial<VendorRequest>,
    isOnlyActivatingRecord: boolean
  ) {
    let query = Vendor.query().where('uuid', vendorUuid)
    if (!isOnlyActivatingRecord) {
      query = query.andWhere('is_active', true)
    }
    const vendor = await query.first()

    if (!vendor) {
      return { vendor, errors: [] }
    }
    await vendor.merge(this.mapRequest(request, userUuid)).save()

    return await Vendor.query().where('uuid', vendorUuid).first()
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
