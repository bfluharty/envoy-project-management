import db from '@adonisjs/lucid/services/db'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { SEEDED_MODEL_TRAINING_AUDIT_UUID } from './16_model_training_extraction_audit_seeder.js'

const SEEDED_SNAPSHOT_UUID = '30000000-0000-4000-8000-000000000001'

export default class ModelTrainingExtractionUserSnapshotSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    // Only opted-in fake accounts are copied into this completed extraction's consent snapshot.
    await db.rawQuery(
      `
        INSERT INTO envoy_schema.model_training_extraction_user_snapshots (
          uuid,
          extraction_audit_uuid,
          user_uuid,
          model_training_opt_in,
          model_training_notice_version,
          model_training_preference_updated_at,
          created_timestamp
        )
        SELECT
          ?::uuid,
          audits.uuid,
          preferences.user_uuid,
          true,
          preferences.model_training_notice_version,
          preferences.model_training_preference_updated_at,
          '2026-07-15T12:30:00.000Z'::timestamptz
        FROM envoy_schema.model_training_extraction_audits AS audits
        JOIN envoy_schema.users AS users
          ON users.email = 'alice@example.com'
        JOIN envoy_schema.user_consent_preferences AS preferences
          ON preferences.user_uuid = users.uuid
        WHERE audits.uuid = ?::uuid
          AND preferences.terms_accepted = true
          AND preferences.model_training_opt_in = true
          AND preferences.model_training_notice_version IS NOT NULL
          AND preferences.model_training_preference_updated_at IS NOT NULL
        ON CONFLICT (extraction_audit_uuid, user_uuid) DO NOTHING
      `,
      [SEEDED_SNAPSHOT_UUID, SEEDED_MODEL_TRAINING_AUDIT_UUID]
    )
  }
}
