import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddCrashSafeExtractionAttempts extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.model_training_extraction_audits
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_lifecycle_check,
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_status_check,
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_job_identifier_unique;

      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD COLUMN attempt_number integer NOT NULL DEFAULT 1,
        ADD COLUMN lease_expires_at timestamptz NULL;

      -- A STARTED row written by the pre-lease implementation cannot prove that its worker is
      -- still alive. Preserve it as an abandoned attempt so the job can be retried safely.
      UPDATE envoy_schema.model_training_extraction_audits
      SET status = 'ABANDONED',
          finished_at = NOW(),
          lease_expires_at = NULL
      WHERE status = 'STARTED';

      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD CONSTRAINT model_training_extraction_audits_job_attempt_unique
          UNIQUE (job_identifier, attempt_number),
        ADD CONSTRAINT model_training_extraction_audits_attempt_number_check
          CHECK (attempt_number > 0),
        ADD CONSTRAINT model_training_extraction_audits_status_check
          CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED', 'ABANDONED')),
        ADD CONSTRAINT model_training_extraction_audits_lifecycle_check
          CHECK (
            (status = 'STARTED'
              AND finished_at IS NULL
              AND lease_expires_at IS NOT NULL)
            OR
            (status IN ('COMPLETED', 'FAILED', 'ABANDONED')
              AND finished_at IS NOT NULL
              AND lease_expires_at IS NULL)
          );

      CREATE INDEX model_training_extraction_audits_started_lease_idx
        ON envoy_schema.model_training_extraction_audits (lease_expires_at)
        WHERE status = 'STARTED';
    `)
  }

  async down() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM envoy_schema.model_training_extraction_audits
          WHERE attempt_number > 1 OR status IN ('STARTED', 'ABANDONED')
        ) THEN
          RAISE EXCEPTION
            'Refusing to remove crash-safe extraction-attempt evidence.'
            USING ERRCODE = '55000';
        END IF;
      END
      $$;

      DROP INDEX IF EXISTS envoy_schema.model_training_extraction_audits_started_lease_idx;

      ALTER TABLE envoy_schema.model_training_extraction_audits
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_lifecycle_check,
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_status_check,
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_attempt_number_check,
        DROP CONSTRAINT IF EXISTS model_training_extraction_audits_job_attempt_unique,
        DROP COLUMN IF EXISTS lease_expires_at,
        DROP COLUMN IF EXISTS attempt_number;

      ALTER TABLE envoy_schema.model_training_extraction_audits
        ADD CONSTRAINT model_training_extraction_audits_job_identifier_unique
          UNIQUE (job_identifier),
        ADD CONSTRAINT model_training_extraction_audits_status_check
          CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED')),
        ADD CONSTRAINT model_training_extraction_audits_lifecycle_check
          CHECK (
            (status = 'STARTED' AND finished_at IS NULL)
            OR
            (status IN ('COMPLETED', 'FAILED') AND finished_at IS NOT NULL)
          );
    `)
  }
}
