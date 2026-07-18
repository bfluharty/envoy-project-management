import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { createHmac } from 'node:crypto'
import ModelTrainingExtractionAudit from '#models/model_training_extraction_audit'
import ModelTrainingExtractionUserSnapshot from '#models/model_training_extraction_user_snapshot'
import ModelTrainingDeidentificationService from '#services/model_training_deidentification_service'
import env from '#start/env'

export const MODEL_TRAINING_EXCLUSION_POLICY_VERSION =
  '2026-07-15-exclusions-and-fail-closed-dlp-v3'

export const ELIGIBLE_MODEL_TRAINING_DATA_CATEGORIES = [
  'PROJECT_INPUTS',
  'ENVOY_PROMPTS_AND_CHATS',
  'ENVOY_GENERATED_OUTPUTS',
  'PRODUCT_FEEDBACK',
  'DEIDENTIFIED_PRODUCT_SIGNALS',
] as const

export type EligibleModelTrainingDataCategory =
  (typeof ELIGIBLE_MODEL_TRAINING_DATA_CATEGORIES)[number]

export interface ModelTrainingApprovedRecord {
  category: EligibleModelTrainingDataCategory
  sourceType: string
  recordPseudonym: string
  ownerPseudonym: string
  occurredAt: DateTime
  content: unknown
}

export interface ModelTrainingReadOptions {
  limit?: number
  offset?: number
}

export interface ModelTrainingExtractionScope {
  extractedAt: DateTime
  readRecords(
    category: EligibleModelTrainingDataCategory,
    options?: ModelTrainingReadOptions
  ): Promise<readonly ModelTrainingApprovedRecord[]>
}

export interface RunModelTrainingExtractionInput {
  jobIdentifier: string
  categories: readonly EligibleModelTrainingDataCategory[]
}

export class ModelTrainingEligibilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelTrainingEligibilityError'
  }
}

const allowedCategories = new Set<string>(ELIGIBLE_MODEL_TRAINING_DATA_CATEGORIES)
const DEFAULT_PAGE_SIZE = 500
const MAX_PAGE_SIZE = 1_000
export const MODEL_TRAINING_EXTRACTION_LEASE_SECONDS = 5 * 60
const MODEL_TRAINING_EXTRACTION_HEARTBEAT_MS = 60_000

const SOURCE_VIEW_BY_CATEGORY: Record<EligibleModelTrainingDataCategory, string> = {
  PROJECT_INPUTS: 'envoy_schema.model_training_project_inputs',
  ENVOY_PROMPTS_AND_CHATS: 'envoy_schema.model_training_prompts_and_chats',
  ENVOY_GENERATED_OUTPUTS: 'envoy_schema.model_training_generated_outputs',
  PRODUCT_FEEDBACK: 'envoy_schema.model_training_product_feedback',
  DEIDENTIFIED_PRODUCT_SIGNALS: 'envoy_schema.model_training_deidentified_product_signals',
}

function validateInput(input: RunModelTrainingExtractionInput) {
  const jobIdentifier = input.jobIdentifier.trim()
  if (jobIdentifier.length === 0 || jobIdentifier.length > 160) {
    throw new ModelTrainingEligibilityError(
      'A job identifier of 160 characters or fewer is required.'
    )
  }
  if (input.categories.length === 0) {
    throw new ModelTrainingEligibilityError('At least one eligible data category is required.')
  }
  for (const category of input.categories) {
    if (!allowedCategories.has(category)) {
      throw new ModelTrainingEligibilityError(
        `Data category ${category} is not eligible for training.`
      )
    }
  }

  return {
    jobIdentifier,
    categories: [...new Set(input.categories)],
  }
}

function normalizeReadOptions(options: ModelTrainingReadOptions = {}) {
  const limit = options.limit ?? DEFAULT_PAGE_SIZE
  const offset = options.offset ?? 0

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new ModelTrainingEligibilityError(
      `Extraction page size must be between 1 and ${MAX_PAGE_SIZE}.`
    )
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ModelTrainingEligibilityError('Extraction offset must be a non-negative integer.')
  }

  return { limit, offset }
}

