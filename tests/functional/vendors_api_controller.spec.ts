import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import Vendor from '#models/vendor'
import VendorService from '#services/vendor_service'

test.group('vendor availability API', (group) => {
  let consumer: User

  group.setup(() => testUtils.db().truncate())
  group.setup(async () => {
    const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
    consumer = await User.create({
      fullName: 'Availability Consumer',
      email: `availability-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: entitlement.id,
      isActive: true,
    })
  })

  test('lists globally available vendors using the redacted public DTO', async ({ client }) => {
    const listing = await VendorService.createVendor(consumer.uuid, {
      name: `Public Consumer Vendor ${uuidv4()}`,
      email: 'private-contact@example.com',
    })

    const response = await client
      .get('/api/vendors/available?limit=10000&offset=0')
      .loginAs(consumer)

    response.assertStatus(200)
    const vendor = response
      .body()
      .vendors.find(
        (candidate: { vendorListingUuid: string }) => candidate.vendorListingUuid === listing.uuid
      )
    assert.ok(vendor)
    assert.equal(vendor.consumerOwned, true)
    assert.equal(vendor.hasEmail, true)
    assert.equal('email' in vendor, false)
    assert.equal('sourcePayload' in vendor, false)
  })

  test('selecting a global listing creates a mapping without granting edit authority', async ({
    client,
  }) => {
    const listing = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `api-select-${uuidv4()}`,
      name: 'API Search Vendor',
      email: 'api-search@example.com',
      categories: [],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: null,
      sourcePayload: {},
    })

    const selectResponse = await client
      .post(`/api/vendors/${listing.uuid}/select`)
      .loginAs(consumer)
    selectResponse.assertStatus(200)
    assert.equal(selectResponse.body().savedToContacts, true)
    assert.equal(selectResponse.body().listing.inContacts, true)
    assert.equal(selectResponse.body().listing.vendorListingUuid, listing.uuid)
    assert.ok(
      await Vendor.query()
        .where('user_uuid', consumer.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .first()
    )

    const repeatedSelectResponse = await client
      .post(`/api/vendors/${listing.uuid}/select`)
      .loginAs(consumer)
    repeatedSelectResponse.assertStatus(200)
    assert.equal(repeatedSelectResponse.body().vendorUuid, selectResponse.body().vendorUuid)
    assert.equal(
      await Vendor.query()
        .where('user_uuid', consumer.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      1
    )

    const editResponse = await client
      .patch(`/api/vendors/${listing.uuid}`)
      .loginAs(consumer)
      .json({ name: 'Unauthorized API Rename' })
    editResponse.assertStatus(403)
  })

  test('trusted match endpoint excludes consumer-owned and unclaimed search listings', async ({
    client,
  }) => {
    const sharedName = `Trusted API Match ${uuidv4()}`
    await VendorService.createVendor(consumer.uuid, {
      name: sharedName,
      email: 'consumer-api-match@example.com',
    })
    const trusted = await VendorService.createVendorOwnedListing(consumer.uuid, {
      name: sharedName,
      email: 'trusted-api-match@example.com',
    })

    const response = await client
      .get(`/api/vendors/trusted-matches?name=${encodeURIComponent(sharedName)}`)
      .loginAs(consumer)

    response.assertStatus(200)
    assert.deepEqual(
      response
        .body()
        .vendors.map((vendor: { vendorListingUuid: string }) => vendor.vendorListingUuid),
      [trusted.uuid]
    )
  })

  test('requires a session and ignores spoofed user identity headers', async ({ client }) => {
    const unauthenticated = await client
      .get('/api/vendors/available')
      .header('x-user-id', consumer.uuid)
    unauthenticated.assertStatus(401)

    const otherConsumer = await User.create({
      fullName: 'Other Availability Consumer',
      email: `other-availability-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: consumer.entitlementId,
      isActive: true,
    })
    const listing = await VendorService.createVendor(consumer.uuid, {
      name: `Header Spoof Vendor ${uuidv4()}`,
      email: 'header-spoof@example.com',
    })

    const response = await client
      .patch(`/api/vendors/${listing.uuid}`)
      .loginAs(otherConsumer)
      .header('x-user-id', consumer.uuid)
      .json({ name: 'Spoofed Rename' })

    response.assertStatus(404)
  })
})
