import { BaseSchema } from '@adonisjs/lucid/schema'

export default class VendorListingOwnershipAndDraftUuidArrays extends BaseSchema {
  public async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.vendor_listings
        ALTER COLUMN email DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS owner_user_uuid uuid NULL,
        ADD COLUMN IF NOT EXISTS superseded_by_vendor_listing_uuid uuid NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'vendor_listings_owner_user_uuid_foreign'
            AND conrelid = 'envoy_schema.vendor_listings'::regclass
        ) THEN
          ALTER TABLE envoy_schema.vendor_listings
            ADD CONSTRAINT vendor_listings_owner_user_uuid_foreign
            FOREIGN KEY (owner_user_uuid)
            REFERENCES envoy_schema.users(uuid)
            ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'vendor_listings_superseded_by_foreign'
            AND conrelid = 'envoy_schema.vendor_listings'::regclass
        ) THEN
          ALTER TABLE envoy_schema.vendor_listings
            ADD CONSTRAINT vendor_listings_superseded_by_foreign
            FOREIGN KEY (superseded_by_vendor_listing_uuid)
            REFERENCES envoy_schema.vendor_listings(uuid)
            ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'vendor_listings_not_self_superseded_check'
            AND conrelid = 'envoy_schema.vendor_listings'::regclass
        ) THEN
          ALTER TABLE envoy_schema.vendor_listings
            ADD CONSTRAINT vendor_listings_not_self_superseded_check
            CHECK (
              superseded_by_vendor_listing_uuid IS NULL
              OR superseded_by_vendor_listing_uuid <> uuid
            );
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS vendor_listings_owner_user_uuid_idx
        ON envoy_schema.vendor_listings (owner_user_uuid)
        WHERE owner_user_uuid IS NOT NULL;

      CREATE INDEX IF NOT EXISTS vendor_listings_superseded_by_idx
        ON envoy_schema.vendor_listings (superseded_by_vendor_listing_uuid)
        WHERE superseded_by_vendor_listing_uuid IS NOT NULL;

      UPDATE envoy_schema.vendor_listings listing
      SET owner_user_uuid = mapped.user_uuid
      FROM (
        SELECT DISTINCT ON (vendor_listing_uuid)
          vendor_listing_uuid,
          user_uuid
        FROM envoy_schema.vendors
        WHERE is_active = true
        ORDER BY vendor_listing_uuid, id
      ) mapped
      WHERE listing.uuid = mapped.vendor_listing_uuid
        AND listing.originator = 'CONSUMER'
        AND listing.claim_status <> 'CLAIMED'
        AND listing.owner_user_uuid IS NULL;

      ALTER TABLE envoy_schema.anonymous_onboarding_drafts
        ADD COLUMN IF NOT EXISTS recommended_vendor_listing_uuids uuid[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS selected_vendor_listing_uuids uuid[] NOT NULL DEFAULT '{}';

      UPDATE envoy_schema.anonymous_onboarding_drafts draft
      SET recommended_vendor_listing_uuids = COALESCE(
        ARRAY(
          SELECT DISTINCT candidate.vendor_listing_uuid
          FROM (
            SELECT (item->>'vendorListingUuid')::uuid AS vendor_listing_uuid
            FROM jsonb_array_elements(draft.recommended_vendors) item
            WHERE COALESCE(item->>'vendorListingUuid', '')
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ) candidate
          JOIN envoy_schema.vendor_listings listing
            ON listing.uuid = candidate.vendor_listing_uuid
        ),
        '{}'::uuid[]
      )
      WHERE draft.recommended_vendors IS NOT NULL;

      UPDATE envoy_schema.anonymous_onboarding_drafts draft
      SET selected_vendor_listing_uuids = COALESCE(
        ARRAY(
          SELECT DISTINCT candidate.vendor_listing_uuid
          FROM (
            SELECT (item->>'vendorListingUuid')::uuid AS vendor_listing_uuid
            FROM jsonb_array_elements(draft.selected_vendors) item
            WHERE COALESCE(item->>'vendorListingUuid', '')
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ) candidate
          JOIN envoy_schema.vendor_listings listing
            ON listing.uuid = candidate.vendor_listing_uuid
        ),
        '{}'::uuid[]
      )
      WHERE draft.selected_vendors IS NOT NULL;

      ALTER TABLE envoy_schema.anonymous_onboarding_drafts
        DROP COLUMN IF EXISTS recommended_vendors,
        DROP COLUMN IF EXISTS selected_vendors;

      CREATE INDEX IF NOT EXISTS anonymous_onboarding_drafts_recommended_vendor_uuids_gin_idx
        ON envoy_schema.anonymous_onboarding_drafts
        USING gin (recommended_vendor_listing_uuids);

      CREATE INDEX IF NOT EXISTS anonymous_onboarding_drafts_selected_vendor_uuids_gin_idx
        ON envoy_schema.anonymous_onboarding_drafts
        USING gin (selected_vendor_listing_uuids);
    `)
  }

  public async down() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.anonymous_onboarding_drafts
        ADD COLUMN IF NOT EXISTS recommended_vendors jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS selected_vendors jsonb NOT NULL DEFAULT '[]'::jsonb;

      UPDATE envoy_schema.anonymous_onboarding_drafts draft
      SET recommended_vendors = COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'candidateId', 'listing:' || listing_uuid::text,
              'vendorListingUuid', listing_uuid::text
            )
          )
          FROM unnest(draft.recommended_vendor_listing_uuids) listing_uuid
        ),
        '[]'::jsonb
      ),
      selected_vendors = COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'candidateId', 'listing:' || listing_uuid::text,
              'vendorListingUuid', listing_uuid::text
            )
          )
          FROM unnest(draft.selected_vendor_listing_uuids) listing_uuid
        ),
        '[]'::jsonb
      );

      DROP INDEX IF EXISTS envoy_schema.anonymous_onboarding_drafts_selected_vendor_uuids_gin_idx;
      DROP INDEX IF EXISTS envoy_schema.anonymous_onboarding_drafts_recommended_vendor_uuids_gin_idx;

      ALTER TABLE envoy_schema.anonymous_onboarding_drafts
        DROP COLUMN IF EXISTS recommended_vendor_listing_uuids,
        DROP COLUMN IF EXISTS selected_vendor_listing_uuids;

      DROP INDEX IF EXISTS envoy_schema.vendor_listings_superseded_by_idx;
      DROP INDEX IF EXISTS envoy_schema.vendor_listings_owner_user_uuid_idx;

      ALTER TABLE envoy_schema.vendor_listings
        DROP CONSTRAINT IF EXISTS vendor_listings_not_self_superseded_check,
        DROP CONSTRAINT IF EXISTS vendor_listings_superseded_by_foreign,
        DROP CONSTRAINT IF EXISTS vendor_listings_owner_user_uuid_foreign,
        DROP COLUMN IF EXISTS superseded_by_vendor_listing_uuid,
        DROP COLUMN IF EXISTS owner_user_uuid;

      UPDATE envoy_schema.vendor_listings
      SET email = 'unknown+' || uuid::text || '@invalid.envoy.local'
      WHERE email IS NULL;

      ALTER TABLE envoy_schema.vendor_listings
        ALTER COLUMN email SET NOT NULL;
    `)
  }
}
