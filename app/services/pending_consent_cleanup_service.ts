import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { CONSENT_ENFORCEMENT_STARTED_AT_ISO } from '#constants/user_consent'
import User from '#models/user'
import UserConsentPreference from '#models/user_consent_preference'
import UserInboxConnection from '#models/user_inbox_connection'
import { stopEmailWatch } from '#services/email_watch_service'
import {
  decryptConnectionAccessToken,
  decryptConnectionRefreshToken,
} from '#services/oauth_token_encryption_service'

const DEFAULT_PENDING_RETENTION_DAYS = 30

export interface PendingConsentCleanupResult {
  checked: number
  deleted: number
  failed: number
  lockAcquired: boolean
}

export interface PendingConsentCleanupDependencies {
  stopWatch: typeof stopEmailWatch
  revokeAuthorization: (connection: UserInboxConnection) => Promise<void>
}

const defaultDependencies: PendingConsentCleanupDependencies = {
  stopWatch: stopEmailWatch,
  revokeAuthorization: revokeProviderAuthorization,
}

const CLEANUP_ADVISORY_LOCK_ID = 1_786_000_000

async function revokeGoogleAuthorization(connection: UserInboxConnection) {
  const token =
    decryptConnectionRefreshToken(connection) ?? decryptConnectionAccessToken(connection)
  const response = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok && response.status !== 400) {
    throw new Error(`Google token revocation returned ${response.status}`)
  }
}

async function revokeProviderAuthorization(connection: UserInboxConnection) {
  if (connection.provider === 'gmail') {
    await revokeGoogleAuthorization(connection)
    return
  }

  // Microsoft Graph does not expose a per-token revocation endpoint for this app flow.
  // Deleting the encrypted local credentials still prevents Envoy from using the grant.
  logger.info(
    { connectionUuid: connection.uuid, provider: connection.provider },
    'Provider has no supported per-token revocation endpoint; removing local credentials'
  )
}

function isNeverCompletedRegistration(user: User, preference: UserConsentPreference) {
  const enforcementStart = DateTime.fromISO(CONSENT_ENFORCEMENT_STARTED_AT_ISO)
  return user.createdTimestamp >= enforcementStart && preference.createdByUserUuid !== null
}

async function deleteUserDependents(userUuid: string, trx: TransactionClientContract) {
  await trx.rawQuery(
    `
      UPDATE envoy_schema.anonymous_onboarding_drafts
      SET registered_user_uuid = NULL,
          consumed_by_user_uuid = NULL,
          consumed_project_uuid = NULL
      WHERE registered_user_uuid = ?::uuid
         OR consumed_by_user_uuid = ?::uuid
         OR consumed_project_uuid IN (
           SELECT uuid FROM envoy_schema.projects WHERE user_uuid = ?::uuid
         )
    `,
    [userUuid, userUuid, userUuid]
  )
  await trx.rawQuery(
    `
      UPDATE envoy_schema.vendor_listings
      SET claimed_by_user_uuid = NULL,
          claimed_at = NULL,
          claim_status = 'UNCLAIMED'
      WHERE claimed_by_user_uuid = ?::uuid
    `,
    [userUuid]
  )
  await trx.rawQuery(
    'UPDATE envoy_schema.vendor_listings SET owner_user_uuid = NULL WHERE owner_user_uuid = ?::uuid',
    [userUuid]
  )
  await trx.rawQuery(
    `
      DELETE FROM envoy_schema.project_insights
      WHERE project_uuid IN (
        SELECT uuid FROM envoy_schema.projects WHERE user_uuid = ?::uuid
      )
    `,
    [userUuid]
  )
  await trx.rawQuery(
    `
      DELETE FROM envoy_schema.conversation_turns
      WHERE conversation_uuid IN (
        SELECT conversations.uuid
        FROM envoy_schema.conversations AS conversations
        JOIN envoy_schema.projects AS projects
          ON projects.uuid = conversations.project_uuid
        WHERE projects.user_uuid = ?::uuid
      )
    `,
    [userUuid]
  )
  await trx.rawQuery(
    `
      DELETE FROM envoy_schema.conversations
      WHERE project_uuid IN (
        SELECT uuid FROM envoy_schema.projects WHERE user_uuid = ?::uuid
      )
    `,
    [userUuid]
  )
  await trx.rawQuery(
    `
      DELETE FROM envoy_schema.project_vendors
      WHERE project_uuid IN (
        SELECT uuid FROM envoy_schema.projects WHERE user_uuid = ?::uuid
      )
         OR vendor_uuid IN (
           SELECT uuid FROM envoy_schema.vendors WHERE user_uuid = ?::uuid
         )
    `,
    [userUuid, userUuid]
  )
  await trx.rawQuery('DELETE FROM envoy_schema.vendors WHERE user_uuid = ?::uuid', [userUuid])
  await trx.rawQuery('DELETE FROM envoy_schema.projects WHERE user_uuid = ?::uuid', [userUuid])
}

