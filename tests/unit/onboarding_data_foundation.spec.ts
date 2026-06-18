import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import VendorListing from '#models/vendor_listing'
import User from '#models/user'

test.group('onboarding data foundation', () => {
  test('entitlement canonical names are migrated for consumer, vendor, and admin roles', async () => {
    const result = await db.rawQuery(`
      SELECT canonical_name
      FROM envoy_schema.user_entitlements
      WHERE canonical_name IN ('CONSUMER', 'VENDOR', 'ADMIN', 'USER')
        AND is_active = true
      ORDER BY canonical_name
    `)

    const canonicalNames = result.rows.map((row: { canonical_name: string }) => row.canonical_name)

    assert.deepEqual(canonicalNames, ['ADMIN', 'CONSUMER', 'VENDOR'])
  }).timeout(10_000)

  test('vendor listing constraints, searchable fields, and indexes are present', async () => {
    const columns = await db.rawQuery(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'envoy_schema'
        AND table_name = 'vendor_listings'
        AND column_name IN (
          'fsq_place_id',
          'categories',
          'phone_number',
          'website',
          'date_refreshed',
          'location',
          'source_payload',
          'claimed_by_user_uuid',
          'claimed_at',
          'claim_status'
        )
    `)
    const columnTypes = new Map(
      columns.rows.map((row: { column_name: string; data_type: string; udt_name: string }) => [
        row.column_name,
        row.udt_name || row.data_type,
      ])
    )

    assert.equal(columnTypes.get('fsq_place_id'), 'text')
    assert.equal(columnTypes.get('categories'), '_text')
    assert.equal(columnTypes.get('claimed_by_user_uuid'), 'uuid')
    assert.equal(columnTypes.get('claim_status'), 'varchar')

    const constraints = await db.rawQuery(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'envoy_schema.vendor_listings'::regclass
        AND conname IN (
          'vendor_listings_originator_check',
          'vendor_listings_claim_status_check',
          'vendor_listings_claimed_by_user_uuid_foreign'
        )
    `)
    const constraintDefinitions = new Map<string, string>(
      constraints.rows.map((row: { conname: string; definition: string }) => [
        row.conname,
        row.definition,
      ])
    )

    assert.match(constraintDefinitions.get('vendor_listings_originator_check') ?? '', /CONSUMER/)
    assert.match(constraintDefinitions.get('vendor_listings_originator_check') ?? '', /SEARCH/)
    assert.match(constraintDefinitions.get('vendor_listings_originator_check') ?? '', /VENDOR/)
    assert.match(constraintDefinitions.get('vendor_listings_claim_status_check') ?? '', /UNCLAIMED/)
    assert.match(
      constraintDefinitions.get('vendor_listings_claimed_by_user_uuid_foreign') ?? '',
      /FOREIGN KEY/
    )

    const indexes = await db.rawQuery(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'envoy_schema'
        AND tablename = 'vendor_listings'
        AND indexname IN (
          'vendor_listings_fsq_place_id_unique',
          'vendor_listings_originator_idx',
          'vendor_listings_categories_gin_idx',
          'vendor_listings_date_refreshed_idx',
          'vendor_listings_location_postcode_idx'
        )
    `)

    assert.deepEqual(indexes.rows.map((row: { indexname: string }) => row.indexname).sort(), [
      'vendor_listings_categories_gin_idx',
      'vendor_listings_date_refreshed_idx',
      'vendor_listings_fsq_place_id_unique',
      'vendor_listings_location_postcode_idx',
      'vendor_listings_originator_idx',
    ])
  }).timeout(10_000)

  test('anonymous onboarding drafts use UUID keys, expected statuses, and required indexes', async () => {
    const columns = await db.rawQuery(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'envoy_schema'
        AND table_name = 'anonymous_onboarding_drafts'
        AND column_name IN (
          'uuid',
          'token_uuid',
          'anonymous_session_uuid',
          'registered_user_uuid',
          'consumed_by_user_uuid',
          'consumed_project_uuid'
        )
    `)

    for (const row of columns.rows as Array<{ column_name: string; udt_name: string }>) {
      assert.equal(row.udt_name, 'uuid', `${row.column_name} should be a PostgreSQL uuid`)
    }

    const constraints = await db.rawQuery(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'envoy_schema.anonymous_onboarding_drafts'::regclass
    `)
    const constraintDefinitions = constraints.rows.map(
      (row: { conname: string; definition: string }) => `${row.conname}: ${row.definition}`
    )

    assert.ok(
      constraintDefinitions.some((definition: string) => definition.includes('ACTIVE')),
      'status check should include ACTIVE'
    )
    assert.ok(
      constraintDefinitions.some((definition: string) => definition.includes('CONSUMED')),
      'status check should include CONSUMED'
    )

    const indexes = await db.rawQuery(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'envoy_schema'
        AND tablename = 'anonymous_onboarding_drafts'
        AND indexname IN (
          'anonymous_onboarding_drafts_status_expires_idx',
          'anonymous_onboarding_drafts_consumed_by_user_uuid_idx',
          'anonymous_onboarding_drafts_registered_user_uuid_idx',
          'anonymous_onboarding_drafts_anonymous_session_active_idx',
          'anonymous_onboarding_drafts_consumed_project_unique'
        )
    `)

    assert.deepEqual(indexes.rows.map((row: { indexname: string }) => row.indexname).sort(), [
      'anonymous_onboarding_drafts_anonymous_session_active_idx',
      'anonymous_onboarding_drafts_consumed_by_user_uuid_idx',
      'anonymous_onboarding_drafts_consumed_project_unique',
      'anonymous_onboarding_drafts_registered_user_uuid_idx',
      'anonymous_onboarding_drafts_status_expires_idx',
    ])
  }).timeout(10_000)

  test('models expose onboarding and vendor listing fields using app naming conventions', () => {
    const user = new User()
    user.vendorApprovalStatus = 'PENDING'
    user.vendorApprovedAt = DateTime.utc()

    const listing = new VendorListing()
    listing.originator = 'SEARCH'
    listing.fsqPlaceId = 'fsq_123'
    listing.categories = ['General Contractor']
    listing.phoneNumber = '+18045550199'
    listing.website = 'https://example.com'
    listing.dateRefreshed = DateTime.fromISO('2026-06-17')
    listing.location = { postcode: '23220', formatted_address: 'Richmond, VA 23220' }
    listing.sourcePayload = { fsq_id: 'fsq_123' }
    listing.claimStatus = 'UNCLAIMED'

    const draft = new AnonymousOnboardingDraft()
    draft.tokenUuid = '11111111-1111-4111-8111-111111111111'
    draft.projectDescription = 'Renovate a small commercial kitchen.'
    draft.postalCode = '23220'
    draft.vendorSearches = []
    draft.recommendedVendors = []
    draft.selectedVendors = []
    draft.status = 'ACTIVE'
    draft.anonymousSessionUuid = '22222222-2222-4222-8222-222222222222'
    draft.expiresAt = DateTime.utc().plus({ hours: 24 })

    assert.equal(user.vendorApprovalStatus, 'PENDING')
    assert.equal(listing.originator, 'SEARCH')
    assert.equal(listing.claimStatus, 'UNCLAIMED')
    assert.equal(draft.status, 'ACTIVE')
  })
})
