import db from '@adonisjs/lucid/services/db'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import {
  CURRENT_MODEL_TRAINING_NOTICE_VERSION,
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
  MODEL_TRAINING_DISCLOSURE_TEXT,
  TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT,
} from '#constants/user_consent'

const SEEDED_AT = '2026-07-15T12:00:00.000Z'

const TEST_USERS = [
  {
    email: 'alice@example.com',
    modelTrainingOptIn: true,
    eventNumberBase: 0,
  },
  {
    email: 'bob@example.com',
    modelTrainingOptIn: false,
    eventNumberBase: 10,
  },
] as const

function eventUuid(eventNumber: number) {
  return `10000000-0000-4000-8000-${eventNumber.toString().padStart(12, '0')}`
}

export default class UserConsentEventSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    await db.transaction(async (trx) => {
      for (const testUser of TEST_USERS) {
        const user = await trx
          .from('envoy_schema.users')
          .where('email', testUser.email)
          .select('uuid')
          .first()

        if (!user) continue

        // These are development-only fake accounts. Keep their current state aligned with the
        // immutable events below so they can enter the application without repeating onboarding.
        await trx
          .from('envoy_schema.user_consent_preferences')
          .where('user_uuid', user.uuid)
          .update({
            terms_accepted: true,
            terms_version: CURRENT_TERMS_VERSION,
            terms_accepted_at: SEEDED_AT,
            privacy_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
            privacy_policy_acknowledged_at: SEEDED_AT,
            model_training_opt_in: testUser.modelTrainingOptIn,
            model_training_notice_version: CURRENT_MODEL_TRAINING_NOTICE_VERSION,
            model_training_preference_updated_at: SEEDED_AT,
            created_by_user_uuid: user.uuid,
            modified_by_user_uuid: user.uuid,
            modified_timestamp: SEEDED_AT,
          })

        const events = [
          {
            uuid: eventUuid(testUser.eventNumberBase + 1),
            eventType: 'TERMS_ACCEPTED',
            termsVersion: CURRENT_TERMS_VERSION,
            privacyPolicyVersion: null,
            modelTrainingOptIn: null,
            modelTrainingNoticeVersion: null,
            disclosureText: TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT,
          },
          {
            uuid: eventUuid(testUser.eventNumberBase + 2),
            eventType: 'PRIVACY_POLICY_ACKNOWLEDGED',
            termsVersion: null,
            privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            modelTrainingOptIn: null,
            modelTrainingNoticeVersion: null,
            disclosureText: TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT,
          },
          {
            uuid: eventUuid(testUser.eventNumberBase + 3),
            eventType: testUser.modelTrainingOptIn
              ? 'MODEL_TRAINING_OPTED_IN'
              : 'MODEL_TRAINING_OPTED_OUT',
            termsVersion: null,
            privacyPolicyVersion: null,
            modelTrainingOptIn: testUser.modelTrainingOptIn,
            modelTrainingNoticeVersion: CURRENT_MODEL_TRAINING_NOTICE_VERSION,
            disclosureText: MODEL_TRAINING_DISCLOSURE_TEXT,
          },
        ] as const

        for (const event of events) {
          await trx.rawQuery(
            `
              INSERT INTO envoy_schema.user_consent_events (
                uuid,
                user_uuid,
                event_type,
                terms_version,
                privacy_policy_version,
                model_training_opt_in,
                model_training_notice_version,
                disclosure_text,
                actor_user_uuid,
                source,
                ip_address,
                user_agent,
                created_timestamp
              )
              VALUES (
                ?::uuid,
                ?::uuid,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?::uuid,
                'ONBOARDING',
                '127.0.0.1',
                'Envoy development seeder',
                ?::timestamptz
              )
              ON CONFLICT (uuid) DO NOTHING
            `,
            [
              event.uuid,
              user.uuid,
              event.eventType,
              event.termsVersion,
              event.privacyPolicyVersion,
              event.modelTrainingOptIn,
              event.modelTrainingNoticeVersion,
              event.disclosureText,
              user.uuid,
              SEEDED_AT,
            ]
          )
        }
      }
    })
  }
}
