import db from '@adonisjs/lucid/services/db'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    // Seeded and newly added development users start fail-closed. Existing choices are never reset.
    await db.rawQuery(`
      WITH preference_seed AS (
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
      FROM preference_seed
      ON CONFLICT (user_uuid) DO NOTHING
    `)
  }
}
