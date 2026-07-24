export const CURRENT_TERMS_VERSION = '2026-07-15-terms-v1'
export const CURRENT_PRIVACY_POLICY_VERSION = '2026-07-23-privacy-v3'
export const CURRENT_MODEL_TRAINING_NOTICE_VERSION = '2026-07-15-model-training-v1'
export const CONSENT_ENFORCEMENT_STARTED_AT_ISO = '2026-07-15T00:00:00.000Z'

export interface PrivacyReacknowledgmentConfig {
  enabled: boolean
  requiredVersion: string | null
  satisfyingPolicyVersions: readonly string[]
}

// When Legal designates a material Privacy revision, set requiredVersion to that version and
// reset satisfyingPolicyVersions to it. For later non-material edits, keep the required version
// and append each newer policy version so acknowledgments never get downgraded or re-prompted.
export const PRIVACY_REACKNOWLEDGMENT: PrivacyReacknowledgmentConfig = {
  enabled: true,
  requiredVersion: CURRENT_PRIVACY_POLICY_VERSION,
  satisfyingPolicyVersions: [CURRENT_PRIVACY_POLICY_VERSION],
}

export const TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT =
  "I agree to Envoy's Terms of Service and acknowledge the Privacy Policy."

export const PRIVACY_POLICY_ACKNOWLEDGMENT_TEXT = 'I acknowledge the updated Privacy Policy.'

export const MODEL_TRAINING_CONTROL_TEXT =
  'Allow Envoy to use eligible content I submit to improve Envoy models.'

export const MODEL_TRAINING_SUPPORTING_TEXT =
  'This is optional, does not affect access to Envoy, and can be changed later in Account Settings. When enabled, eligible historical and future Envoy-native data may be used. Connected Google or Microsoft mailbox data is always excluded. Turning this off stops new training-data extractions but may not reverse training that has already completed.'

// This exact combined copy is retained on every onboarding preference event as audit evidence.
export const MODEL_TRAINING_DISCLOSURE_TEXT = `${MODEL_TRAINING_CONTROL_TEXT} ${MODEL_TRAINING_SUPPORTING_TEXT}`

export const ACCOUNT_MODEL_TRAINING_DISCLOSURE_TEXT =
  'Allow Envoy to use my eligible Envoy content to improve Envoy models. When enabled, eligible content from both before and after you opt in may be used. Connected email data, credentials, payment data, and direct identifiers are excluded. Turning this off stops your data from being added to new training runs but may not reverse training that has already completed.'
