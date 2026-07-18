import { BaseSchema } from '@adonisjs/lucid/schema'

export default class RequireTrainingEvidenceForAcceptedConsent extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.user_consent_preferences
        DROP CONSTRAINT IF EXISTS user_consent_preferences_training_metadata_check;

      -- Fail closed for malformed rows created before this stronger invariant. We cannot infer
      -- which training notice, if any, the user saw, so require onboarding again rather than
      -- fabricating consent evidence.
      UPDATE envoy_schema.user_consent_preferences
      SET terms_accepted = false,
          terms_version = NULL,
          terms_accepted_at = NULL,
          privacy_policy_version = NULL,
          privacy_policy_acknowledged_at = NULL,
          model_training_opt_in = false,
          model_training_notice_version = NULL,
          model_training_preference_updated_at = NULL,
          modified_by_user_uuid = NULL,
          modified_timestamp = NOW()
      WHERE NOT (
        (terms_accepted = false
          AND model_training_opt_in = false
          AND model_training_notice_version IS NULL
          AND model_training_preference_updated_at IS NULL)
        OR
        (terms_accepted = true
          AND model_training_notice_version IS NOT NULL
          AND model_training_preference_updated_at IS NOT NULL)
      );

      ALTER TABLE envoy_schema.user_consent_preferences
        ADD CONSTRAINT user_consent_preferences_training_metadata_check
        CHECK (
          (terms_accepted = false
            AND model_training_opt_in = false
            AND model_training_notice_version IS NULL
            AND model_training_preference_updated_at IS NULL)
          OR
          (terms_accepted = true
            AND model_training_notice_version IS NOT NULL
            AND model_training_preference_updated_at IS NOT NULL)
        );
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.user_consent_preferences
        DROP CONSTRAINT IF EXISTS user_consent_preferences_training_metadata_check;

      ALTER TABLE envoy_schema.user_consent_preferences
        ADD CONSTRAINT user_consent_preferences_training_metadata_check
        CHECK (
          (terms_accepted = false
            AND model_training_opt_in = false
            AND model_training_notice_version IS NULL
            AND model_training_preference_updated_at IS NULL)
          OR
          (terms_accepted = true
            AND model_training_notice_version IS NOT NULL
            AND model_training_preference_updated_at IS NOT NULL)
        );
    `)
  }
}
