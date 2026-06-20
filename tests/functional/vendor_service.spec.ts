import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import VendorService, { VendorAuthorizationError } from '#services/vendor_service'

test.group('VendorService ownership and availability', (group) => {
  let firstUser: User
  let secondUser: User

  group.setup(() => testUtils.db().truncate())
  group.setup(async () => {
    const entitlement =
      (await UserEntitlement.findBy('canonicalName', 'CONSUMER')) ??
      (await UserEntitlement.create({
        title: 'Consumer',
        canonicalName: 'CONSUMER',
        createdBy: 'test',
        modifiedBy: 'test',
        isActive: true,
      }))
    firstUser = await User.create({
      fullName: 'First Consumer',
      email: `first-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: entitlement.id,
      isActive: true,
    })
    secondUser = await User.create({
      fullName: 'Second Consumer',
      email: `second-${uuidv4()}@example.com`,
      password: 'password123',
      entitlementId: entitlement.id,
      isActive: true,
    })
  })

  test('manual consumer creation assigns exclusive ownership without forced deduplication', async () => {
    const first = await VendorService.createVendor(firstUser.uuid, {
      name: 'Independent Electric',
      email: 'office@independent.example',
    })
    const duplicate = await VendorService.createVendor(secondUser.uuid, {
      name: 'Independent Electric',
      email: 'office@independent.example',
    })

    assert.notEqual(first.uuid, duplicate.uuid)
    assert.equal(first.originator, 'CONSUMER')
    assert.equal(first.ownerUserUuid, firstUser.uuid)
    assert.equal(VendorService.canEditListing(firstUser.uuid, first), true)
    assert.equal(VendorService.canEditListing(secondUser.uuid, first), false)
  })

  test('a contact mapping does not grant edit authority', async () => {
    const listing = await VendorService.createVendor(firstUser.uuid, {
      name: 'Owner Controlled Vendor',
      email: 'owner@example.com',
    })
    await VendorService.ensureUserVendorMapping(secondUser.uuid, listing.uuid)

    await assert.rejects(
      () =>
        VendorService.updateVendor(
          secondUser.uuid,
          listing.uuid,
          { name: 'Unauthorized Rename' },
          false
        ),
      VendorAuthorizationError
    )

    await VendorService.updateVendor(
      firstUser.uuid,
      listing.uuid,
      { name: 'Owner Approved Rename' },
      false
    )
    await listing.refresh()
    assert.equal(listing.name, 'Owner Approved Rename')
  })

  test('claimed and ownerless email-bearing search listings reject consumer edits', async () => {
    const claimed = await VendorService.createVendorOwnedListing(firstUser.uuid, {
      name: 'Claimed Vendor',
      email: 'claimed@example.com',
    })
    await VendorService.ensureUserVendorMapping(secondUser.uuid, claimed.uuid)

    await assert.rejects(
      () =>
        VendorService.updateVendor(
          secondUser.uuid,
          claimed.uuid,
          { email: 'hijacked@example.com' },
          false
        ),
      VendorAuthorizationError
    )

    const searchListing = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `immutable-${uuidv4()}`,
      name: 'Search Vendor',
      email: 'search@example.com',
      categories: [],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: null,
      sourcePayload: { source: 'test' },
    })
    await VendorService.ensureUserVendorMapping(firstUser.uuid, searchListing.uuid)

    await assert.rejects(
      () =>
        VendorService.updateVendor(
          firstUser.uuid,
          searchListing.uuid,
          { name: 'Consumer Rename' },
          false
        ),
      VendorAuthorizationError
    )
  })

  test('first adoption atomically owns an ownerless no-email search listing', async () => {
    const listing = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `adopt-${uuidv4()}`,
      name: 'Adoptable Search Vendor',
      email: null,
      categories: [],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: null,
      sourcePayload: { source: 'test' },
    })

    await Promise.all([
      VendorService.adoptOwnerlessNoEmailSearchListing(firstUser.uuid, listing.uuid),
      VendorService.adoptOwnerlessNoEmailSearchListing(secondUser.uuid, listing.uuid),
    ])

    await listing.refresh()
    assert.ok([firstUser.uuid, secondUser.uuid].includes(listing.ownerUserUuid!))
    assert.equal(listing.originator, 'SEARCH')
    assert.equal(VendorService.canEditListing(listing.ownerUserUuid!, listing), true)
    const nonOwnerUuid = listing.ownerUserUuid === firstUser.uuid ? secondUser.uuid : firstUser.uuid
    assert.equal(VendorService.canEditListing(nonOwnerUuid, listing), false)
  })

  test('trusted match suggestions exclude unclaimed consumer and search listings', async () => {
    const sharedName = `Shared Match ${uuidv4()}`
    await VendorService.createVendor(firstUser.uuid, {
      name: sharedName,
      email: 'consumer-match@example.com',
    })
    await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `search-match-${uuidv4()}`,
      name: sharedName,
      email: 'search-match@example.com',
      categories: [],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: null,
      sourcePayload: {},
    })
    const trusted = await VendorService.createVendorOwnedListing(secondUser.uuid, {
      name: sharedName,
      email: 'trusted-match@example.com',
    })

    const matches = await VendorService.findTrustedExistingListings({ name: sharedName })
    assert.deepEqual(
      matches.map((listing) => listing.uuid),
      [trusted.uuid]
    )
  })

  test('claim canonicalization supersedes matching consumer listings and preserves resolution', async () => {
    const duplicate = await VendorService.createVendor(firstUser.uuid, {
      name: 'Canonical Plumbing',
      email: 'canonical@example.com',
    })
    const canonical = await VendorService.createVendorOwnedListing(secondUser.uuid, {
      name: 'Canonical Plumbing LLC',
      email: 'canonical@example.com',
    })

    const supersededCount = await VendorService.supersedeConsumerDuplicatesForClaim(canonical.uuid)
    await duplicate.refresh()

    assert.equal(supersededCount, 1)
    assert.equal(duplicate.supersededByVendorListingUuid, canonical.uuid)
    assert.equal(VendorService.canEditListing(firstUser.uuid, duplicate), false)
    const resolvedListing = await VendorService.resolveCanonicalListing(duplicate.uuid)
    assert.equal(resolvedListing?.uuid, canonical.uuid)
    const available = await VendorService.getAvailableVendorListings(100, 0)
    assert.equal(
      available.some((listing) => listing.uuid === duplicate.uuid),
      false
    )
  })

  test('public recommendations expose status flags without contact or source data', async () => {
    const listing = await VendorService.createVendor(firstUser.uuid, {
      name: 'Consumer Public Vendor',
      email: 'private@example.com',
    })

    const recommendation = VendorService.toPublicRecommendation(listing)
    assert.equal(recommendation.consumerOwned, true)
    assert.equal(recommendation.onboardedToEnvoy, false)
    assert.equal(recommendation.hasEmail, true)
    assert.match(recommendation.ownershipWarning!, /consumer-owned/i)
    assert.equal('email' in recommendation, false)
    assert.equal('sourcePayload' in recommendation, false)
  })

  test('reused search listings are not refreshed or overwritten', async () => {
    const fsqPlaceId = `no-refresh-${uuidv4()}`
    const original = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId,
      name: 'Original Search Name',
      email: 'original@example.com',
      categories: ['Original Category'],
      phoneNumber: null,
      website: null,
      dateRefreshed: '2026-01-01',
      location: { postcode: '23220' },
      sourcePayload: { version: 1 },
    })
    const reused = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId,
      name: 'Refreshed Search Name',
      email: 'original@example.com',
      categories: ['Changed Category'],
      phoneNumber: null,
      website: 'https://changed.example',
      dateRefreshed: '2026-06-20',
      location: { postcode: '90210' },
      sourcePayload: { version: 2 },
    })

    assert.equal(reused.uuid, original.uuid)
    assert.equal(reused.name, 'Original Search Name')
    assert.equal(reused.email, 'original@example.com')
    assert.deepEqual(reused.categories, ['Original Category'])
    assert.deepEqual(reused.sourcePayload, { version: 1 })
  })
})
