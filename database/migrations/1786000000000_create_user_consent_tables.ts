import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateUserConsentTables extends BaseSchema {
  public async up() {
    this.schema.raw(`
      CREATE TABLE envoy_schema.user_consent_preferences (
        id bigserial PRIMARY KEY,
        uuid uuid NOT NULL,
        user_uuid uuid NOT NULL,
        terms_accepted boolean NOT NULL DEFAULT false,
        terms_version varchar(64) NULL,
        terms_accepted_at timestamptz NULL,
        privacy_policy_version varchar(64) NULL,
        privacy_policy_acknowledged_at timestamptz NULL,
        model_training_opt_in boolean NOT NULL DEFAULT false,
        model_training_notice_version varchar(64) NULL,
        model_training_preference_updated_at timestamptz NULL,
        created_by_user_uuid uuid NULL,
        created_timestamp timestamptz NOT NULL DEFAULT NOW(),
        modified_by_user_uuid uuid NULL,
        modified_timestamp timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT user_consent_preferences_uuid_unique UNIQUE (uuid),
        CONSTRAINT user_consent_preferences_user_uuid_unique UNIQUE (user_uuid),
        CONSTRAINT user_consent_preferences_user_uuid_foreign
          FOREIGN KEY (user_uuid)
          REFERENCES envoy_schema.users(uuid)
          ON DELETE CASCADE,
        CONSTRAINT user_consent_preferences_created_by_user_uuid_foreign
          FOREIGN KEY (created_by_user_uuid)
          REFERENCES envoy_schema.users(uuid)
          ON DELETE SET NULL,
        CONSTRAINT user_consent_preferences_modified_by_user_uuid_foreign
          FOREIGN KEY (modified_by_user_uuid)
          REFERENCES envoy_schema.users(uuid)
          ON DELETE SET NULL,
        CONSTRAINT user_consent_preferences_terms_acceptance_metadata_check
          CHECK (
            terms_accepted = false
            OR (terms_version IS NOT NULL AND terms_accepted_at IS NOT NULL)
          ),
        CONSTRAINT user_consent_preferences_privacy_metadata_check
          CHECK (
            (privacy_policy_version IS NULL AND privacy_policy_acknowledged_at IS NULL)
            OR
            (privacy_policy_version IS NOT NULL AND privacy_policy_acknowledged_at IS NOT NULL)
          ),
        CONSTRAINT user_consent_preferences_training_metadata_check
          CHECK (
            (terms_accepted = false
              AND model_training_opt_in = false
              AND model_training_notice_version IS NULL
              AND model_training_preference_updated_at IS NULL)
            OR
            (terms_accepted = true
              AND model_training_notice_version IS NOT NULL
              AND model_training_preference_updated_at IS NOT NULL)
            )
      );

      CREATE INDEX user_consent_preferences_training_opt_in_idx
        ON envoy_schema.user_consent_preferences (user_uuid)
        WHERE model_training_opt_in = true;

      CREATE TABLE envoy_schema.user_consent_events (
        id bigserial PRIMARY KEY,
        uuid uuid NOT NULL,
        user_uuid uuid NOT NULL,
        event_type varchar(48) NOT NULL,
        terms_version varchar(64) NULL,
        privacy_policy_version varchar(64) NULL,
        model_training_opt_in boolean NULL,
        model_training_notice_version varchar(64) NULL,
        disclosure_text text NOT NULL,
        actor_user_uuid uuid NULL,
        source varchar(32) NOT NULL,
        ip_address varchar(64) NULL,
        user_agent text NULL,
        created_timestamp timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT user_consent_events_uuid_unique UNIQUE (uuid),
        CONSTRAINT user_consent_events_user_uuid_foreign
          FOREIGN KEY (user_uuid)
          REFERENCES envoy_schema.users(uuid)
          ON DELETE CASCADE,
        CONSTRAINT user_consent_events_actor_user_uuid_foreign
          FOREIGN KEY (actor_user_uuid)
          REFERENCES envoy_schema.users(uuid)
          ON DELETE SET NULL,
        CONSTRAINT user_consent_events_event_type_check
          CHECK (
            event_type IN (
              'TERMS_ACCEPTED',
              'PRIVACY_POLICY_ACKNOWLEDGED',
              'MODEL_TRAINING_OPTED_IN',
              'MODEL_TRAINING_OPTED_OUT'
            )
          ),
        CONSTRAINT user_consent_events_source_check
          CHECK (source IN ('ONBOARDING', 'ACCOUNT', 'PRIVACY_REACK', 'ADMIN')),
        CONSTRAINT user_consent_events_disclosure_text_check
          CHECK (length(trim(disclosure_text)) > 0),
        CONSTRAINT user_consent_events_type_metadata_check
          CHECK (
            (event_type = 'TERMS_ACCEPTED'
              AND terms_version IS NOT NULL)
            OR
            (event_type = 'PRIVACY_POLICY_ACKNOWLEDGED'
              AND privacy_policy_version IS NOT NULL)
            OR
            (event_type = 'MODEL_TRAINING_OPTED_IN'
              AND model_training_opt_in = true
              AND model_training_notice_version IS NOT NULL)
            OR
            (event_type = 'MODEL_TRAINING_OPTED_OUT'
              AND model_training_opt_in = false
              AND model_training_notice_version IS NOT NULL)
          )
      );

      CREATE INDEX user_consent_events_user_created_idx
        ON envoy_schema.user_consent_events (user_uuid, created_timestamp DESC);

      CREATE INDEX user_consent_events_type_created_idx
        ON envoy_schema.user_consent_events (event_type, created_timestamp DESC);

      WITH preference_backfill AS (
        SELECT
          users.uuid AS user_uuid,
          md5('envoy:user-consent-preference:' || users.uuid::text) AS uuid_hash
        FROM envoy_schema.users
      )
      INSERT INTO envoy_schema.user_consent_preferences (
        uuid,
        user_uuid,
        terms_accepted,
        model_training_opt_in
      )
      SELECT
        (
          substr(uuid_hash, 1, 8) || '-' ||
          substr(uuid_hash, 9, 4) || '-' ||
          substr(uuid_hash, 13, 4) || '-' ||
          substr(uuid_hash, 17, 4) || '-' ||
          substr(uuid_hash, 21, 12)
        )::uuid,
        user_uuid,
        false,
        false
      FROM preference_backfill
      ON CONFLICT (user_uuid) DO NOTHING;
    `)
  }

  public async down() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM envoy_schema.user_consent_events)
          OR EXISTS (
            SELECT 1
            FROM envoy_schema.user_consent_preferences
            WHERE terms_accepted = true
               OR terms_version IS NOT NULL
               OR terms_accepted_at IS NOT NULL
               OR privacy_policy_version IS NOT NULL
               OR privacy_policy_acknowledged_at IS NOT NULL
               OR model_training_notice_version IS NOT NULL
               OR model_training_preference_updated_at IS NOT NULL
          )
        THEN
          RAISE EXCEPTION
            'Refusing to drop collected consent evidence; export/retention approval is required first.'
            USING ERRCODE = '55000';
        END IF;
      END
      $$;

      DROP TABLE IF EXISTS envoy_schema.user_consent_events;
      DROP TABLE IF EXISTS envoy_schema.user_consent_preferences;
    `)
  }
}
