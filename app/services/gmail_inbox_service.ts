import { google } from 'googleapis'
import type UserInboxConnection from '#models/user_inbox_connection'
import inboxConfig from '#config/inbox'
import { ensureValidToken } from './inbox_connection_service.js'

const GMAIL_LIST_MAX = 50
const REDIRECT_URI = `${inboxConfig.appUrl.replace(/\/$/, '')}${inboxConfig.redirectPath}`

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
  date: Date
}

function getOAuth2Client(connection: UserInboxConnection) {
  const oauth2 = new google.auth.OAuth2(
    inboxConfig.google.clientId,
    inboxConfig.google.clientSecret,
    REDIRECT_URI
  )
  oauth2.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.accessTokenExpiresAt?.toMillis(),
  })
  return oauth2
}

export async function listMessages(
  connection: UserInboxConnection,
  options?: { maxResults?: number; afterDate?: Date }
): Promise<InboxMessageSummary[]> {
  const conn = await ensureValidToken(connection)
  const auth = getOAuth2Client(conn)
  const gmail = google.gmail({ version: 'v1', auth })

  const maxResults = Math.min(options?.maxResults ?? GMAIL_LIST_MAX, 100)
  const q: string[] = ['in:inbox']
  if (options?.afterDate) {
    q.push(`after:${Math.floor(options.afterDate.getTime() / 1000)}`)
  }

  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: q.join(' '),
  })

  const messages = list.data.messages || []
  const results: InboxMessageSummary[] = []

  for (const m of messages) {
    if (!m.id) continue
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id })
    const headers = full.data.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
    const from = getHeader('From')
    const to = getHeader('To')
    const subject = getHeader('Subject')
    const date = getHeader('Date')
    results.push({
      id: m.id,
      threadId: m.threadId || '',
      from,
      to,
      subject,
      date,
      snippet: full.data.snippet || undefined,
    })
  }

  return results
}

export async function getMessage(
  connection: UserInboxConnection,
  messageId: string
): Promise<InboxMessageDetail | null> {
  const conn = await ensureValidToken(connection)
  const auth = getOAuth2Client(conn)
  const gmail = google.gmail({ version: 'v1', auth })

  const res = await gmail.users.messages.get({ userId: 'me', id: messageId })
  const payload = res.data.payload
  if (!payload) return null

  const headers = payload.headers || []
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

  let body = ''
  if (payload.body?.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf8')
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf8')
        break
      }
      if (part.mimeType === 'text/html' && part.body?.data && !body) {
        body = Buffer.from(part.body.data, 'base64').toString('utf8')
      }
    }
  }

  const dateHeader = getHeader('Date')
  let date = new Date()
  if (dateHeader) {
    const parsed = new Date(dateHeader)
    if (!Number.isNaN(parsed.getTime())) date = parsed
  }

  return {
    id: res.data.id!,
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc') || undefined,
    subject: getHeader('Subject'),
    body,
    date,
  }
}

export async function sendMessage(
  connection: UserInboxConnection,
  params: {
    to: string
    subject: string
    body: string
    inReplyTo?: string
    references?: string
  }
): Promise<string> {
  const conn = await ensureValidToken(connection)
  const auth = getOAuth2Client(conn)
  const gmail = google.gmail({ version: 'v1', auth })

  const lines: string[] = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    params.body,
  ]
  if (params.inReplyTo) lines.splice(2, 0, `In-Reply-To: ${params.inReplyTo}`)
  if (params.references) lines.splice(2, 0, `References: ${params.references}`)

  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })
  return res.data.id!
}
