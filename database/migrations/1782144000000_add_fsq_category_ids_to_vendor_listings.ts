import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddFsqCategoryIdsToVendorListings extends BaseSchema {
  public async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.vendor_listings
        ADD COLUMN IF NOT EXISTS fsq_category_ids text[] NOT NULL DEFAULT '{}'::text[];

      CREATE INDEX IF NOT EXISTS vendor_listings_fsq_category_ids_gin_idx
        ON envoy_schema.vendor_listings USING gin (fsq_category_ids);
    `)
  }

  public async down() {
    this.schema.raw(`
      DROP INDEX IF EXISTS envoy_schema.vendor_listings_fsq_category_ids_gin_idx;

      ALTER TABLE envoy_schema.vendor_listings
        DROP COLUMN IF EXISTS fsq_category_ids;
    `)
  }
}
