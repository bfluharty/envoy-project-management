import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'

test.group('consumer route authorization', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('blocks vendor accounts from consumer dashboard, project, and contact routes', async ({
    client,
  }) => {
    const vendorEntitlement = await UserEntitlement.findByOrFail('canonicalName', 'VENDOR')
    const vendor = await User.create({
      fullName: 'Route Authorization Vendor',
      email: `route-authorization-${uuidv4()}@example.com`,
      password: 'Password123!',
      entitlementId: vendorEntitlement.id,
      vendorApprovalStatus: 'PENDING',
      isActive: true,
    })

    const dashboard = await client.get('/dashboard').loginAs(vendor).withInertia()
    dashboard.assertStatus(403)

    const project = await client
      .post('/projects')
      .loginAs(vendor)
      .json({ title: 'Unauthorized Vendor Project' })
    project.assertStatus(403)

    const contacts = await client.get('/contacts').loginAs(vendor).withInertia()
    contacts.assertStatus(403)

    const createContact = await client
      .post('/contacts')
      .loginAs(vendor)
      .json({ name: 'Unauthorized Contact', email: 'unauthorized@example.com' })
    createContact.assertStatus(403)
  })
})
