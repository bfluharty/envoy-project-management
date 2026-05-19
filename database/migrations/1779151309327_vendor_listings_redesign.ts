import { BaseSchema } from '@adonisjs/lucid/schema'

export default class VendorListingsRedesign extends BaseSchema {
  public async up() {
    // Step 1: Create the global vendor_listings table
    this.schema.createTable('envoy_schema.vendor_listings', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('name').notNullable()
      table.string('email').notNullable()
      table
        .string('originator', 32)
        .notNullable()
        .defaultTo('USER')
        .checkIn(['USER', 'GOOGLE', 'VENDOR'])
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deactivated_timestamp', { useTz: true }).nullable()
      table.string('modified_by').nullable()
    })

    // Step 2: Copy existing vendor data into vendor_listings
    this.schema.raw(`
      INSERT INTO envoy_schema.vendor_listings
        (uuid, name, email, originator, is_active, created_timestamp, updated_timestamp, modified_by)
      SELECT
        uuid, name, email, 'USER', is_active, created_timestamp, modified_timestamp, modified_by
      FROM envoy_schema.vendors
    `)

    // Step 3: Add vendor_listing_uuid to vendors (nullable initially for backfill)
    this.schema.alterTable('envoy_schema.vendors', (table) => {
      table.string('vendor_listing_uuid').nullable()
    })

    // Step 4: Backfill vendor_listing_uuid from existing uuid (1:1 mapping)
    this.schema.raw(`
      UPDATE envoy_schema.vendors
      SET vendor_listing_uuid = uuid
    `)

    // Step 5: Make vendor_listing_uuid NOT NULL and add FK + unique constraint
    this.schema.alterTable('envoy_schema.vendors', (table) => {
      table.string('vendor_listing_uuid').notNullable().alter()
    })
    this.schema.raw(`
      ALTER TABLE envoy_schema.vendors
      ADD CONSTRAINT vendors_vendor_listing_uuid_foreign
      FOREIGN KEY (vendor_listing_uuid) REFERENCES envoy_schema.vendor_listings(uuid)
    `)
    this.schema.raw(`
      ALTER TABLE envoy_schema.vendors
      ADD CONSTRAINT vendors_user_vendor_listing_unique
      UNIQUE (user_uuid, vendor_listing_uuid)
    `)

    // Step 6: Drop columns that now live in vendor_listings
    this.schema.alterTable('envoy_schema.vendors', (table) => {
      table.dropUnique(['name'])
      table.dropUnique(['email'])
      table.dropColumn('name')
      table.dropColumn('email')
      table.dropColumn('created_by')
    })
  }

  public async down() {
    // Reverse Step 6: Re-add dropped columns to vendors
    this.schema.alterTable('envoy_schema.vendors', (table) => {
      table.string('name').nullable()
      table.string('email').nullable()
      table.string('created_by').nullable()
    })

    // Copy data back from vendor_listings into vendors
    this.schema.raw(`
      UPDATE envoy_schema.vendors v
      SET
        name = vl.name,
        email = vl.email,
        created_by = COALESCE(vl.modified_by, 'admin'),
        modified_by = COALESCE(vl.modified_by, 'admin'),
        modified_timestamp = vl.updated_timestamp
      FROM envoy_schema.vendor_listings vl
      WHERE v.vendor_listing_uuid = vl.uuid
    `)

    // Make restored columns NOT NULL and re-add unique constraints
    this.schema.alterTable('envoy_schema.vendors', (table) => {
      table.string('name').notNullable().alter()
      table.string('email').notNullable().alter()
      table.string('created_by').notNullable().alter()
      table.string('modified_by').notNullable().alter()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().alter()
      table.unique(['name'])
      table.unique(['email'])
    })

    // Reverse Step 5 & 3: Drop FK, unique constraint, and vendor_listing_uuid column
    this.schema.raw(
      'ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_user_vendor_listing_unique'
    )
    this.schema.raw(
      'ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_vendor_listing_uuid_foreign'
    )
    this.schema.alterTable('envoy_schema.vendors', (table) => {
      table.dropColumn('vendor_listing_uuid')
    })

    // Reverse Step 1: Drop vendor_listings table
    this.schema.dropTable('envoy_schema.vendor_listings')
  }
}
