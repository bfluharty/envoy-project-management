import axios from 'axios'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { google, gmail_v1 } from 'googleapis'
import { ensureValidToken } from './inbox_connection_service.js'
import type UserInboxConnection from '#models/user_inbox_connection'
import {
  decryptConnectionAccessToken,
  decryptConnectionRefreshToken,
} from './oauth_token_encryption_service.js'

const baseUrl = () => env.get('EMAIL_SERVICE_URL')
const apiKey = () => env.get('EMAIL_SERVICE_API_KEY')

function authHeaders(): Record<string, string> {
  const key = apiKey()
  if (key) return { Authorization: `Bearer ${key}` }
  return {}
}

export interface InboxMessageSummary {
  id: string
  threadId: string | null
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
  inReplyTo?: string
  references?: string
  threadId?: string | null
}

export interface ListInboxMessagesOptions {
  maxResults?: number
  afterDate?: Date
  /**
   * Optional mailbox selector supported by some email-service deployments.
   * Examples: 'inbox', 'sent'
   */
  mailbox?: string
}

export interface ListInboxChangesOptions {
  cursor?: string
  messageId?: string
}

export interface SearchVendorMessagesOptions {
  vendorEmails: string[]
  maxResults?: number
  afterDate?: Date
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined,
  name: string
): string {
  if (!headers?.length) return ''
  const match = headers.find((header) => (header.name || '').toLowerCase() === name.toLowerCase())
  return match?.value || ''
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLength)
  return Buffer.from(padded, 'base64').toString('utf8')
}

function extractPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined | null): string {
  if (!part) return ''

  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data)
  }

  for (const child of part.parts || []) {
    const text = extractPlainTextBody(child)
    if (text.trim()) return text
  }

  if (part.body?.data) {
    return decodeBase64Url(part.body.data)
  }

  return ''
}

function buildGmailAuth(connection: UserInboxConnection) {
  const oauth2 = new google.auth.OAuth2()
  oauth2.setCredentials({
    access_token: decryptConnectionAccessToken(connection),
    refresh_token: decryptConnectionRefreshToken(connection) ?? undefined,
  })
  return oauth2
}

/**
 * List inbox messages via the email service (POST /inbox/list).
 */
export async function listInboxMessages(
  connection: UserInboxConnection,
  options?: ListInboxMessagesOptions
): Promise<InboxMessageSummary[]> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  const conn = await ensureValidToken(connection)
  const accessToken = decryptConnectionAccessToken(conn)
  const body: Record<string, unknown> = {
    provider: conn.provider,
    accessToken,
    maxResults: options?.maxResults ?? 50,
  }
  if (options?.afterDate) {
    body.afterDate = options.afterDate.toISOString()
  }
  if (options?.mailbox) {
    body.mailbox = options.mailbox
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
  inReplyTo?: string
  references?: string
  threadId?: string | null
} | null> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  const conn = await ensureValidToken(connection)
  const accessToken = decryptConnectionAccessToken(conn)
  const { data } = await axios.post<{ message: InboxMessageDetail | null }>(
    `${url.replace(/\/$/, '')}/inbox/message`,
    { provider: conn.provider, accessToken, messageId },
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
    inReplyTo: msg.inReplyTo,
    references: msg.references,
    threadId: msg.threadId ?? null,
  }
}

export async function listInboxChanges(
  connection: UserInboxConnection,
  options?: ListInboxChangesOptions
): Promise<InboxMessageSummary[]> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  const conn = await ensureValidToken(connection)
  const accessToken = decryptConnectionAccessToken(conn)
  const body: Record<string, unknown> = {
    provider: conn.provider,
    accessToken,
  }
  if (options?.cursor) body.cursor = options.cursor
  if (options?.messageId) body.messageId = options.messageId

  const { data } = await axios.post<{ messages?: InboxMessageSummary[] }>(
    `${url.replace(/\/$/, '')}/inbox/changes`,
    body,
    { headers: { 'Content-Type': 'application/json', ...authHeaders() }, timeout: 30_000 }
  )
  const messages = Array.isArray(data?.messages) ? data.messages : []
  logger.info({ count: messages.length }, 'Email service /inbox/changes returned messages')
  return messages
}