async function cleanupCandidate(
  userUuid: string,
  trx: TransactionClientContract,
  dependencies: PendingConsentCleanupDependencies
) {
  const user = await User.query().useTransaction(trx).where('uuid', userUuid).forUpdate().first()
  if (!user) return false

  const preference = await UserConsentPreference.query()
    .useTransaction(trx)
    .where('user_uuid', user.uuid)
    .forUpdate()
    .first()

  // Lock and re-check immediately before external revocation and deletion. This prevents a
  // concurrent consent completion from racing the cleanup operation.
  if (preference?.termsAccepted) return false
  if (preference && !isNeverCompletedRegistration(user, preference)) return false
  if (!preference && user.createdTimestamp < DateTime.fromISO(CONSENT_ENFORCEMENT_STARTED_AT_ISO)) {
    return false
  }

  const connections = await UserInboxConnection.query()
    .useTransaction(trx)
    .where('user_uuid', user.uuid)
  for (const connection of connections) {
    connection.useTransaction(trx)
    const stopResult = await dependencies.stopWatch(connection)
    if (!stopResult.success) {
      logger.warn(
        { userUuid: user.uuid, connectionUuid: connection.uuid },
        'Pending registration watch stop failed; continuing best-effort cleanup'
      )
    }

    try {
      await dependencies.revokeAuthorization(connection)
    } catch (error) {
      logger.warn(
        { err: error, userUuid: user.uuid, connectionUuid: connection.uuid },
        'Pending registration provider revocation failed; continuing cleanup'
      )
    }
  }

  await deleteUserDependents(user.uuid, trx)
  user.useTransaction(trx)
  await user.delete()
  return true
}

export default class PendingConsentCleanupService {
  static async cleanupWithLock(
    now = DateTime.utc(),
    retentionDays = DEFAULT_PENDING_RETENTION_DAYS,
    dependencies = defaultDependencies
  ): Promise<PendingConsentCleanupResult> {
    return db.transaction(async (trx) => {
      const lockResult = await trx.rawQuery('SELECT pg_try_advisory_xact_lock(?) AS acquired', [
        CLEANUP_ADVISORY_LOCK_ID,
      ])
      if (lockResult.rows[0]?.acquired !== true) {
        return { checked: 0, deleted: 0, failed: 0, lockAcquired: false }
      }

      return this.cleanup(now, retentionDays, dependencies)
    })
  }

  static async cleanup(
    now = DateTime.utc(),
    retentionDays = DEFAULT_PENDING_RETENTION_DAYS,
    dependencies = defaultDependencies
  ): Promise<PendingConsentCleanupResult> {
    const cutoff = now.minus({ days: retentionDays })
    const candidateUserUuids = new Set<string>()
    const preferenceCandidates = await db
      .from('envoy_schema.user_consent_preferences as preferences')
      .join('envoy_schema.users as users', 'users.uuid', 'preferences.user_uuid')
      .where('preferences.terms_accepted', false)
      .whereNotNull('preferences.created_by_user_uuid')
      .where('users.created_timestamp', '>=', CONSENT_ENFORCEMENT_STARTED_AT_ISO)
      .where('users.created_timestamp', '<=', cutoff.toSQL())
      .select('users.uuid')

    for (const row of preferenceCandidates) {
      candidateUserUuids.add(row.uuid)
    }

    // A failure between account creation and initial preference insertion must not strand provider
    // credentials forever. Existing pre-rollout users were backfilled, so this missing-row branch
    // is deliberately limited to accounts created after consent enforcement began.
    const missingPreferenceUsers = await db
      .from('envoy_schema.users as users')
      .leftJoin(
        'envoy_schema.user_consent_preferences as preferences',
        'preferences.user_uuid',
        'users.uuid'
      )
      .whereNull('preferences.user_uuid')
      .where('users.created_timestamp', '>=', CONSENT_ENFORCEMENT_STARTED_AT_ISO)
      .where('users.created_timestamp', '<=', cutoff.toSQL())
      .select('users.uuid')

    for (const row of missingPreferenceUsers) {
      candidateUserUuids.add(row.uuid)
    }

    let checked = 0
    let deleted = 0
    let failed = 0

    for (const userUuid of candidateUserUuids) {
      checked += 1
      try {
        const wasDeleted = await db.transaction((trx) =>
          cleanupCandidate(userUuid, trx, dependencies)
        )
        if (wasDeleted) {
          deleted += 1
          logger.info({ userUuid }, 'Deleted expired pending consent registration')
        }
      } catch (error) {
        failed += 1
        logger.error(
          { err: error, userUuid },
          'Failed to delete expired pending consent registration'
        )
      }
    }

    return { checked, deleted, failed, lockAcquired: true }
  }
}
