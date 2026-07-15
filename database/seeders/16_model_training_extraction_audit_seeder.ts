import db from '@adonisjs/lucid/services/db'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { MODEL_TRAINING_EXCLUSION_POLICY_VERSION } from '#services/model_training_eligibility_service'

export const SEEDED_MODEL_TRAINING_AUDIT_UUID = '20000000-0000-4000-8000-000000000001'
export const SEEDED_MODEL_TRAINING_JOB_IDENTIFIER = 'seed:model-training:test-completed-v1'

export default class ModelTrainingExtractionAuditSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const eligibleUserCount = await db
      .from('envoy_schema.user_consent_preferences as preferences')
      .join('envoy_schema.users as users', 'users.uuid', 'preferences.user_uuid')
      .whereIn('users.email', ['alice@example.com', 'bob@example.com'])
      .where('preferences.terms_accepted', true)
      .where('preferences.model_training_opt_in', true)
      .count('* as total')
      .then((rows) => Number(rows[0].total))

    await db.rawQuery(
      `
        INSERT INTO envoy_schema.model_training_extraction_audits (
          uuid,
          job_identifier,
          attempt_number,
          extracted_at,
          requested_categories,
          eligible_user_count,
          exclusion_policy_version,
          status,
          finished_at,
          lease_expires_at,
          created_timestamp
        )
        VALUES (
          ?::uuid,
          ?,
          1,
          '2026-07-15T12:30:00.000Z'::timestamptz,
          ?::jsonb,
          ?,
          ?,
          'COMPLETED',
          '2026-07-15T12:31:00.000Z'::timestamptz,
          NULL,
          '2026-07-15T12:30:00.000Z'::timestamptz
        )
        ON CONFLICT (uuid) DO NOTHING
      `,
      [
        SEEDED_MODEL_TRAINING_AUDIT_UUID,
        SEEDED_MODEL_TRAINING_JOB_IDENTIFIER,
        JSON.stringify(['PROJECT_INPUTS', 'ENVOY_GENERATED_OUTPUTS']),
        eligibleUserCount,
        MODEL_TRAINING_EXCLUSION_POLICY_VERSION,
      ]
    )
  }
}
