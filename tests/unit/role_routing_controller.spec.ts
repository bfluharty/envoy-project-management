import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import OnboardingController from '#controllers/web/onboarding_controller'
import VendorOnboardingController from '#controllers/web/vendor_onboarding_controller'
import UserRoleService from '#services/user_role_service'

function makeResponse() {
  return {
    redirect(path?: string) {
      if (path) {
        return { redirectTo: path }
      }

      return {
        toRoute(route: string) {
          return { route }
        },
      }
    },
    ok(payload: unknown) {
      return { statusCode: 200, payload }
    },
  }
}

function makeInertia() {
  return {
    render(component: string, props?: unknown) {
      return { component, props }
    },
  }
}

test.group('role-aware onboarding routing', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubRoles(params: { isVendor: boolean; isApprovedVendor: boolean }) {
    const originalIsVendor = UserRoleService.isVendor
    const originalIsApprovedVendor = UserRoleService.isApprovedVendor
    restores.push(() => {
      UserRoleService.isVendor = originalIsVendor
      UserRoleService.isApprovedVendor = originalIsApprovedVendor
    })

    UserRoleService.isVendor = (async () => params.isVendor) as typeof UserRoleService.isVendor
    UserRoleService.isApprovedVendor = (async () =>
      params.isApprovedVendor) as typeof UserRoleService.isApprovedVendor
  }

  test('root renders landing for anonymous visitors', async () => {
    const result = await new OnboardingController().show({
      auth: { check: async () => false, user: null },
      inertia: makeInertia(),
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, { component: 'landing', props: undefined })
  })

  test('root redirects authenticated consumers to dashboard', async () => {
    stubRoles({ isVendor: false, isApprovedVendor: false })

    const result = await new OnboardingController().show({
      auth: { check: async () => true, user: { uuid: 'consumer-user' } },
      inertia: makeInertia(),
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, { route: 'dashboard' })
  })

  test('root redirects pending vendors to vendor pending', async () => {
    stubRoles({ isVendor: true, isApprovedVendor: false })

    const result = await new OnboardingController().show({
      auth: { check: async () => true, user: { uuid: 'pending-vendor' } },
      inertia: makeInertia(),
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, { redirectTo: '/vendor/pending' })
  })

  test('root redirects approved vendors to vendor listing', async () => {
    stubRoles({ isVendor: true, isApprovedVendor: true })

    const result = await new OnboardingController().show({
      auth: { check: async () => true, user: { uuid: 'approved-vendor' } },
      inertia: makeInertia(),
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, { redirectTo: '/vendor/listing' })
  })

  test('vendor pending redirects consumers to dashboard', async () => {
    stubRoles({ isVendor: false, isApprovedVendor: false })

    const result = await new VendorOnboardingController().pending({
      auth: { getUserOrFail: () => ({ uuid: 'consumer-user' }) },
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, { route: 'dashboard' })
  })

  test('vendor pending returns blocked pending state for unapproved vendors', async () => {
    stubRoles({ isVendor: true, isApprovedVendor: false })

    const result = await new VendorOnboardingController().pending({
      auth: {
        getUserOrFail: () => ({
          uuid: 'pending-vendor',
          fullName: 'Pending Vendor',
          vendorApprovalStatus: 'PENDING',
        }),
      },
      inertia: makeInertia(),
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, {
      component: 'vendors/pending',
      props: { vendorName: 'Pending Vendor', vendorApprovalStatus: 'PENDING' },
    })
  })

  test('vendor pending redirects approved vendors to listing', async () => {
    stubRoles({ isVendor: true, isApprovedVendor: true })

    const result = await new VendorOnboardingController().pending({
      auth: {
        getUserOrFail: () => ({ uuid: 'approved-vendor', vendorApprovalStatus: 'APPROVED' }),
      },
      response: makeResponse(),
    } as any)

    assert.deepEqual(result, { redirectTo: '/vendor/listing' })
  })
})
