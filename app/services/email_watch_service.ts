import axios from 'axios'
import { DateTime } from 'luxon'
import env from '#start/env'
import UserInboxConnection from '#models/user_inbox_connection'
import logger from '@adonisjs/core/services/logger'
import { ensureValidToken } from '#services/inbox_connection_service'
import { decryptConnectionAccessToken } from '#services/oauth_token_encryption_service'
import { buildManualBackfillEvent, enqueueEmailSyncEvent } from '#services/email_sync_event_service'

interface EmailServiceWatchResult {
  provider: string
  providerCursor?: string
  providerSubscriptionId?: string
  subscriptionClientState?: string
  expiresAt?: string
}

interface EmailWatchOperationResult {
  success: boolean
  connection: UserInboxConnection
  error?: string
}

interface RenewDueEmailWatchesResult {
  checked: number
  renewed: number
  failed: number
}

const GMAIL_RENEWAL_BUFFER_HOURS = 12
const MICROSOFT_RENEWAL_BUFFER_HOURS = 24

function baseUrl() {
  return env.get('EMAIL_SERVICE_URL')?.replace(/\/$/, '') ?? ''
}

function authHeaders(): Record<string, string> {
  const key = env.get('EMAIL_SERVICE_API_KEY')
  return key ? { Authorization: `Bearer ${key}` } : {}
}

function expiresAtToDateTime(value: string | undefined): DateTime | null {
  if (!value) return null

  const parsed = DateTime.fromISO(value, { zone: 'utc' })
  return parsed.isValid ? parsed : null
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseError = error.response?.data as { error?: unknown } | undefined
    if (typeof responseError?.error === 'string') {
      return responseError.error
    }
  }

  return error instanceof Error ? error.message : 'Email watch operation failed'
}

function isAuthorizationFailure(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === 401 || status === 403) {
      return true
    }
  }

  const message = error instanceof Error ? error.message : ''
  return /(^|[^0-9])(401|403)([^0-9]|$)/.test(message)
}

async function markReauthRequired(connection: UserInboxConnection, reason: string) {
  connection.merge({
    status: 'reauth_required',
    watchStatus: 'error',
    reauthReason: reason,
    reauthRequiredAt: DateTime.utc(),
    lastSyncError: reason,
  })
  await connection.save()
}

async function markWatchError(connection: UserInboxConnection, reason: string) {
  connection.merge({
    watchStatus: 'error',
    lastSyncError: reason,
  })
  await connection.save()
}

async function callEmailServiceWatchEndpoint<T>(
  path: '/watches/setup' | '/watches/renew' | '/watches/stop',
  body: Record<string, unknown>
): Promise<T> {
  const url = baseUrl()
  if (!url) {
    throw new Error('EMAIL_SERVICE_URL is not set')
  }

  const { data } = await axios.post<T>(`${url}${path}`, body, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    timeout: 30_000,
  })
  return data
}

async function buildWatchRequestBody(connection: UserInboxConnection) {
  const conn = await ensureValidToken(connection)
  return {
    connection: conn,
    body: {
      provider: conn.provider,
      accessToken: decryptConnectionAccessToken(conn),
      email: conn.email,
      connectionUuid: conn.uuid,
      providerSubscriptionId: conn.providerSubscriptionId ?? undefined,
    },
  }
}

function applyWatchResult(connection: UserInboxConnection, result: EmailServiceWatchResult) {
  connection.watchStatus = 'active'
  connection.lastSyncError = null

  if (connection.provider === 'gmail') {
    connection.providerCursor = result.providerCursor ?? connection.providerCursor
    connection.watchExpiresAt = expiresAtToDateTime(result.expiresAt)
  }

  if (connection.provider === 'microsoft') {
    connection.providerSubscriptionId =
      result.providerSubscriptionId ?? connection.providerSubscriptionId
    connection.subscriptionClientState =
      result.subscriptionClientState ?? connection.subscriptionClientState
    connection.subscriptionExpiresAt = expiresAtToDateTime(result.expiresAt)
  }
}

