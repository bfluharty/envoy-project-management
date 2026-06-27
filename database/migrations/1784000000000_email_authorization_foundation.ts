import { BaseSchema } from '@adonisjs/lucid/schema'

export default class EmailAuthorizationFoundation extends BaseSchema {
  public async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.user_inbox_connections
        ADD COLUMN IF NOT EXISTS uuid uuid,
        ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS provider_user_id varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS token_encryption_version varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS last_sync_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS last_sync_error text NULL,
        ADD COLUMN IF NOT EXISTS reauth_reason text NULL,
        ADD COLUMN IF NOT EXISTS reauth_required_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS disconnected_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS provider_cursor text NULL,
        ADD COLUMN IF NOT EXISTS watch_status varchar(32) NOT NULL DEFAULT 'not_configured',
        ADD COLUMN IF NOT EXISTS watch_expires_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS provider_subscription_id varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS subscription_client_state varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz NULL;

      UPDATE envoy_schema.user_inbox_connections
      SET uuid = (
        substr(md5(id::text || ':' || provider || ':' || email), 1, 8) || '-' ||
        substr(md5(id::text || ':' || provider || ':' || email), 9, 4) || '-' ||
        substr(md5(id::text || ':' || provider || ':' || email), 13, 4) || '-' ||
        substr(md5(id::text || ':' || provider || ':' || email), 17, 4) || '-' ||
        substr(md5(id::text || ':' || provider || ':' || email), 21, 12)
      )::uuid
      WHERE uuid IS NULL;

      UPDATE envoy_schema.user_inbox_connections
      SET token_encryption_version = 'plaintext_legacy'
      WHERE token_encryption_version IS NULL;

      WITH ranked_connections AS (
        SELECT
          id,
          row_number() OVER (PARTITION BY user_uuid ORDER BY id) AS connection_rank
        FROM envoy_schema.user_inbox_connections
        WHERE status IN ('active', 'reauth_required')
      )
      UPDATE envoy_schema.user_inbox_connections connections
      SET is_primary = ranked_connections.connection_rank = 1
      FROM ranked_connections
      WHERE connections.id = ranked_connections.id;

      ALTER TABLE envoy_schema.user_inbox_connections
        ALTER COLUMN uuid SET NOT NULL,
        ALTER COLUMN token_encryption_version SET NOT NULL,
        ALTER COLUMN token_encryption_version SET DEFAULT 'adonis_app_key_v1';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'user_inbox_connections_status_check'
            AND conrelid = 'envoy_schema.user_inbox_connections'::regclass
        ) THEN
          ALTER TABLE envoy_schema.user_inbox_connections
            ADD CONSTRAINT user_inbox_connections_status_check
            CHECK (status IN ('active', 'reauth_required', 'disconnected'));
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'user_inbox_connections_watch_status_check'
            AND conrelid = 'envoy_schema.user_inbox_connections'::regclass
        ) THEN
          ALTER TABLE envoy_schema.user_inbox_connections
            ADD CONSTRAINT user_inbox_connections_watch_status_check
            CHECK (watch_status IN ('active', 'renewal_required', 'not_configured', 'error'));
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS user_inbox_connections_uuid_unique
        ON envoy_schema.user_inbox_connections (uuid);

      CREATE UNIQUE INDEX IF NOT EXISTS user_inbox_connections_primary_active_user_unique
        ON envoy_schema.user_inbox_connections (user_uuid)
        WHERE is_primary = true AND status IN ('active', 'reauth_required');

      CREATE INDEX IF NOT EXISTS user_inbox_connections_user_status_idx
        ON envoy_schema.user_inbox_connections (user_uuid, status);

      CREATE INDEX IF NOT EXISTS user_inbox_connections_provider_email_status_idx
        ON envoy_schema.user_inbox_connections (provider, email, status);

      CREATE INDEX IF NOT EXISTS user_inbox_connections_provider_subscription_idx
        ON envoy_schema.user_inbox_connections (provider_subscription_id);

      CREATE INDEX IF NOT EXISTS user_inbox_connections_watch_expires_idx
        ON envoy_schema.user_inbox_connections (watch_expires_at);

      CREATE INDEX IF NOT EXISTS user_inbox_connections_subscription_expires_idx
        ON envoy_schema.user_inbox_connections (subscription_expires_at);

      CREATE TABLE IF NOT EXISTS envoy_schema.email_authorization_consents (
        id bigserial PRIMARY KEY,
        uuid uuid NOT NULL UNIQUE,
        user_uuid uuid NOT NULL REFERENCES envoy_schema.users(uuid) ON DELETE CASCADE,
        provider varchar(32) NOT NULL,
        email varchar(254) NOT NULL,
        provider_user_id varchar(255) NULL,
        scopes text NULL,
        terms_version varchar(64) NOT NULL,
        consent_text text NOT NULL,
        ip_address varchar(64) NULL,
        user_agent text NULL,
        created_timestamp timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS email_authorization_consents_user_created_idx
        ON envoy_schema.email_authorization_consents (user_uuid, created_timestamp DESC);

      CREATE INDEX IF NOT EXISTS email_authorization_consents_provider_email_idx
        ON envoy_schema.email_authorization_consents (provider, email);
    `)
  }

  public async down() {
    this.schema.raw(`
      DROP TABLE IF EXISTS envoy_schema.email_authorization_consents;

      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_subscription_expires_idx;
      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_watch_expires_idx;
      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_provider_subscription_idx;
      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_provider_email_status_idx;
      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_user_status_idx;
      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_primary_active_user_unique;
      DROP INDEX IF EXISTS envoy_schema.user_inbox_connections_uuid_unique;

      ALTER TABLE envoy_schema.user_inbox_connections
        DROP CONSTRAINT IF EXISTS user_inbox_connections_watch_status_check,
        DROP CONSTRAINT IF EXISTS user_inbox_connections_status_check;

      ALTER TABLE envoy_schema.user_inbox_connections
        DROP COLUMN IF EXISTS subscription_expires_at,
        DROP COLUMN IF EXISTS subscription_client_state,
        DROP COLUMN IF EXISTS provider_subscription_id,
        DROP COLUMN IF EXISTS watch_expires_at,
        DROP COLUMN IF EXISTS watch_status,
        DROP COLUMN IF EXISTS provider_cursor,
        DROP COLUMN IF EXISTS disconnected_at,
        DROP COLUMN IF EXISTS reauth_required_at,
        DROP COLUMN IF EXISTS reauth_reason,
        DROP COLUMN IF EXISTS last_sync_error,
        DROP COLUMN IF EXISTS last_sync_at,
        DROP COLUMN IF EXISTS token_encryption_version,
        DROP COLUMN IF EXISTS provider_user_id,
        DROP COLUMN IF EXISTS is_primary,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS uuid;
    `)
  }
}
