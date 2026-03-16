import axios from 'axios'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { ensureValidToken } from './inbox_connection_service.js'
import type UserInboxConnection from '#models/user_inbox_connection'

const baseUrl = () => env.get('EMAIL_SERVICE_URL')
const apiKey = () => env.get('EMAIL_SERVICE_API_KEY')

function authHeaders(): Record<string, string> {
  const key = apiKey()
  if (key) return { Authorization: `Bearer ${key}` }
  return {}
}

export interface InboxMessageSummary {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  date: string
  snippet?: string
}

export interface InboxMessageDetail {
  id: string
  from: string
  to: string
  cc?: string
  subject: string
  body: string
  date: string
  messageId?: string
  references?: string
}

/**
 * List inbox messages via the email service (POST /inbox/list).
 */
export async function listInboxMessages(
  connection: UserInboxConnection,
  options?: { maxResults?: number; afterDate?: Date }
): Promise<InboxMessageSummary[]> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  const conn = await ensureValidToken(connection)
  const body: Record<string, unknown> = {
    provider: conn.provider,
    accessToken: conn.accessToken,
    maxResults: options?.maxResults ?? 50,
  }
  if (options?.afterDate) {
    body.afterDate = options.afterDate.toISOString()
  }

  const { data } = await axios.post<{ messages?: InboxMessageSummary[] }>(
    `${url.replace(/\/$/, '')}/inbox/list`,
    body,
    { headers: { 'Content-Type': 'application/json', ...authHeaders() }, timeout: 30_000 }
  )
  const messages = Array.isArray(data?.messages) ? data.messages : []
  logger.info({ count: messages.length }, 'Email service /inbox/list returned messages')
  return messages
}

/**
 * Get a single message body via the email service (POST /inbox/message).
 */
export async function getInboxMessage(
  connection: UserInboxConnection,
  messageId: string
): Promise<{
  from: string
  to: string
  cc?: string
  subject: string
  body: string
  date: Date
  messageId?: string
  references?: string
} | null> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  const conn = await ensureValidToken(connection)
  const { data } = await axios.post<{ message: InboxMessageDetail | null }>(
    `${url.replace(/\/$/, '')}/inbox/message`,
    { provider: conn.provider, accessToken: conn.accessToken, messageId },
    { headers: { 'Content-Type': 'application/json', ...authHeaders() }, timeout: 15_000 }
  )
  const msg = data.message
  if (!msg) return null
  return {
    from: msg.from,
    to: msg.to,
    cc: msg.cc,
    subject: msg.subject,
    body: msg.body,
    date: new Date(msg.date),
    messageId: msg.messageId,
    references: msg.references,
  }
}

export interface SendOnBehalfParams {
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
  threadId?: string
}

/**
 * Send an email on behalf of the user via the email service (POST /send-on-behalf).
 * Uses the connection's refreshed access token. Returns the provider message id if available (Gmail; Microsoft returns '').
 */
export async function sendOnBehalf(
  connection: UserInboxConnection,
  params: SendOnBehalfParams
): Promise<string> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  const conn = await ensureValidToken(connection)
  const body: Record<string, unknown> = {
    provider: conn.provider,
    accessToken: conn.accessToken,
    to: params.to,
    subject: params.subject,
    body: params.body,
  }
  if (params.inReplyTo) body.inReplyTo = params.inReplyTo
  if (params.references) body.references = params.references
  if (params.threadId) body.threadId = params.threadId

  const sendUrl = `${url.replace(/\/$/, '')}/send-on-behalf`
  logger.info(
    { url: sendUrl, to: params.to, subject: params.subject, provider: conn.provider },
    'Calling envoy-email-service POST /send-on-behalf'
  )

  const { data } = await axios.post<{ messageId?: string }>(sendUrl, body, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    timeout: 30_000,
  })
  return typeof data.messageId === 'string' ? data.messageId : ''
}
