import 'isomorphic-fetch'
import { Client } from '@microsoft/microsoft-graph-client'
import type UserInboxConnection from '#models/user_inbox_connection'
import { ensureValidToken } from './inbox_connection_service.js'

const LIST_PAGE_SIZE = 50

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

function getGraphClient(connection: UserInboxConnection) {
  return Client.init({
    authProvider: (done) => {
      done(null, connection.accessToken)
    },
  })
}

export async function listMessages(
  connection: UserInboxConnection,
  options?: { maxResults?: number; afterDate?: Date }
): Promise<InboxMessageSummary[]> {
  const conn = await ensureValidToken(connection)
  const client = getGraphClient(conn)

  const top = Math.min(options?.maxResults ?? LIST_PAGE_SIZE, 100)
  const filter = options?.afterDate
    ? `receivedDateTime ge ${options.afterDate.toISOString()}`
    : undefined

  let request = client
    .api('/me/mailFolders/inbox/messages')
    .top(top)
    .orderby('receivedDateTime desc')
    .select('id,from,toRecipients,subject,receivedDateTime,bodyPreview')
  if (filter) request = request.filter(filter)
  const res = await request.get()

  const value = (res.value || []) as Array<{
    id: string
    from?: { emailAddress?: { address?: string; name?: string } }
    toRecipients?: Array<{ emailAddress?: { address?: string } }>
    subject?: string
    receivedDateTime?: string
    bodyPreview?: string
  }>

  return value.map((m) => ({
    id: m.id,
    threadId: m.id,
    from: m.from?.emailAddress?.address || '',
    to: (m.toRecipients || [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(', '),
    subject: m.subject || '',
    date: m.receivedDateTime || '',
    snippet: m.bodyPreview,
  }))
}

export async function getMessage(
  connection: UserInboxConnection,
  messageId: string
): Promise<InboxMessageDetail | null> {
  const conn = await ensureValidToken(connection)
  const client = getGraphClient(conn)

  const m = await client
    .api(`/me/messages/${messageId}`)
    .select('id,from,toRecipients,ccRecipients,subject,body,receivedDateTime')
    .get()
    .catch(() => null)

  if (!m) return null

  const from = (m.from?.emailAddress?.address as string) || ''
  const to = (
    (m.toRecipients || [])
      .map((r: { emailAddress?: { address?: string } }) => r.emailAddress?.address)
      .filter(Boolean) as string[]
  ).join(', ')
  const cc =
    (
      (m.ccRecipients || [])
        .map((r: { emailAddress?: { address?: string } }) => r.emailAddress?.address)
        .filter(Boolean) as string[]
    ).join(', ') || undefined
  const bodyContent = m.body?.content as string | undefined
  const body = bodyContent || ''
  const date = m.receivedDateTime ? new Date(m.receivedDateTime) : new Date()

  return {
    id: m.id,
    from,
    to,
    cc,
    subject: (m.subject as string) || '',
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
  const client = getGraphClient(conn)

  const message = {
    subject: params.subject,
    body: {
      contentType: 'Text',
      content: params.body,
    },
    toRecipients: [
      {
        emailAddress: {
          address: params.to,
        },
      },
    ],
  } as Record<string, unknown>
  if (params.inReplyTo)
    message.internetMessageHeaders = [{ name: 'In-Reply-To', value: params.inReplyTo }]

  await client.api('/me/sendMail').post({ message })
  return ''
}
