import UserEntitlement from '#models/user_entitlement'
import type User from '#models/user'

type RoleCheckedUser = Pick<User, 'entitlementId' | 'vendorApprovalStatus'>

export default class UserRoleService {
  public static async getCanonicalName(user: RoleCheckedUser) {
    const entitlement = await UserEntitlement.query()
      .where('id', user.entitlementId)
      .where('is_active', true)
      .first()

    return entitlement?.canonicalName ?? null
  }

  public static async isConsumer(user: RoleCheckedUser) {
    return (await this.getCanonicalName(user)) === 'CONSUMER'
  }

  public static async isVendor(user: RoleCheckedUser) {
    return (await this.getCanonicalName(user)) === 'VENDOR'
  }

  public static async isApprovedVendor(user: RoleCheckedUser) {
    return (await this.isVendor(user)) && user.vendorApprovalStatus === 'APPROVED'
  }
}