function asUtcDateTime(value: Date | string) {
  const dateTime =
    value instanceof Date ? DateTime.fromJSDate(value, { zone: 'utc' }) : DateTime.fromISO(value)

  if (!dateTime.isValid) {
    throw new ModelTrainingEligibilityError('An approved source record has an invalid timestamp.')
  }

  return dateTime.toUTC()
}

function createJobPseudonymizer(jobIdentifier: string) {
  const jobKey = createHmac('sha256', env.get('APP_KEY')).update(jobIdentifier).digest()

  return (namespace: 'owner' | 'record', value: string) =>
    createHmac('sha256', jobKey).update(`${namespace}:${value}`).digest('hex')
}

function timestampBinding(value: DateTime) {
  return value.toUTC().toISO()!
}

async function abandonExpiredAttempts(trx: TransactionClientContract, now: DateTime) {
  const result = await trx.rawQuery(
    `
      UPDATE envoy_schema.model_training_extraction_audits
      SET status = 'ABANDONED',
          finished_at = ?::timestamptz,
          lease_expires_at = NULL
      WHERE status = 'STARTED'
        AND lease_expires_at <= ?::timestamptz
      RETURNING uuid
    `,
    [timestampBinding(now), timestampBinding(now)]
  )
  return result.rows.length as number
}

async function renewAttemptLease(auditUuid: string) {
  const renewedAt = DateTime.utc()
  const leaseExpiresAt = renewedAt.plus({ seconds: MODEL_TRAINING_EXTRACTION_LEASE_SECONDS })
  const result = await db.rawQuery(
    `
      UPDATE envoy_schema.model_training_extraction_audits
      SET lease_expires_at = ?::timestamptz
      WHERE uuid = ?::uuid
        AND status = 'STARTED'
        AND lease_expires_at > ?::timestamptz
      RETURNING uuid
    `,
    [timestampBinding(leaseExpiresAt), auditUuid, timestampBinding(renewedAt)]
  )
  return result.rows.length === 1
}

function startAttemptHeartbeat(auditUuid: string) {
  let stopped = false
  let leaseLost = false
  let inFlight = Promise.resolve()

  const heartbeat = () => {
    inFlight = inFlight
      .then(async () => {
        if (stopped) return
        if (!(await renewAttemptLease(auditUuid))) {
          leaseLost = true
        }
      })
      // A transient heartbeat error is resolved by the terminal conditional update. It must not
      // become an unhandled rejection or hide an extraction callback error.
      .catch(() => {})
  }

  const timer = setInterval(heartbeat, MODEL_TRAINING_EXTRACTION_HEARTBEAT_MS)
  timer.unref()

  return {
    leaseWasLost: () => leaseLost,
    async stop() {
      stopped = true
      clearInterval(timer)
      await inFlight
    },
  }
}

async function markAttemptFailed(auditUuid: string) {
  const finishedAt = DateTime.utc()
  await db.rawQuery(
    `
      UPDATE envoy_schema.model_training_extraction_audits
      SET status = 'FAILED',
          finished_at = ?::timestamptz,
          lease_expires_at = NULL
      WHERE uuid = ?::uuid
        AND status = 'STARTED'
    `,
    [timestampBinding(finishedAt), auditUuid]
  )
}

async function completeAttempt(auditUuid: string) {
  return db.transaction(async (trx) => {
    const finishedAt = DateTime.utc()
    const result = await trx.rawQuery(
      `
        UPDATE envoy_schema.model_training_extraction_audits
        SET status = 'COMPLETED',
            finished_at = ?::timestamptz,
            lease_expires_at = NULL
        WHERE uuid = ?::uuid
          AND status = 'STARTED'
          AND lease_expires_at > ?::timestamptz
        RETURNING uuid
      `,
      [timestampBinding(finishedAt), auditUuid, timestampBinding(finishedAt)]
    )
    if (result.rows.length !== 1) return null

    return ModelTrainingExtractionAudit.query()
      .useTransaction(trx)
      .where('uuid', auditUuid)
      .firstOrFail()
  })
}

