import { BaseSchema } from '@adonisjs/lucid/schema'

export default class NormalizeModelTrainingExtractionSnapshots extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE OR REPLACE VIEW envoy_schema.model_training_eligible_users AS
      SELECT
        user_uuid,
        model_training_notice_version,
        model_training_preference_updated_at
      FROM envoy_schema.user_consent_preferences
      WHERE terms_accepted = true
        AND model_training_opt_in = true
        AND model_training_notice_version IS NOT NULL
        AND model_training_preference_updated_at IS NOT NULL;

      ALTER TABLE envoy_schema.model_training_extraction_audits
        DROP COLUMN IF EXISTS preference_snapshot;

      CREATE TABLE envoy_schema.model_training_extraction_user_snapshots (
        id bigserial PRIMARY KEY,
        uuid uuid NOT NULL,
        extraction_audit_uuid uuid NOT NULL,
        user_uuid uuid NOT NULL,
        model_training_opt_in boolean NOT NULL,
        model_training_notice_version varchar(64) NOT NULL,
        model_training_preference_updated_at timestamptz NOT NULL,
        created_timestamp timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT model_training_extraction_user_snapshots_uuid_unique UNIQUE (uuid),
        CONSTRAINT model_training_extraction_user_snapshots_job_user_unique
          UNIQUE (extraction_audit_uuid, user_uuid),
        CONSTRAINT model_training_extraction_user_snapshots_audit_foreign
          FOREIGN KEY (extraction_audit_uuid)
          REFERENCES envoy_schema.model_training_extraction_audits(uuid)
          ON DELETE CASCADE,
        CONSTRAINT model_training_extraction_user_snapshots_user_foreign
          FOREIGN KEY (user_uuid)
          REFERENCES envoy_schema.users(uuid)
          ON DELETE CASCADE,
        CONSTRAINT model_training_extraction_user_snapshots_opt_in_check
          CHECK (model_training_opt_in = true)
      );

      CREATE INDEX model_training_extraction_user_snapshots_user_idx
        ON envoy_schema.model_training_extraction_user_snapshots
          (user_uuid, created_timestamp DESC);
    `)
  }

  async down() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM envoy_schema.model_training_extraction_user_snapshots) THEN
          RAISE EXCEPTION
            'Refusing to drop model-training preference snapshot evidence.'
            USING ERRCODE = '55000';
        END IF;
      END
      $$;

      DROP TABLE IF EXISTS envoy_schema.model_training_extraction_user_snapshots;
      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD COLUMN IF NOT EXISTS preference_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD CONSTRAINT model_training_extraction_audits_snapshot_check
        CHECK (jsonb_typeof(preference_snapshot) = 'array');
    `)
  }
}
