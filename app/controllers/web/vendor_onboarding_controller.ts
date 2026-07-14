import type { HttpContext } from '@adonisjs/core/http'
import UserRoleService from '#services/user_role_service'

export default class VendorOnboardingController {
  async pending({ auth, inertia, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!(await UserRoleService.isVendor(user))) {
      return response.redirect().toRoute('dashboard')
    }

    if (await UserRoleService.isApprovedVendor(user)) {
      return response.redirect('/vendor/listing')
    }

    return inertia.render('vendors/pending', {
      vendorName: user.fullName,
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
