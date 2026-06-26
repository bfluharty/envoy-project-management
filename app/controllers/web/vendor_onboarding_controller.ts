import type { HttpContext } from '@adonisjs/core/http'
import UserRoleService from '#services/user_role_service'

export default class VendorOnboardingController {
  async pending({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!(await UserRoleService.isVendor(user))) {
      return response.redirect().toRoute('dashboard')
    }

    if (await UserRoleService.isApprovedVendor(user)) {
      return response.redirect('/vendor/listing')
    }

    return response.ok({
      status: 'PENDING',
      vendorApprovalStatus: user.vendorApprovalStatus ?? 'PENDING',
    })
  }

  async listing({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!(await UserRoleService.isVendor(user))) {
      return response.redirect().toRoute('dashboard')
    }

    if (!(await UserRoleService.isApprovedVendor(user))) {
      return response.redirect('/vendor/pending')
    }

    return response.ok({
      status: 'APPROVED',
      vendorApprovalStatus: user.vendorApprovalStatus,
    })
  }
}