async function handleWatchFailure(
  connection: UserInboxConnection,
  error: unknown
): Promise<EmailWatchOperationResult> {
  const reason = errorMessage(error)
  if (isAuthorizationFailure(error)) {
    await markReauthRequired(connection, reason)
  } else {
    await markWatchError(connection, reason)
  }

  logger.error({ err: error, connectionUuid: connection.uuid }, 'Email watch operation failed')
  return { success: false, connection, error: reason }
}

export async function setupEmailWatch(
  connection: UserInboxConnection
): Promise<EmailWatchOperationResult> {
  try {
    const { connection: conn, body } = await buildWatchRequestBody(connection)
    const result = await callEmailServiceWatchEndpoint<EmailServiceWatchResult>(
      '/watches/setup',
      body
    )
    applyWatchResult(conn, result)
    await conn.save()
    await enqueueEmailSyncEvent(buildManualBackfillEvent(conn)).catch((error) => {
      logger.warn(
        { err: error, connectionUuid: conn.uuid },
        'Email watch setup succeeded but initial backfill enqueue failed'
      )
    })
    return { success: true, connection: conn }
  } catch (error) {
    return handleWatchFailure(connection, error)
  }
}

export async function renewEmailWatch(
  connection: UserInboxConnection
): Promise<EmailWatchOperationResult> {
  try {
    const { connection: conn, body } = await buildWatchRequestBody(connection)
    const shouldSetupMicrosoft = conn.provider === 'microsoft' && !conn.providerSubscriptionId
    const result = await callEmailServiceWatchEndpoint<EmailServiceWatchResult>(
      shouldSetupMicrosoft ? '/watches/setup' : '/watches/renew',
      body
    )
    applyWatchResult(conn, result)
    await conn.save()
    return { success: true, connection: conn }
  } catch (error) {
    return handleWatchFailure(connection, error)
  }
}

export async function stopEmailWatch(
  connection: UserInboxConnection
): Promise<EmailWatchOperationResult> {
  try {
    const { connection: conn, body } = await buildWatchRequestBody(connection)
    await callEmailServiceWatchEndpoint('/watches/stop', body)
    conn.merge({
      watchStatus: 'not_configured',
      watchExpiresAt: null,
      providerSubscriptionId: null,
      subscriptionClientState: null,
      subscriptionExpiresAt: null,
    })
    await conn.save()
    return { success: true, connection: conn }
  } catch (error) {
    return handleWatchFailure(connection, error)
  }
}

function watchIsDue(connection: UserInboxConnection, now: DateTime) {
  if (
    connection.watchStatus === 'not_configured' ||
    connection.watchStatus === 'renewal_required'
  ) {
    return true
  }

  if (connection.watchStatus !== 'active') {
    return false
  }

  if (connection.provider === 'gmail') {
    return (
      !connection.watchExpiresAt ||
      connection.watchExpiresAt <= now.plus({ hours: GMAIL_RENEWAL_BUFFER_HOURS })
    )
  }

  if (connection.provider === 'microsoft') {
    return (
      !connection.subscriptionExpiresAt ||
      connection.subscriptionExpiresAt <= now.plus({ hours: MICROSOFT_RENEWAL_BUFFER_HOURS })
    )
  }

  return false
}

export async function renewDueEmailWatches(
  now = DateTime.utc()
): Promise<RenewDueEmailWatchesResult> {
  const connections = await UserInboxConnection.query()
    .where('status', 'active')
    .where('is_primary', true)

  let checked = 0
  let renewed = 0
  let failed = 0

  for (const connection of connections) {
    if (!watchIsDue(connection, now)) {
      continue
    }

    checked += 1
    const result = await renewEmailWatch(connection)
    if (result.success) {
      renewed += 1
    } else {
      failed += 1
    }
  }

  return { checked, renewed, failed }
}
