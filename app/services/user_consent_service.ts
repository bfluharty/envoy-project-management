import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import {
  ACCOUNT_MODEL_TRAINING_DISCLOSURE_TEXT,
  CURRENT_MODEL_TRAINING_NOTICE_VERSION,
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
  MODEL_TRAINING_DISCLOSURE_TEXT,
  PRIVACY_REACKNOWLEDGMENT,
  PRIVACY_POLICY_ACKNOWLEDGMENT_TEXT,
  TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT,
} from '#constants/user_consent'
import UserConsentEvent, {
  type UserConsentEventSource,
  type UserConsentEventType,
} from '#models/user_consent_event'
import UserConsentPreference from '#models/user_consent_preference'

export interface CompleteUserConsentOnboardingInput {
  userUuid: string
  termsAccepted: boolean
  modelTrainingOptIn: boolean
  actorUserUuid?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface UpdateModelTrainingPreferenceInput {
  userUuid: string
  modelTrainingOptIn: boolean
  actorUserUuid?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AcknowledgePrivacyPolicyInput {
  userUuid: string
  actorUserUuid?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface SerializedUserConsentPreference {
  termsAccepted: boolean
  termsVersion: string | null
  termsAcceptedAt: string | null
  privacyPolicyVersion: string | null
  privacyPolicyAcknowledgedAt: string | null
  modelTrainingOptIn: boolean
  modelTrainingNoticeVersion: string | null
  modelTrainingPreferenceUpdatedAt: string | null
}

interface ConsentEventInput {
  userUuid: string
  eventType: UserConsentEventType
  source: UserConsentEventSource
  disclosureText: string
  actorUserUuid: string | null
  ipAddress: string | null
  userAgent: string | null
  termsVersion?: string | null
  privacyPolicyVersion?: string | null
  modelTrainingOptIn?: boolean | null
  modelTrainingNoticeVersion?: string | null
}

export class UserConsentError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 422,
    public readonly code = 'INVALID_CONSENT'
  ) {
    super(message)
    this.name = 'UserConsentError'
  }
}

function assertUserUuid(userUuid: string) {
  if (typeof userUuid !== 'string' || userUuid.trim().length === 0) {
    throw new UserConsentError('A user UUID is required.')
  }
}

function assertBoolean(value: unknown, fieldName: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new UserConsentError(`${fieldName} must be a boolean.`)
  }
}

function actorForUser(userUuid: string, actorUserUuid: string | null | undefined) {
  return actorUserUuid === undefined ? userUuid : actorUserUuid
}

async function insertInitialPreference(
  userUuid: string,
  actorUserUuid: string | null,
  trx?: TransactionClientContract
) {
  const actorPlaceholder = actorUserUuid ? '?::uuid' : 'NULL'
  const query = `
    INSERT INTO envoy_schema.user_consent_preferences (
      uuid,
      user_uuid,
      terms_accepted,
      model_training_opt_in,
      created_by_user_uuid,
      modified_by_user_uuid
    )
    VALUES (
      ?,
      ?::uuid,
      false,
      false,
      ${actorPlaceholder},
      ${actorPlaceholder}
    )
    ON CONFLICT (user_uuid) DO NOTHING
  `
  const bindings = actorUserUuid
    ? [uuidv4(), userUuid, actorUserUuid, actorUserUuid]
    : [uuidv4(), userUuid]

  if (trx) {
    await trx.rawQuery(query, bindings)
  } else {
    await db.rawQuery(query, bindings)
  }
}

async function ensurePreferenceRecord(
  userUuid: string,
  actorUserUuid: string | null,
  trx?: TransactionClientContract
) {
  await insertInitialPreference(userUuid, actorUserUuid, trx)

  const query = UserConsentPreference.query().where('user_uuid', userUuid)
  if (trx) {
    query.useTransaction(trx)
  }

  return query.firstOrFail()
}

async function lockedPreference(userUuid: string, trx: TransactionClientContract) {
  return UserConsentPreference.query()
    .useTransaction(trx)
    .where('user_uuid', userUuid)
    .forUpdate()
    .firstOrFail()
}

