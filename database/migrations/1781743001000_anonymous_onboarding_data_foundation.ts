import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AnonymousOnboardingDataFoundation extends BaseSchema {
  public async up() {
    this.schema.raw(`
      DO $$
      DECLARE
        user_entitlement_id integer;
        consumer_entitlement_id integer;
      BEGIN
        SELECT id INTO user_entitlement_id
        FROM envoy_schema.user_entitlements
        WHERE canonical_name = 'USER';

        SELECT id INTO consumer_entitlement_id
        FROM envoy_schema.user_entitlements
        WHERE canonical_name = 'CONSUMER';

        IF user_entitlement_id IS NOT NULL AND consumer_entitlement_id IS NULL THEN
          UPDATE envoy_schema.user_entitlements
          SET title = 'Consumer',
              canonical_name = 'CONSUMER',
              modified_by = 'system',
              modified_timestamp = NOW(),
              is_active = true
          WHERE id = user_entitlement_id;
        ELSIF user_entitlement_id IS NOT NULL AND consumer_entitlement_id IS NOT NULL THEN
          UPDATE envoy_schema.users
          SET entitlement = consumer_entitlement_id
          WHERE entitlement = user_entitlement_id;

          DELETE FROM envoy_schema.user_entitlements
          WHERE id = user_entitlement_id;
        END IF;
      END $$;

      INSERT INTO envoy_schema.user_entitlements
        (title, canonical_name, created_by, created_timestamp, modified_by, modified_timestamp, is_active)
      VALUES
        ('Admin', 'ADMIN', 'system', NOW(), 'system', NOW(), true)
      ON CONFLICT (canonical_name) DO UPDATE SET
        title = EXCLUDED.title,
        modified_by = 'system',
        modified_timestamp = NOW(),
        is_active = true;

      INSERT INTO envoy_schema.user_entitlements
        (title, canonical_name, created_by, created_timestamp, modified_by, modified_timestamp, is_active)
      VALUES
        ('Vendor', 'VENDOR', 'system', NOW(), 'system', NOW(), true)
      ON CONFLICT (canonical_name) DO UPDATE SET
        title = EXCLUDED.title,
        modified_by = 'system',
        modified_timestamp = NOW(),
        is_active = true;

      ALTER TABLE envoy_schema.users
        ADD COLUMN IF NOT EXISTS vendor_approval_status varchar(32) NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS vendor_approved_at timestamptz NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_vendor_approval_status_check'
            AND conrelid = 'envoy_schema.users'::regclass
        ) THEN
          ALTER TABLE envoy_schema.users
            ADD CONSTRAINT users_vendor_approval_status_check
            CHECK (
              vendor_approval_status IS NULL
              OR vendor_approval_status IN ('PENDING', 'APPROVED', 'REJECTED')
            );
        END IF;
      END $$;

      DO $$
      DECLARE
        originator_constraint_name text;
      BEGIN
        FOR originator_constraint_name IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'envoy_schema.vendor_listings'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%originator%'
        LOOP
          EXECUTE format(
            'ALTER TABLE envoy_schema.vendor_listings DROP CONSTRAINT IF EXISTS %I',
            originator_constraint_name
          );
        END LOOP;
      END $$;

      UPDATE envoy_schema.vendor_listings
      SET originator = CASE
        WHEN originator = 'USER' THEN 'CONSUMER'
        WHEN originator = 'GOOGLE' THEN 'SEARCH'
        ELSE originator
      END;

      ALTER TABLE envoy_schema.vendor_listings
        ADD CONSTRAINT vendor_listings_originator_check
        CHECK (originator IN ('CONSUMER', 'SEARCH', 'VENDOR'));

      ALTER TABLE envoy_schema.vendor_listings
        ADD COLUMN IF NOT EXISTS fsq_place_id text NULL,
        ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}'::text[],
        ADD COLUMN IF NOT EXISTS phone_number varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS website text NULL,
        ADD COLUMN IF NOT EXISTS date_refreshed date NULL,
        ADD COLUMN IF NOT EXISTS location jsonb NULL,
        ADD COLUMN IF NOT EXISTS source_payload jsonb NULL,
        ADD COLUMN IF NOT EXISTS claimed_by_user_uuid uuid NULL,
        ADD COLUMN IF NOT EXISTS claimed_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS claim_status varchar(32) NOT NULL DEFAULT 'UNCLAIMED';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'vendor_listings_claimed_by_user_uuid_foreign'
            AND conrelid = 'envoy_schema.vendor_listings'::regclass
        ) THEN
          ALTER TABLE envoy_schema.vendor_listings
            ADD CONSTRAINT vendor_listings_claimed_by_user_uuid_foreign
            FOREIGN KEY (claimed_by_user_uuid)
            REFERENCES envoy_schema.users(uuid);
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'vendor_listings_claim_status_check'
            AND conrelid = 'envoy_schema.vendor_listings'::regclass
        ) THEN
          ALTER TABLE envoy_schema.vendor_listings
            ADD CONSTRAINT vendor_listings_claim_status_check
            CHECK (claim_status IN ('UNCLAIMED', 'PENDING_CLAIM', 'CLAIMED', 'CONFLICT'));
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS vendor_listings_fsq_place_id_unique
        ON envoy_schema.vendor_listings (fsq_place_id)
        WHERE fsq_place_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS vendor_listings_originator_idx
        ON envoy_schema.vendor_listings (originator);

      CREATE INDEX IF NOT EXISTS vendor_listings_categories_gin_idx
        ON envoy_schema.vendor_listings USING gin (categories);

      CREATE INDEX IF NOT EXISTS vendor_listings_date_refreshed_idx
        ON envoy_schema.vendor_listings (date_refreshed DESC);

      CREATE INDEX IF NOT EXISTS vendor_listings_location_postcode_idx
        ON envoy_schema.vendor_listings ((location->>'postcode'));

      CREATE TABLE IF NOT EXISTS envoy_schema.anonymous_onboarding_drafts (
        id bigserial PRIMARY KEY,
        uuid uuid NOT NULL UNIQUE,
        token_uuid uuid NOT NULL UNIQUE,
        project_description text NOT NULL,
        postal_code text NOT NULL,
        vendor_searches jsonb NOT NULL DEFAULT '[]'::jsonb,
        recommended_vendors jsonb NOT NULL DEFAULT '[]'::jsonb,
        selected_vendors jsonb NOT NULL DEFAULT '[]'::jsonb,
        status varchar(32) NOT NULL DEFAULT 'ACTIVE',
        anonymous_session_uuid uuid NOT NULL,
        registered_user_uuid uuid NULL REFERENCES envoy_schema.users(uuid),
        consumed_by_user_uuid uuid NULL REFERENCES envoy_schema.users(uuid),
        consumed_project_uuid uuid NULL REFERENCES envoy_schema.projects(uuid),
        expires_at timestamptz NOT NULL,
        created_timestamp timestamptz NOT NULL DEFAULT NOW(),
        updated_timestamp timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT anonymous_onboarding_drafts_status_check
          CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'ABANDONED'))
      );

      CREATE INDEX IF NOT EXISTS anonymous_onboarding_drafts_status_expires_idx
        ON envoy_schema.anonymous_onboarding_drafts (status, expires_at);

      CREATE INDEX IF NOT EXISTS anonymous_onboarding_drafts_consumed_by_user_uuid_idx
        ON envoy_schema.anonymous_onboarding_drafts (consumed_by_user_uuid);

      CREATE INDEX IF NOT EXISTS anonymous_onboarding_drafts_registered_user_uuid_idx
        ON envoy_schema.anonymous_onboarding_drafts (registered_user_uuid);

      CREATE INDEX IF NOT EXISTS anonymous_onboarding_drafts_anonymous_session_active_idx
        ON envoy_schema.anonymous_onboarding_drafts (anonymous_session_uuid, status);

      CREATE UNIQUE INDEX IF NOT EXISTS anonymous_onboarding_drafts_consumed_project_unique
        ON envoy_schema.anonymous_onboarding_drafts (consumed_project_uuid)
        WHERE consumed_project_uuid IS NOT NULL;
    `)
  }

  public async down() {
    this.schema.raw(`
      DROP TABLE IF EXISTS envoy_schema.anonymous_onboarding_drafts;

      DROP INDEX IF EXISTS envoy_schema.vendor_listings_location_postcode_idx;
      DROP INDEX IF EXISTS envoy_schema.vendor_listings_date_refreshed_idx;
      DROP INDEX IF EXISTS envoy_schema.vendor_listings_categories_gin_idx;
      DROP INDEX IF EXISTS envoy_schema.vendor_listings_originator_idx;
      DROP INDEX IF EXISTS envoy_schema.vendor_listings_fsq_place_id_unique;

      ALTER TABLE envoy_schema.vendor_listings
        DROP CONSTRAINT IF EXISTS vendor_listings_claim_status_check,
        DROP CONSTRAINT IF EXISTS vendor_listings_claimed_by_user_uuid_foreign;

      DO $$
      DECLARE
        originator_constraint_name text;
      BEGIN
        FOR originator_constraint_name IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'envoy_schema.vendor_listings'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%originator%'
        LOOP
          EXECUTE format(
            'ALTER TABLE envoy_schema.vendor_listings DROP CONSTRAINT IF EXISTS %I',
            originator_constraint_name
          );
        END LOOP;
      END $$;

      ALTER TABLE envoy_schema.vendor_listings
        DROP COLUMN IF EXISTS fsq_place_id,
        DROP COLUMN IF EXISTS categories,
        DROP COLUMN IF EXISTS phone_number,
        DROP COLUMN IF EXISTS website,
        DROP COLUMN IF EXISTS date_refreshed,
        DROP COLUMN IF EXISTS location,
        DROP COLUMN IF EXISTS source_payload,
        DROP COLUMN IF EXISTS claimed_by_user_uuid,
        DROP COLUMN IF EXISTS claimed_at,
        DROP COLUMN IF EXISTS claim_status;

      UPDATE envoy_schema.vendor_listings
      SET originator = CASE
        WHEN originator = 'CONSUMER' THEN 'USER'
        WHEN originator = 'SEARCH' THEN 'GOOGLE'
        ELSE originator
      END;

      ALTER TABLE envoy_schema.vendor_listings
        ADD CONSTRAINT vendor_listings_originator_check
        CHECK (originator IN ('USER', 'GOOGLE', 'VENDOR'));

      ALTER TABLE envoy_schema.users
        DROP CONSTRAINT IF EXISTS users_vendor_approval_status_check,
        DROP COLUMN IF EXISTS vendor_approval_status,
        DROP COLUMN IF EXISTS vendor_approved_at;

      DO $$
      DECLARE
        consumer_entitlement_id integer;
        user_entitlement_id integer;
        vendor_entitlement_id integer;
      BEGIN
        SELECT id INTO consumer_entitlement_id
        FROM envoy_schema.user_entitlements
        WHERE canonical_name = 'CONSUMER';

        SELECT id INTO user_entitlement_id
        FROM envoy_schema.user_entitlements
        WHERE canonical_name = 'USER';

        SELECT id INTO vendor_entitlement_id
        FROM envoy_schema.user_entitlements
        WHERE canonical_name = 'VENDOR';

        IF consumer_entitlement_id IS NOT NULL AND user_entitlement_id IS NULL THEN
          UPDATE envoy_schema.user_entitlements
          SET title = 'User',
              canonical_name = 'USER',
              modified_by = 'system',
              modified_timestamp = NOW(),
              is_active = true
          WHERE id = consumer_entitlement_id;
          user_entitlement_id := consumer_entitlement_id;
        ELSIF consumer_entitlement_id IS NOT NULL AND user_entitlement_id IS NOT NULL THEN
          UPDATE envoy_schema.users
          SET entitlement = user_entitlement_id
          WHERE entitlement = consumer_entitlement_id;

          DELETE FROM envoy_schema.user_entitlements
          WHERE id = consumer_entitlement_id;
        END IF;

        IF vendor_entitlement_id IS NOT NULL THEN
          UPDATE envoy_schema.users
          SET entitlement = user_entitlement_id
          WHERE entitlement = vendor_entitlement_id
            AND user_entitlement_id IS NOT NULL;

          DELETE FROM envoy_schema.user_entitlements
          WHERE id = vendor_entitlement_id;
        END IF;
      END $$;
    `)
  }
}
