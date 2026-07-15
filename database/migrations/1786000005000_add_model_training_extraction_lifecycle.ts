import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddModelTrainingExtractionLifecycle extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD COLUMN status varchar(16) NOT NULL DEFAULT 'STARTED',
        ADD COLUMN finished_at timestamptz NULL;

      -- Audits written before this lifecycle existed could only commit after a successful
      -- extraction callback, so they represent completed jobs.
      UPDATE envoy_schema.model_training_extraction_audits
      SET status = 'COMPLETED',
          finished_at = created_timestamp;

      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD CONSTRAINT model_training_extraction_audits_status_check
          CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED')),
        ADD CONSTRAINT model_training_extraction_audits_lifecycle_check
          CHECK (
            (status = 'STARTED' AND finished_at IS NULL)
            OR
            (status IN ('COMPLETED', 'FAILED') AND finished_at IS NOT NULL)
          );

      CREATE INDEX model_training_extraction_audits_status_created_idx
        ON envoy_schema.model_training_extraction_audits (status, created_timestamp);
    `)
  }

  async down() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM envoy_schema.model_training_extraction_audits) THEN
          RAISE EXCEPTION
            'Refusing to remove model-training extraction lifecycle evidence.'
            USING ERRCODE = '55000';
        END IF;
      END
      $$;

      DROP INDEX IF EXISTS envoy_schema.model_training_extraction_audits_status_created_idx;

      ALTER TABLE envoy_schema.model_training_extraction_audits
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_lifecycle_check,
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_status_check,
        DROP COLUMN IF EXISTS finished_at,
        DROP COLUMN IF EXISTS status;
    `)
  }
}
