import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import Vendor from '#models/vendor'
import ProjectVendorAttachmentService, {
  ProjectVendorAttachmentError,
} from '#services/project_vendor_attachment_service'
import VendorService from '#services/vendor_service'

test.group('ProjectVendorAttachmentService', (group) => {
  let firstUser: User
  let secondUser: User
  let firstProject: Project
  let secondProject: Project

  group.setup(() => testUtils.db().truncate())
  group.setup(async () => {
    const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
    firstUser = await User.create({
      fullName: 'Attachment First Consumer',
      email: `attachment-first-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: entitlement.id,
      isActive: true,
    })
    secondUser = await User.create({
      fullName: 'Attachment Second Consumer',
      email: `attachment-second-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: entitlement.id,
      isActive: true,
    })
    firstProject = await Project.create({
      title: 'First Attachment Project',
      userUuid: firstUser.uuid,
      isActive: true,
    })
    secondProject = await Project.create({
      title: 'Second Attachment Project',
      userUuid: secondUser.uuid,
      isActive: true,
    })
  })

  async function createSearchListing(email: string | null) {
    return VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `attachment-${uuidv4()}`,
      name: `Attachment Vendor ${uuidv4()}`,
      email,
      categories: ['Contractor'],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: { postcode: '23220' },
      sourcePayload: {},
    })
  }

  test('creates idempotent contact and project mappings from listing UUIDs', async () => {
    const listing = await createSearchListing('idempotent-attachment@example.com')

    const first = await ProjectVendorAttachmentService.attachListings(
      firstUser.uuid,
      firstProject.uuid,
      [listing.uuid, listing.uuid]
    )
    const second = await ProjectVendorAttachmentService.attachListings(
      firstUser.uuid,
      firstProject.uuid,
      [listing.uuid]
    )

    assert.equal(first.vendors.length, 1)
    assert.deepEqual(second, first)
    assert.equal(
      await Vendor.query()
        .where('user_uuid', firstUser.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      1
    )
    assert.equal(
      await ProjectVendor.query()
        .where('project_uuid', firstProject.uuid)
        .where('vendor_uuid', first.vendors[0].vendorUuid)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      1
    )
    const contacts = await VendorService.getUserVendors(firstUser.uuid, 100, 0)
    assert.equal(
      contacts.some((contact) => contact.uuid === listing.uuid),
      true
    )
  })

  test('concurrent project attachments assign exactly one owner to a no-email search listing', async () => {
    const listing = await createSearchListing(null)

    await Promise.all([
      ProjectVendorAttachmentService.attachListings(firstUser.uuid, firstProject.uuid, [
        listing.uuid,
      ]),
      ProjectVendorAttachmentService.attachListings(secondUser.uuid, secondProject.uuid, [
        listing.uuid,
      ]),
    ])

    await listing.refresh()
    assert.ok([firstUser.uuid, secondUser.uuid].includes(listing.ownerUserUuid!))
    assert.equal(listing.originator, 'SEARCH')
    assert.equal(
      await Vendor.query()
        .where('vendor_listing_uuid', listing.uuid)
        .whereIn('user_uuid', [firstUser.uuid, secondUser.uuid])
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      2
    )
  })

  test('attachment preserves claimed and email-bearing search ownership rules', async () => {
    const emailSearchListing = await createSearchListing('immutable-attachment@example.com')
    const claimedListing = await VendorService.createVendorOwnedListing(firstUser.uuid, {
      name: 'Claimed Attachment Vendor',
      email: 'claimed-attachment@example.com',
    })

    await ProjectVendorAttachmentService.attachListings(secondUser.uuid, secondProject.uuid, [
      emailSearchListing.uuid,
      claimedListing.uuid,
    ])

    await emailSearchListing.refresh()
    await claimedListing.refresh()
    assert.equal(emailSearchListing.ownerUserUuid, null)
    assert.equal(VendorService.canEditListing(secondUser.uuid, emailSearchListing), false)
    assert.equal(claimedListing.claimedByUserUuid, firstUser.uuid)
    assert.equal(VendorService.canEditListing(secondUser.uuid, claimedListing), false)
  })

  test('resolves superseded listing UUIDs to the canonical listing before mapping', async () => {
    const duplicate = await VendorService.createVendor(firstUser.uuid, {
      name: 'Superseded Attachment Vendor',
      email: 'canonical-attachment@example.com',
    })
    const canonical = await VendorService.createVendorOwnedListing(secondUser.uuid, {
      name: 'Canonical Attachment Vendor',
      email: 'canonical-attachment@example.com',
    })
    await VendorService.supersedeConsumerDuplicatesForClaim(canonical.uuid)

    const result = await ProjectVendorAttachmentService.attachListings(
      firstUser.uuid,
      firstProject.uuid,
      [duplicate.uuid]
    )

    assert.equal(result.vendors[0].vendorListingUuid, canonical.uuid)
    assert.ok(
      await Vendor.query()
        .where('user_uuid', firstUser.uuid)
        .where('vendor_listing_uuid', canonical.uuid)
        .where('is_active', true)
        .first()
    )
  })

  test('rejects unavailable listings and projects owned by another user', async () => {
    const listing = await createSearchListing('authorization-attachment@example.com')

    await assert.rejects(
      () =>
        ProjectVendorAttachmentService.attachListings(secondUser.uuid, firstProject.uuid, [
          listing.uuid,
        ]),
      (error: unknown) => error instanceof ProjectVendorAttachmentError && error.statusCode === 404
    )
    assert.equal(
      await Vendor.query()
        .where('user_uuid', secondUser.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .first(),
      null
    )

    const unavailableUuid = uuidv4()
    await assert.rejects(
      () =>
        ProjectVendorAttachmentService.attachListings(firstUser.uuid, firstProject.uuid, [
          unavailableUuid,
        ]),
      (error: unknown) =>
        error instanceof ProjectVendorAttachmentError &&
        error.statusCode === 422 &&
        error.unavailableVendorListingUuids[0] === unavailableUuid
    )
  })

  test('rolls back ownership and contact mapping when project attachment fails', async () => {
    const listing = await createSearchListing(null)
    const originalCreate = ProjectVendor.create
    ProjectVendor.create = (async () => {
      throw new Error('forced project vendor failure')
    }) as typeof ProjectVendor.create

    try {
      await assert.rejects(
        () =>
          ProjectVendorAttachmentService.attachListings(firstUser.uuid, firstProject.uuid, [
            listing.uuid,
          ]),
        /forced project vendor failure/
      )
    } finally {
      ProjectVendor.create = originalCreate
    }

    await listing.refresh()
    assert.equal(listing.ownerUserUuid, null)
    assert.equal(
      await Vendor.query()
        .where('user_uuid', firstUser.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .first(),
      null
    )
  })

  test('project attachment API returns mappings and actionable errors', async ({ client }) => {
    const listing = await createSearchListing('api-attachment@example.com')
    const success = await client
      .post(`/api/projects/${firstProject.uuid}/vendors`)
      .loginAs(firstUser)
      .json({ vendorListingUuids: [listing.uuid] })

    success.assertStatus(200)
    assert.equal(success.body().vendors[0].vendorListingUuid, listing.uuid)

    const unavailableUuid = uuidv4()
    const unavailable = await client
      .post(`/api/projects/${firstProject.uuid}/vendors`)
      .loginAs(firstUser)
      .json({ vendorListingUuids: [unavailableUuid] })
    unavailable.assertStatus(422)
    unavailable.assertBodyContains({ unavailableVendorListingUuids: [unavailableUuid] })

    const unauthorized = await client
      .post(`/api/projects/${firstProject.uuid}/vendors`)
      .loginAs(secondUser)
      .json({ vendorListingUuids: [listing.uuid] })
    unauthorized.assertStatus(404)

    const vendorEntitlement = await UserEntitlement.findByOrFail('canonicalName', 'VENDOR')
    const vendorUser = await User.create({
      fullName: 'Attachment Vendor Account',
      email: `attachment-vendor-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: vendorEntitlement.id,
      isActive: true,
    })
    const vendorProject = await Project.create({
      title: 'Vendor Account Project',
      userUuid: vendorUser.uuid,
      isActive: true,
    })
    const vendorAccountResponse = await client
      .post(`/api/projects/${vendorProject.uuid}/vendors`)
      .loginAs(vendorUser)
      .json({ vendorListingUuids: [listing.uuid] })
    vendorAccountResponse.assertStatus(403)
  })
})