export default class ModelTrainingEligibilityService {
  /** Missing rows and false preferences always fail closed. No record-created-at comparison is made. */
  static async isUserEligible(userUuid: string): Promise<boolean> {
    const row = await db
      .from('envoy_schema.model_training_eligible_users')
      .where('user_uuid', userUuid)
      .first()
    return Boolean(row)
  }

  /**
   * Marks every expired lease as abandoned. This is public so a scheduler or worker supervisor can
   * reconcile stale attempts even when the original job is never submitted again.
   */
  static async reconcileStaleAttempts(asOf: DateTime = DateTime.utc()): Promise<number> {
    if (!asOf.isValid) {
      throw new ModelTrainingEligibilityError('A valid reconciliation timestamp is required.')
    }

    return db.transaction((trx) => abandonExpiredAttempts(trx, asOf.toUTC()))
  }

  /**
   * Runs an extraction against a locked consent snapshot. The callback receives only paged,
   * field-limited accessors backed by approved security-barrier views. It never receives a raw
   * database client, base-table name, token, mailbox record, or direct user identity field.
   */
  static async runExtraction<T>(
    input: RunModelTrainingExtractionInput,
    extract: (scope: ModelTrainingExtractionScope) => Promise<T>
  ): Promise<{ result: T; audit: ModelTrainingExtractionAudit }> {
    const normalized = validateInput(input)

    const startedAudit = await db.transaction(async (trx) => {
      // Serialize retries of the same job before any extraction work runs.
      await trx.rawQuery('SELECT pg_advisory_xact_lock(hashtext(?))', [normalized.jobIdentifier])
      const extractedAt = DateTime.utc()
      // Reconcile all expired attempts on every extraction, not just attempts for this job. The
      // public reconciler above also allows a production scheduler to run this independently.
      await abandonExpiredAttempts(trx, extractedAt)

      const existingAudits = await ModelTrainingExtractionAudit.query()
        .useTransaction(trx)
        .where('job_identifier', normalized.jobIdentifier)
        .orderBy('attempt_number', 'desc')

      if (existingAudits.some((audit) => audit.status === 'COMPLETED')) {
        throw new ModelTrainingEligibilityError(
          `Extraction job ${normalized.jobIdentifier} has already been recorded as completed.`
        )
      }
      if (existingAudits.some((audit) => audit.status === 'STARTED')) {
        throw new ModelTrainingEligibilityError(
          `Extraction job ${normalized.jobIdentifier} already has a live attempt.`
        )
      }

      const attemptNumber = (existingAudits[0]?.attemptNumber ?? 0) + 1
      const preferenceRows = await trx
        .from('envoy_schema.user_consent_preferences')
        .where('terms_accepted', true)
        .where('model_training_opt_in', true)
        .whereNotNull('model_training_notice_version')
        .whereNotNull('model_training_preference_updated_at')
        .select(
          'user_uuid',
          'model_training_notice_version',
          'model_training_preference_updated_at'
        )
        .forShare()

      const audit = await ModelTrainingExtractionAudit.create(
        {
          jobIdentifier: normalized.jobIdentifier,
          attemptNumber,
          extractedAt,
          requestedCategories: normalized.categories,
          eligibleUserCount: preferenceRows.length,
          exclusionPolicyVersion: MODEL_TRAINING_EXCLUSION_POLICY_VERSION,
          status: 'STARTED',
          finishedAt: null,
          leaseExpiresAt: extractedAt.plus({
            seconds: MODEL_TRAINING_EXTRACTION_LEASE_SECONDS,
          }),
        },
        { client: trx }
      )

      if (preferenceRows.length > 0) {
        await ModelTrainingExtractionUserSnapshot.createMany(
          preferenceRows.map((row) => ({
            extractionAuditUuid: audit.uuid,
            userUuid: row.user_uuid,
            modelTrainingOptIn: true as const,
            modelTrainingNoticeVersion: row.model_training_notice_version,
            modelTrainingPreferenceUpdatedAt: asUtcDateTime(
              row.model_training_preference_updated_at
            ),
          })),
          { client: trx }
        )
      }

      return audit
    })

    if (!(await renewAttemptLease(startedAudit.uuid))) {
      await this.reconcileStaleAttempts()
      throw new ModelTrainingEligibilityError(
        `Extraction job ${normalized.jobIdentifier} lost its active lease before it could start.`
      )
    }

    const heartbeat = startAttemptHeartbeat(startedAudit.uuid)
    let result: T

    try {
      result = await db.transaction(
        async (trx) => {
          const audit = await ModelTrainingExtractionAudit.query()
            .useTransaction(trx)
            .where('uuid', startedAudit.uuid)
            .firstOrFail()

          if (audit.status !== 'STARTED') {
            throw new ModelTrainingEligibilityError(
              `Extraction job ${normalized.jobIdentifier} is not in a startable state.`
            )
          }

          const requestedCategories = new Set<EligibleModelTrainingDataCategory>(
            normalized.categories
          )
          const pseudonymize = createJobPseudonymizer(normalized.jobIdentifier)
          const readRecords = async (
            category: EligibleModelTrainingDataCategory,
            options?: ModelTrainingReadOptions
          ): Promise<readonly ModelTrainingApprovedRecord[]> => {
            if (!allowedCategories.has(category)) {
              throw new ModelTrainingEligibilityError(
                `Data category ${category} is not eligible for training.`
              )
            }
            if (!requestedCategories.has(category)) {
              throw new ModelTrainingEligibilityError(
                `Data category ${category} was not approved for this extraction job.`
              )
            }

            const { limit, offset } = normalizeReadOptions(options)
            const snapshotUsers = trx
              .from('envoy_schema.model_training_extraction_user_snapshots')
              .where('extraction_audit_uuid', audit.uuid)
              .select('user_uuid')

            const rows = await trx
              .from(`${SOURCE_VIEW_BY_CATEGORY[category]} as approved_records`)
              .whereIn('approved_records.owner_user_uuid', snapshotUsers)
              .select(
                'approved_records.category',
                'approved_records.source_type',
                'approved_records.record_uuid',
                'approved_records.owner_user_uuid',
                'approved_records.occurred_at',
                'approved_records.content'
              )
              .orderBy('approved_records.occurred_at')
              .orderBy('approved_records.source_type')
              .orderBy('approved_records.record_uuid')
              .limit(limit)
              .offset(offset)

            return Object.freeze(
              rows.map((row) => {
                const ownerUserUuid = row.owner_user_uuid as string

                return Object.freeze({
                  category: row.category as EligibleModelTrainingDataCategory,
                  sourceType: row.source_type as string,
                  recordPseudonym: pseudonymize(
                    'record',
                    `${row.source_type as string}:${row.record_uuid as string}`
                  ),
                  ownerPseudonym: pseudonymize('owner', ownerUserUuid),
                  occurredAt: asUtcDateTime(row.occurred_at),
                  content: ModelTrainingDeidentificationService.deidentifyForExport(row.content),
                })
              })
            )
          }

          const extractedResult = await extract(
            Object.freeze({ extractedAt: audit.extractedAt, readRecords })
          )
          return extractedResult
        },
        { isolationLevel: 'repeatable read' }
      )
    } catch (error) {
      await heartbeat.stop()
      await markAttemptFailed(startedAudit.uuid)
      throw error
    }

    await heartbeat.stop()
    const completedAudit = await completeAttempt(startedAudit.uuid)
    if (!completedAudit) {
      await this.reconcileStaleAttempts()
      const leaseState = heartbeat.leaseWasLost() ? 'heartbeat ownership was lost' : 'lease expired'
      throw new ModelTrainingEligibilityError(
        `Extraction job ${normalized.jobIdentifier} lost its active lease before completion (${leaseState}).`
      )
    }

    return { result, audit: completedAudit }
  }
}
