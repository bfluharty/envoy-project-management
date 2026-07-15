import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateModelTrainingExtractionAudits extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE VIEW envoy_schema.model_training_eligible_users AS
      SELECT
        user_uuid,
        model_training_notice_version,
        model_training_preference_updated_at
      FROM envoy_schema.user_consent_preferences
      WHERE terms_accepted = true
        AND model_training_opt_in = true
        AND model_training_notice_version IS NOT NULL
        AND model_training_preference_updated_at IS NOT NULL;

      CREATE TABLE envoy_schema.model_training_extraction_audits (
        id bigserial PRIMARY KEY,
        uuid uuid NOT NULL,
        job_identifier varchar(160) NOT NULL,
        extracted_at timestamptz NOT NULL,
        requested_categories jsonb NOT NULL,
        eligible_user_count integer NOT NULL,
        preference_snapshot jsonb NOT NULL,
        exclusion_policy_version varchar(64) NOT NULL,
        created_timestamp timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT model_training_extraction_audits_uuid_unique UNIQUE (uuid),
        CONSTRAINT model_training_extraction_audits_job_identifier_unique
          UNIQUE (job_identifier),
        CONSTRAINT model_training_extraction_audits_categories_check
          CHECK (jsonb_typeof(requested_categories) = 'array'),
        CONSTRAINT model_training_extraction_audits_snapshot_check
          CHECK (jsonb_typeof(preference_snapshot) = 'array'),
        CONSTRAINT model_training_extraction_audits_user_count_check
          CHECK (eligible_user_count >= 0)
      );

      CREATE INDEX model_training_extraction_audits_extracted_at_idx
        ON envoy_schema.model_training_extraction_audits (extracted_at DESC);
    `)
  }

  async down() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM envoy_schema.model_training_extraction_audits) THEN
          RAISE EXCEPTION
            'Refusing to drop model-training extraction audit evidence.'
            USING ERRCODE = '55000';
        END IF;
      END
      $$;

      DROP TABLE IF EXISTS envoy_schema.model_training_extraction_audits;
      DROP VIEW IF EXISTS envoy_schema.model_training_eligible_users;
    `)
  }
}