export async function searchVendorMessages(
  connection: UserInboxConnection,
  options: SearchVendorMessagesOptions
): Promise<InboxMessageSummary[]> {
  const url = baseUrl()
  if (!url) throw new Error('EMAIL_SERVICE_URL is not set')

  if (options.vendorEmails.length === 0) {
    return []
  }

  const conn = await ensureValidToken(connection)
  const accessToken = decryptConnectionAccessToken(conn)
  const body: Record<string, unknown> = {
    provider: conn.provider,
    accessToken,
    vendorEmails: options.vendorEmails,
    maxResults: options.maxResults ?? 200,
  }
  if (options.afterDate) {
    body.afterDate = options.afterDate.toISOString()
  }

  const { data } = await axios.post<{ messages?: InboxMessageSummary[] }>(
    `${url.replace(/\/$/, '')}/inbox/search-vendor-messages`,
    body,
    { headers: { 'Content-Type': 'application/json', ...authHeaders() }, timeout: 30_000 }
  )
  const messages = Array.isArray(data?.messages) ? data.messages : []
  logger.info(
    { count: messages.length },
    'Email service /inbox/search-vendor-messages returned messages'
  )
  return messages
}

export async function listGmailMessagesDirect(
  connection: UserInboxConnection,
  options?: { maxResults?: number; query?: string }
): Promise<InboxMessageSummary[]> {
  if (connection.provider !== 'gmail') {
    return []
  }

  const conn = await ensureValidToken(connection)
  const gmail = google.gmail({ version: 'v1', auth: buildGmailAuth(conn) })

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: options?.maxResults ?? 200,
    q: options?.query ?? 'in:anywhere',
    includeSpamTrash: false,
  })

  const ids = (listResponse.data.messages || [])
    .map((message) => message.id)
    .filter((id): id is string => Boolean(id))

  const summaries: InboxMessageSummary[] = []
  for (const id of ids) {
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date'],
    })

    const payload = messageResponse.data.payload
    const headers = payload?.headers || []

    summaries.push({
      id,
      threadId: messageResponse.data.threadId || '',
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      subject: getHeader(headers, 'Subject'),
      date: getHeader(headers, 'Date') || new Date().toISOString(),
      snippet: messageResponse.data.snippet || undefined,
    })
  }

  return summaries
}

export async function getGmailMessageDirect(
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
  inReplyTo?: string
  references?: string
  threadId?: string | null
} | null> {
  if (connection.provider !== 'gmail') {
    return null
  }

  const conn = await ensureValidToken(connection)
  const gmail = google.gmail({ version: 'v1', auth: buildGmailAuth(conn) })
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  const message = response.data
  if (!message) return null
  const headers = message.payload?.headers || []
  const dateHeader = getHeader(headers, 'Date')
  const parsedDate = dateHeader ? new Date(dateHeader) : null
  const internalDate = message.internalDate ? new Date(Number(message.internalDate)) : null

  return {
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc') || undefined,
    subject: getHeader(headers, 'Subject'),
    body: extractPlainTextBody(message.payload) || message.snippet || '',
    date:
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate
        : internalDate && !Number.isNaN(internalDate.getTime())
          ? internalDate
          : new Date(),
    messageId: getHeader(headers, 'Message-ID') || undefined,
    inReplyTo: getHeader(headers, 'In-Reply-To') || undefined,
    references: getHeader(headers, 'References') || undefined,
    threadId: message.threadId ?? null,
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
  const accessToken = decryptConnectionAccessToken(conn)
  const body: Record<string, unknown> = {
    provider: conn.provider,
    accessToken,
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