async function createEvent(input: ConsentEventInput, trx: TransactionClientContract) {
  return UserConsentEvent.create(
    {
      userUuid: input.userUuid,
      eventType: input.eventType,
      termsVersion: input.termsVersion ?? null,
      privacyPolicyVersion: input.privacyPolicyVersion ?? null,
      modelTrainingOptIn: input.modelTrainingOptIn ?? null,
      modelTrainingNoticeVersion: input.modelTrainingNoticeVersion ?? null,
      disclosureText: input.disclosureText,
      actorUserUuid: input.actorUserUuid,
      source: input.source,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
    { client: trx }
  )
}

function requestMetadata(input: { ipAddress?: string | null; userAgent?: string | null }) {
  return {
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }
}

export default class UserConsentService {
  /**
   * Creates the fail-closed current-state row when it is missing. Existing state is never changed.
   */
  public static async ensurePreference(
    userUuid: string,
    actorUserUuid: string | null = null
  ): Promise<UserConsentPreference> {
    assertUserUuid(userUuid)
    return ensurePreferenceRecord(userUuid, actorUserUuid)
  }

  public static async getPreference(userUuid: string): Promise<UserConsentPreference | null> {
    assertUserUuid(userUuid)
    return UserConsentPreference.query().where('user_uuid', userUuid).first()
  }

  public static async hasAcceptedTerms(userUuid: string): Promise<boolean> {
    const preference = await this.getPreference(userUuid)
    return preference?.termsAccepted === true
  }

  /**
   * Returns whether product data may be exposed for the current session. This is stricter than
   * Terms acceptance alone because a Legal-designated Privacy re-acknowledgment also gates access.
   * A missing row always fails closed.
   */
  public static async hasCurrentRequiredConsent(userUuid: string): Promise<boolean> {
    const preference = await this.getPreference(userUuid)
    return preference?.termsAccepted === true && !this.requiresPrivacyAcknowledgment(preference)
  }

  public static requiresPrivacyAcknowledgment(preference: UserConsentPreference | null): boolean {
    return (
      preference?.termsAccepted === true &&
      PRIVACY_REACKNOWLEDGMENT.enabled &&
      PRIVACY_REACKNOWLEDGMENT.requiredVersion !== null &&
      !PRIVACY_REACKNOWLEDGMENT.satisfyingPolicyVersions.includes(
        preference.privacyPolicyVersion ?? ''
      )
    )
  }

  /**
   * Records the first successful onboarding completion and its three audit events atomically.
   * A retry after completion returns the persisted state without writing duplicate events.
   */
  public static async completeOnboarding(
    input: CompleteUserConsentOnboardingInput
  ): Promise<UserConsentPreference> {
    assertUserUuid(input.userUuid)

    if (input.termsAccepted !== true) {
      throw new UserConsentError(
        'Terms acceptance is required to continue.',
        422,
        'TERMS_ACCEPTANCE_REQUIRED'
      )
    }
    assertBoolean(input.modelTrainingOptIn, 'modelTrainingOptIn')

    return db.transaction(async (trx) => {
      const actorUserUuid = actorForUser(input.userUuid, input.actorUserUuid)
      await ensurePreferenceRecord(input.userUuid, actorUserUuid, trx)
      const preference = await lockedPreference(input.userUuid, trx)

      if (preference.termsAccepted) {
        return preference
      }

      const now = DateTime.utc()
      preference.useTransaction(trx)
      preference.termsAccepted = true
      preference.termsVersion = CURRENT_TERMS_VERSION
      preference.termsAcceptedAt = now
      preference.privacyPolicyVersion = CURRENT_PRIVACY_POLICY_VERSION
      preference.privacyPolicyAcknowledgedAt = now
      preference.modelTrainingOptIn = input.modelTrainingOptIn
      preference.modelTrainingNoticeVersion = CURRENT_MODEL_TRAINING_NOTICE_VERSION
      preference.modelTrainingPreferenceUpdatedAt = now
      preference.modifiedByUserUuid = actorUserUuid
      preference.modifiedTimestamp = now
      await preference.save()

      const metadata = requestMetadata(input)
      await createEvent(
        {
          userUuid: input.userUuid,
          eventType: 'TERMS_ACCEPTED',
          termsVersion: CURRENT_TERMS_VERSION,
          disclosureText: TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT,
          actorUserUuid,
          source: 'ONBOARDING',
          ...metadata,
        },
        trx
      )
      await createEvent(
        {
          userUuid: input.userUuid,
          eventType: 'PRIVACY_POLICY_ACKNOWLEDGED',
          privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          disclosureText: TERMS_PRIVACY_ACKNOWLEDGMENT_TEXT,
          actorUserUuid,
          source: 'ONBOARDING',
          ...metadata,
        },
        trx
      )
      await createEvent(
        {
          userUuid: input.userUuid,
          eventType: input.modelTrainingOptIn
            ? 'MODEL_TRAINING_OPTED_IN'
            : 'MODEL_TRAINING_OPTED_OUT',
          modelTrainingOptIn: input.modelTrainingOptIn,
          modelTrainingNoticeVersion: CURRENT_MODEL_TRAINING_NOTICE_VERSION,
          disclosureText: MODEL_TRAINING_DISCLOSURE_TEXT,
          actorUserUuid,
          source: 'ONBOARDING',
          ...metadata,
        },
        trx
      )

      return preference
    })
  }

  /**
   * Updates only the optional model-training preference. An unchanged value is an idempotent no-op.
   */
  public static async updateModelTrainingPreference(
    input: UpdateModelTrainingPreferenceInput
  ): Promise<UserConsentPreference> {
    assertUserUuid(input.userUuid)
    assertBoolean(input.modelTrainingOptIn, 'modelTrainingOptIn')

    return db.transaction(async (trx) => {
      const actorUserUuid = actorForUser(input.userUuid, input.actorUserUuid)
      await ensurePreferenceRecord(input.userUuid, actorUserUuid, trx)
      const preference = await lockedPreference(input.userUuid, trx)

      if (!preference.termsAccepted) {
        throw new UserConsentError(
          'Terms acceptance is required before changing data preferences.',
          428,
          'CONSENT_REQUIRED'
        )
      }

      if (preference.modelTrainingOptIn === input.modelTrainingOptIn) {
        return preference
      }

      const now = DateTime.utc()
      preference.useTransaction(trx)
      preference.modelTrainingOptIn = input.modelTrainingOptIn
      preference.modelTrainingNoticeVersion = CURRENT_MODEL_TRAINING_NOTICE_VERSION
      preference.modelTrainingPreferenceUpdatedAt = now
      preference.modifiedByUserUuid = actorUserUuid
      preference.modifiedTimestamp = now
      await preference.save()

      await createEvent(
        {
          userUuid: input.userUuid,
          eventType: input.modelTrainingOptIn
            ? 'MODEL_TRAINING_OPTED_IN'
            : 'MODEL_TRAINING_OPTED_OUT',
          modelTrainingOptIn: input.modelTrainingOptIn,
          modelTrainingNoticeVersion: CURRENT_MODEL_TRAINING_NOTICE_VERSION,
          disclosureText: ACCOUNT_MODEL_TRAINING_DISCLOSURE_TEXT,
          actorUserUuid,
          source: 'ACCOUNT',
          ...requestMetadata(input),
        },
        trx
      )

      return preference
    })
  }

  /**
   * Records a Legal-designated Privacy Policy re-acknowledgment without changing Terms or
   * model-training state. Matching versions are an idempotent no-op.
   */
  public static async acknowledgePrivacyPolicy(
    input: AcknowledgePrivacyPolicyInput
  ): Promise<UserConsentPreference> {
    assertUserUuid(input.userUuid)

    return db.transaction(async (trx) => {
      const actorUserUuid = actorForUser(input.userUuid, input.actorUserUuid)
      await ensurePreferenceRecord(input.userUuid, actorUserUuid, trx)
      const preference = await lockedPreference(input.userUuid, trx)

      if (!preference.termsAccepted) {
        throw new UserConsentError(
          'Terms acceptance is required before acknowledging the Privacy Policy.',
          428,
          'CONSENT_REQUIRED'
        )
      }

      if (!this.requiresPrivacyAcknowledgment(preference)) {
        return preference
      }

      const now = DateTime.utc()
      preference.useTransaction(trx)
      preference.privacyPolicyVersion = CURRENT_PRIVACY_POLICY_VERSION
      preference.privacyPolicyAcknowledgedAt = now
      preference.modifiedByUserUuid = actorUserUuid
      preference.modifiedTimestamp = now
      await preference.save()

      await createEvent(
        {
          userUuid: input.userUuid,
          eventType: 'PRIVACY_POLICY_ACKNOWLEDGED',
          privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          disclosureText: PRIVACY_POLICY_ACKNOWLEDGMENT_TEXT,
          actorUserUuid,
          source: 'PRIVACY_REACK',
          ...requestMetadata(input),
        },
        trx
      )

      return preference
    })
  }

  public static serializePreference(
    preference: UserConsentPreference
  ): SerializedUserConsentPreference {
    return {
      termsAccepted: preference.termsAccepted,
      termsVersion: preference.termsVersion,
      termsAcceptedAt: preference.termsAcceptedAt?.toISO() ?? null,
      privacyPolicyVersion: preference.privacyPolicyVersion,
      privacyPolicyAcknowledgedAt: preference.privacyPolicyAcknowledgedAt?.toISO() ?? null,
      modelTrainingOptIn: preference.modelTrainingOptIn,
      modelTrainingNoticeVersion: preference.modelTrainingNoticeVersion,
      modelTrainingPreferenceUpdatedAt:
        preference.modelTrainingPreferenceUpdatedAt?.toISO() ?? null,
    }
  }
}
