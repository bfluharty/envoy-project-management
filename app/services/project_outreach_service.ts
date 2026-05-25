import axios, { type AxiosResponse } from 'axios'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import OutreachMail from '#mails/outreach_mail'
import OutreachDraft from '#models/outreach_draft'
import Message from '#models/message'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import VendorConversation from '#models/vendor_conversation'
import ProjectService from '#services/project_service'
import type { ActionExecution, Turn } from '../../types/turn.js'
import { getOrCreateEmailCommunicationForProjectVendor } from './email_communication_context.js'
import {
  getGmailMessageDirect,
  getInboxMessage,
  listGmailMessagesDirect,
  listInboxMessages,
  sendOnBehalf,
} from './email_communication_service.js'
import { ensureValidToken } from './inbox_connection_service.js'

export interface OutreachMessagePayload {
  uuid: string
  direction: string
  subject: string
  from: string
  to: string
  body: string
  sentAt: string
  messageId?: string
  references?: string
  threadId?: string
}

export interface OutreachCardPayload {
  threadUuid: string
  projectVendorUuid: string
  draftUuid: string | null
  vendor: {
    uuid: string
    name: string
    email: string
  }
  status: string
  subject: string
  body: string
  sentAt: string | null
  lastActivityAt: string | null
  needsAttention: boolean
  lastError: string | null
  replyReceived: boolean
  thread: {
    uuid: string
    messages: OutreachMessagePayload[]
  }
}

type ConversationSelectionMessage = Pick<
  Message,
  'direction' | 'messageIdHeader' | 'providerThreadId' | 'sentTimestamp'
>

export type ConversationSelectionCandidate = Pick<VendorConversation, 'uuid' | 'timestamp'> & {
  messages?: ConversationSelectionMessage[]
}

function firstNonEmptyString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return ''
}

function parseEmailFromHeader(header: string): string {
  const match = header.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return header.trim().toLowerCase()
}

function parseEmailList(header?: string | null): string[] {
  if (!header) return []

  return header
    .split(/[;,]/)
    .map((entry) => parseEmailFromHeader(entry))
    .filter(Boolean)
}

function parseStructuredModelResponse<T extends object>(
  modelResponse: string | null | undefined
): T | null {
  const trimmed = modelResponse?.trim()
  if (!trimmed) {
    return null
  }

  const candidates = [trimmed]
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim())
  }

  const firstBraceIndex = trimmed.indexOf('{')
  const lastBraceIndex = trimmed.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    candidates.push(trimmed.slice(firstBraceIndex, lastBraceIndex + 1).trim())
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      continue
    }
  }

  return null
}

function getAxiosErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data

    if (typeof data === 'string' && data.trim()) {
      return data.trim()
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      if (typeof record.developerText === 'string' && record.developerText.trim()) {
        return record.developerText.trim()
      }
      if (typeof record.error === 'string' && record.error.trim()) {
        return record.error.trim()
      }
      if (typeof record.message === 'string' && record.message.trim()) {
        return record.message.trim()
      }
    }

    if (error.message?.trim()) {
      return error.message.trim()
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

function normalizeEmailForMatching(email: string): string {
  const lower = email.trim().toLowerCase()
  const atIndex = lower.indexOf('@')
  if (atIndex === -1) return lower

  let local = lower.slice(0, atIndex)
  let domain = lower.slice(atIndex + 1)

  if (domain === 'googlemail.com') {
    domain = 'gmail.com'
  }

  if (domain === 'gmail.com') {
    const plusIndex = local.indexOf('+')
    if (plusIndex !== -1) {
      local = local.slice(0, plusIndex)
    }
  }

  return `${local}@${domain}`
}

function getMessageDirectionForConnection(
  from: string,
  connectionEmail: string
): 'inbound' | 'outbound' {
  const sender = parseEmailFromHeader(from)
  const normalizedConnectionEmail = connectionEmail.trim().toLowerCase()
  return sender === normalizedConnectionEmail ? 'outbound' : 'inbound'
}

function resolveCounterpartyEmail(
  message: { from: string; to: string; cc?: string },
  connectionEmail: string
): string | null {
  const normalizedConnectionEmail = connectionEmail.trim().toLowerCase()
  const sender = parseEmailFromHeader(message.from)

  if (sender !== normalizedConnectionEmail) {
    return sender
  }

  const recipients = [...parseEmailList(message.to), ...parseEmailList(message.cc)]
  const counterparty = recipients.find((email) => email !== normalizedConnectionEmail)
  return counterparty ?? null
}

function normalizeReferenceTokens(value?: string | null): string[] {
  if (!value) return []

  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

async function getProjectOrFail(userUuid: string, projectUuid: string) {
  const project = await Project.query()
    .where('uuid', projectUuid)
    .where('user_uuid', userUuid)
    .where('is_active', true)
    .first()

  if (!project) {
    throw new Error('Project not found')
  }

  return project
}

async function getProjectVendorOrFail(
  userUuid: string,
  projectUuid: string,
  projectVendorUuid: string
) {
  const projectVendor = await ProjectVendor.query()
    .where('uuid', projectVendorUuid)
    .where('project_uuid', projectUuid)
    .where('is_active', true)
    .whereHas('project', (query) => {
      query.where('user_uuid', userUuid).where('is_active', true)
    })
    .preload('vendor', (q) => q.preload('vendorListing'))
    .first()

  if (!projectVendor) {
    throw new Error('Project contact not found')
  }

  return projectVendor
}

async function getProjectVendorByVendorUuidOrFail(
  userUuid: string,
  projectUuid: string,
  vendorUuid: string
) {
  const projectVendor = await ProjectVendor.query()
    .where('vendor_uuid', vendorUuid)
    .where('project_uuid', projectUuid)
    .where('is_active', true)
    .whereHas('project', (query) => {
      query.where('user_uuid', userUuid).where('is_active', true)
    })
    .preload('vendor', (q) => q.preload('vendorListing'))
    .first()

  if (!projectVendor) {
    throw new Error('Project contact not found')
  }

  return projectVendor
}

async function getDraftWithProjectVendorOrFail(
  userUuid: string,
  projectUuid: string,
  draftUuid: string
) {
  const draft = await OutreachDraft.query()
    .where('uuid', draftUuid)
    .preload('vendorConversation')
    .first()
  if (!draft) {
    throw new Error('Draft not found')
  }

  const projectVendor = await getProjectVendorOrFail(userUuid, projectUuid, draft.projectVendorUuid)
  return { draft, projectVendor, conversation: draft.vendorConversation }
}

async function createProjectConversation(user: User, projectVendor: ProjectVendor) {
  return VendorConversation.create({
    channel: 'email',
    userId: user.id,
    vendorUuid: projectVendor.vendorUuid,
    projectVendorUuid: projectVendor.uuid,
  })
}

async function getConversationForProjectOrFail(
  userUuid: string,
  projectUuid: string,
  threadUuid: string
) {
  const conversation = await VendorConversation.query()
    .where('uuid', threadUuid)
    .whereHas('projectVendor', (query) => {
      query
        .where('project_uuid', projectUuid)
        .where('is_active', true)
        .whereHas('project', (projectQuery) => {
          projectQuery.where('user_uuid', userUuid).where('is_active', true)
        })
    })
    .preload('projectVendor', (query) => query.preload('vendor', (q) => q.preload('vendorListing')))
    .first()

  if (!conversation?.projectVendorUuid) {
    throw new Error('Thread not found')
  }

  return conversation
}

async function getPreferredConnection(userUuid: string) {
  const connection = await UserInboxConnection.query()
    .where('user_uuid', userUuid)
    .orderBy('provider')
    .orderBy('email')
    .first()

  if (!connection) {
    return null
  }

  return ensureValidToken(connection)
}

async function recordOutboundMessage(
  user: User,
  projectVendor: ProjectVendor,
  conversation: VendorConversation,
  params: {
    from: string
    to: string
    subject: string
    body: string
    providerMessageId?: string | null
    threadId?: string | null
  }
) {
  const communication = await getOrCreateEmailCommunicationForProjectVendor(projectVendor.uuid)

  return Message.create({
    communicationUuid: communication.uuid,
    vendorConversationUuid: conversation.uuid,
    direction: 'outbound',
    subject: params.subject,
    from: params.from,
    to: params.to,
    body: params.body,
    createdBy: user.email,
    sentTimestamp: DateTime.now(),
    providerMessageId: params.providerMessageId ?? null,
    providerThreadId: params.threadId ?? null,
  })
}

async function sendViaEnvoySystemMailbox(
  projectVendor: ProjectVendor,
  subject: string,
  body: string
) {
  await mail.send(new OutreachMail(projectVendor.vendor.vendorListing.email, subject, body))

  return {
    from: env.get('MAIL_FROM_ADDRESS') ?? 'onboarding@resend.dev',
  }
}

function toMillis(value: Date | DateTime | string | null | undefined): number | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  if (typeof value === 'string') {
    const parsed = DateTime.fromISO(value)
    return parsed.isValid ? parsed.toMillis() : null
  }

  return value.isValid ? value.toMillis() : null
}

function orderConversationsByRecency<T extends ConversationSelectionCandidate>(
  candidates: T[]
): T[] {
  return [...candidates].sort(
    (left, right) => right.timestamp.toMillis() - left.timestamp.toMillis()
  )
}

export function selectConversationForInboundEmail<T extends ConversationSelectionCandidate>(
  candidates: T[],
  params: {
    providerThreadId?: string | null
    referenceTokens?: string[]
    receivedAt?: Date | DateTime | string | null
  }
): T | null {
  if (candidates.length === 0) {
    return null
  }

  const orderedCandidates = orderConversationsByRecency(candidates)
  const providerThreadId = params.providerThreadId?.trim()

  if (providerThreadId) {
    const byThreadId = orderedCandidates.find((candidate) =>
      (candidate.messages ?? []).some((message) => message.providerThreadId === providerThreadId)
    )
    if (byThreadId) {
      return byThreadId
    }
  }

  const referenceTokens = (params.referenceTokens ?? []).filter(Boolean)
  if (referenceTokens.length > 0) {
    const referenceSet = new Set(referenceTokens)
    const byReferences = orderedCandidates.find((candidate) =>
      (candidate.messages ?? []).some(
        (message) => !!message.messageIdHeader && referenceSet.has(message.messageIdHeader)
      )
    )
    if (byReferences) {
      return byReferences
    }
  }

  const receivedAtMillis = toMillis(params.receivedAt)
  if (receivedAtMillis !== null) {
    let bestCandidate: T | null = null
    let bestOutboundMillis = Number.NEGATIVE_INFINITY

    for (const candidate of orderedCandidates) {
      const latestQualifiedOutbound = (candidate.messages ?? [])
        .filter((message) => message.direction === 'outbound')
        .map((message) => toMillis(message.sentTimestamp))
        .filter(
          (sentAtMillis): sentAtMillis is number =>
            sentAtMillis !== null && sentAtMillis <= receivedAtMillis
        )
        .sort((left, right) => right - left)[0]

      if (latestQualifiedOutbound === undefined) {
        continue
      }

      if (latestQualifiedOutbound > bestOutboundMillis) {
        bestOutboundMillis = latestQualifiedOutbound
        bestCandidate = candidate
      }
    }

    if (bestCandidate) {
      return bestCandidate
    }
  }

  return orderedCandidates[0] ?? null
}

async function resolveConversationForEmail(
  user: User,
  params: {
    counterpartyEmail: string
    projectUuid?: string
    providerThreadId?: string | null
    inReplyTo?: string | null
    references?: string | null
    receivedAt?: Date | DateTime | string | null
  }
) {
  const referenceTokens = [
    ...(params.inReplyTo ? [params.inReplyTo] : []),
    ...normalizeReferenceTokens(params.references),
  ]

  if (params.providerThreadId) {
    const providerThreadId = params.providerThreadId
    const byThreadId = await VendorConversation.query()
      .whereHas('projectVendor', (query) => {
        query.where('is_active', true)
        if (params.projectUuid) {
          query.where('project_uuid', params.projectUuid)
        }
        query.whereHas('project', (projectQuery) => {
          projectQuery.where('user_uuid', user.uuid).where('is_active', true)
        })
      })
      .whereHas('messages', (query) => {
        query.where('provider_thread_id', providerThreadId)
      })
      .preload('projectVendor', (query) =>
        query.preload('vendor', (q) => q.preload('vendorListing'))
      )
      .first()

    if (byThreadId) {
      return byThreadId
    }
  }

  if (referenceTokens.length > 0) {
    const byReferences = await VendorConversation.query()
      .whereHas('projectVendor', (query) => {
        query.where('is_active', true)
        if (params.projectUuid) {
          query.where('project_uuid', params.projectUuid)
        }
        query.whereHas('project', (projectQuery) => {
          projectQuery.where('user_uuid', user.uuid).where('is_active', true)
        })
      })
      .whereHas('messages', (query) => {
        query.where((messageQuery) => {
          for (const token of referenceTokens) {
            messageQuery.orWhere('message_id_header', token)
          }
        })
      })
      .preload('projectVendor', (query) =>
        query.preload('vendor', (q) => q.preload('vendorListing'))
      )
      .first()

    if (byReferences) {
      return byReferences
    }
  }

  const candidateProjectVendors = await ProjectVendor.query()
    .where('is_active', true)
    .if(params.projectUuid, (query) => {
      query.where('project_uuid', params.projectUuid!)
    })
    .whereHas('project', (query) => {
      query.where('user_uuid', user.uuid).where('is_active', true)
    })
    .preload('vendor', (q) => q.preload('vendorListing'))

  const exactMatches = candidateProjectVendors.filter(
    (projectVendor) =>
      projectVendor.vendor.vendorListing.email.toLowerCase() ===
      params.counterpartyEmail.toLowerCase()
  )

  const normalizedCounterparty = normalizeEmailForMatching(params.counterpartyEmail)
  const normalizedMatches = candidateProjectVendors.filter(
    (projectVendor) =>
      normalizeEmailForMatching(projectVendor.vendor.vendorListing.email) === normalizedCounterparty
  )

  const selectedCandidates = exactMatches.length > 0 ? exactMatches : normalizedMatches

  if (selectedCandidates.length === 0) {
    return null
  }

  const selectedProjectVendor = selectedCandidates[0]
  const candidateConversations = await VendorConversation.query()
    .whereIn(
      'project_vendor_uuid',
      selectedCandidates.map((projectVendor) => projectVendor.uuid)
    )
    .where('channel', 'email')
    .preload('messages')
    .preload('projectVendor', (query) => query.preload('vendor', (q) => q.preload('vendorListing')))
    .orderBy('created_timestamp', 'desc')
    .orderBy('id', 'desc')

  const selectedConversation = selectConversationForInboundEmail(candidateConversations, {
    providerThreadId: params.providerThreadId,
    referenceTokens,
    receivedAt: params.receivedAt ?? null,
  })

  if (selectedConversation) {
    return selectedConversation
  }

  return createProjectConversation(user, selectedProjectVendor)
}

function serializeMessages(messages: Message[]): OutreachMessagePayload[] {
  return [...messages]
    .sort((left, right) => left.sentTimestamp.toMillis() - right.sentTimestamp.toMillis())
    .map((message) => ({
      uuid: message.uuid,
      direction: message.direction,
      subject: message.subject,
      from: message.from,
      to: message.to,
      body: message.body,
      sentAt: message.sentTimestamp.toISO() ?? '',
      messageId: message.messageIdHeader ?? undefined,
      references: message.referencesHeader ?? undefined,
      threadId: message.providerThreadId ?? undefined,
    }))
}

function getLatestOutbound(messages: Message[]) {
  return [...messages]
    .filter((message) => message.direction === 'outbound')
    .sort((left, right) => right.sentTimestamp.toMillis() - left.sentTimestamp.toMillis())[0]
}

function getLatestMessage(messages: Message[]) {
  return [...messages].sort(
    (left, right) => right.sentTimestamp.toMillis() - left.sentTimestamp.toMillis()
  )[0]
}

function computeReplyReceived(messages: Message[], draft: OutreachDraft | null) {
  const latestOutbound = getLatestOutbound(messages)

  const baseline = latestOutbound?.sentTimestamp ?? draft?.sentTimestamp ?? null
  if (!baseline) {
    return false
  }

  return messages.some(
    (message) =>
      message.direction === 'inbound' && message.sentTimestamp.toMillis() > baseline.toMillis()
  )
}

export async function getProjectOutreach(userUuid: string, projectUuid: string) {
  await getProjectOrFail(userUuid, projectUuid)

  const projectVendors = await ProjectVendor.query()
    .where('project_uuid', projectUuid)
    .where('is_active', true)
    .preload('vendor', (q) => q.preload('vendorListing'))
    .orderBy('id')

  const projectVendorUuids = projectVendors.map((projectVendor) => projectVendor.uuid)
  const projectVendorByUuid = new Map(
    projectVendors.map((projectVendor) => [projectVendor.uuid, projectVendor])
  )

  const [drafts, conversations] = await Promise.all([
    projectVendorUuids.length
      ? OutreachDraft.query().whereIn('project_vendor_uuid', projectVendorUuids)
      : Promise.resolve([]),
    projectVendorUuids.length
      ? VendorConversation.query()
          .whereIn('project_vendor_uuid', projectVendorUuids)
          .preload('messages')
      : Promise.resolve([]),
  ])

  const draftByConversationUuid = new Map(
    drafts.map((draft) => [draft.vendorConversationUuid, draft])
  )

  const cards: OutreachCardPayload[] = conversations
    .map((conversation) => {
      if (!conversation.projectVendorUuid) return null

      const projectVendor = projectVendorByUuid.get(conversation.projectVendorUuid)
      if (!projectVendor) return null

      const draft = draftByConversationUuid.get(conversation.uuid) ?? null
      const messages = conversation.messages ?? []
      const latestMessage = getLatestMessage(messages)
      const latestOutbound = getLatestOutbound(messages)
      const status =
        draft?.status ??
        (latestMessage ? (latestMessage.direction === 'inbound' ? 'received' : 'sent') : 'empty')
      const isEditableDraft = status === 'draft' || status === 'error'
      const lastActivity =
        latestMessage?.sentTimestamp ??
        draft?.modifiedTimestamp ??
        draft?.createdTimestamp ??
        draft?.sentTimestamp ??
        null
      const needsAttention = Boolean(
        latestMessage &&
        latestMessage.direction === 'inbound' &&
        (!latestOutbound ||
          latestMessage.sentTimestamp.toMillis() > latestOutbound.sentTimestamp.toMillis())
      )

      return {
        threadUuid: conversation.uuid,
        projectVendorUuid: projectVendor.uuid,
        draftUuid: draft?.uuid ?? null,
        vendor: {
          uuid: projectVendor.vendor.uuid,
          name: projectVendor.vendor.vendorListing.name,
          email: projectVendor.vendor.vendorListing.email,
        },
        status,
        subject: isEditableDraft
          ? (draft?.subject ?? '')
          : firstNonEmptyString(draft?.subject, latestOutbound?.subject, latestMessage?.subject),
        body: isEditableDraft
          ? (draft?.body ?? '')
          : firstNonEmptyString(draft?.body, latestOutbound?.body, latestMessage?.body),
        sentAt:
          latestOutbound?.sentTimestamp.toISO() ??
          draft?.sentTimestamp?.toISO() ??
          latestMessage?.sentTimestamp.toISO() ??
          null,
        lastActivityAt: lastActivity?.toISO() ?? null,
        needsAttention,
        lastError: draft?.lastError ?? null,
        replyReceived: computeReplyReceived(messages, draft),
        thread: {
          uuid: conversation.uuid,
          messages: serializeMessages(messages),
        },
      }
    })
    .filter((card): card is OutreachCardPayload => Boolean(card))
    .sort((left, right) => {
      const leftTime = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0
      const rightTime = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0
      if (leftTime !== rightTime) {
        return rightTime - leftTime
      }

      const statusRank = {
        draft: 0,
        error: 1,
        received: 2,
        sent: 3,
        empty: 4,
      } as const

      const leftRank = statusRank[left.status as keyof typeof statusRank] ?? 99
      const rightRank = statusRank[right.status as keyof typeof statusRank] ?? 99
      return leftRank - rightRank
    })

  const connections = await UserInboxConnection.query().where('user_uuid', userUuid)

  return {
    cards,
    hasConnectedInbox: connections.length > 0,
    senderMode: connections.length > 0 ? 'connected_inbox' : 'envoy_system',
  }
}

export async function createOutreachDraft(
  userUuid: string,
  projectUuid: string,
  identifiers: { projectVendorUuid?: string; vendorUuid?: string }
) {
  const user = await User.query().where('uuid', userUuid).firstOrFail()
  await getProjectOrFail(userUuid, projectUuid)
  const projectVendor = identifiers.projectVendorUuid
    ? await getProjectVendorOrFail(userUuid, projectUuid, identifiers.projectVendorUuid)
    : identifiers.vendorUuid
      ? await getProjectVendorByVendorUuidOrFail(userUuid, projectUuid, identifiers.vendorUuid)
      : (() => {
          throw new Error('Project contact not found')
        })()

  const conversation = await createProjectConversation(user, projectVendor)
  await OutreachDraft.create({
    projectVendorUuid: projectVendor.uuid,
    vendorConversationUuid: conversation.uuid,
    subject: '',
    body: '',
    status: 'draft',
    sentTimestamp: null,
    sentMessageUuid: null,
    lastError: null,
  })

  const outreach = await getProjectOutreach(userUuid, projectUuid)
  return {
    ...outreach,
    createdThreadUuid: conversation.uuid,
  }
}

export async function cancelOutreachDraft(
  userUuid: string,
  projectUuid: string,
  draftUuid: string
) {
  await getProjectOrFail(userUuid, projectUuid)

  const { draft, conversation } = await getDraftWithProjectVendorOrFail(
    userUuid,
    projectUuid,
    draftUuid
  )
  const messageCount = conversation
    ? await Message.query().where('vendor_conversation_uuid', conversation.uuid).count('* as total')
    : []

  await draft.delete()

  const totalMessages = Number(messageCount[0]?.$extras.total ?? 0)
  if (conversation && totalMessages === 0) {
    await conversation.delete()
  }

  return getProjectOutreach(userUuid, projectUuid)
}

export async function syncProjectOutreach(user: User, projectUuid: string) {
  await getProjectOrFail(user.uuid, projectUuid)

  const connections = await UserInboxConnection.query().where('user_uuid', user.uuid)

  for (const connection of connections) {
    type SyncSummary = {
      id: string
      threadId: string
      from: string
      to: string
      subject: string
      date: string
      snippet?: string
      source: 'email_service' | 'gmail_direct'
    }

    const validConnection = await ensureValidToken(connection)
    const inboxList = await listInboxMessages(validConnection, { maxResults: 200 })
    const inboxSummaries = inboxList.map((summary) => ({
      ...summary,
      source: 'email_service' as const,
    }))
    let sentSummaries: SyncSummary[] = []
    const sentMailboxCandidates =
      validConnection.provider === 'microsoft'
        ? ['sent', 'sentitems', 'SentItems']
        : ['sent', 'SENT']
    let sentMailboxFetched = false

    for (const mailbox of sentMailboxCandidates) {
      try {
        const sentList = await listInboxMessages(validConnection, { maxResults: 200, mailbox })
        sentSummaries = sentList.map((summary) => ({
          ...summary,
          source: 'email_service' as const,
        }))
        sentMailboxFetched = true
        break
      } catch {
        continue
      }
    }

    if (!sentMailboxFetched) {
      // Not all email-service deployments expose mailbox filtering.
      sentSummaries = []
      logger.debug(
        { provider: validConnection.provider, email: validConnection.email },
        'Outreach sync: sent mailbox listing not supported by email-service; using inbox-only list'
      )
    }

    let gmailDirectSummaries: SyncSummary[] = []
    if (validConnection.provider === 'gmail') {
      try {
        const gmailDirectList = await listGmailMessagesDirect(validConnection, {
          maxResults: 200,
          query: 'in:anywhere',
        })
        gmailDirectSummaries = gmailDirectList.map((summary) => ({
          ...summary,
          source: 'gmail_direct' as const,
        }))
      } catch (error) {
        logger.debug(
          { provider: validConnection.provider, email: validConnection.email, error },
          'Outreach sync: gmail direct listing failed; proceeding without direct fallback'
        )
      }
    }

    const mergedSummaries = [...inboxSummaries, ...sentSummaries, ...gmailDirectSummaries]
    const seenProviderMessageIds = new Set<string>()
    const summaries = mergedSummaries.filter((summary) => {
      const key = `${validConnection.provider}:${summary.id}`
      if (seenProviderMessageIds.has(key)) {
        return false
      }
      seenProviderMessageIds.add(key)
      return true
    })

    logger.debug(
      {
        provider: validConnection.provider,
        email: validConnection.email,
        inboxCount: inboxSummaries.length,
        sentCount: sentSummaries.length,
        gmailDirectCount: gmailDirectSummaries.length,
        mergedCount: summaries.length,
      },
      'Outreach sync fetched message summaries'
    )

    for (const summary of summaries) {
      const providerMessageId = `${validConnection.provider}:${summary.id}`
      const existing = await Message.query().where('provider_message_id', providerMessageId).first()
      if (existing) {
        continue
      }

      const detail =
        summary.source === 'gmail_direct'
          ? await getGmailMessageDirect(validConnection, summary.id)
          : await getInboxMessage(validConnection, summary.id)
      if (!detail) {
        continue
      }

      const counterpartyEmail = resolveCounterpartyEmail(detail, validConnection.email)
      if (!counterpartyEmail) {
        continue
      }

      const direction = getMessageDirectionForConnection(detail.from, validConnection.email)

      const conversation = await resolveConversationForEmail(user, {
        counterpartyEmail,
        projectUuid,
        providerThreadId: summary.threadId,
        inReplyTo: detail.inReplyTo ?? null,
        references: detail.references ?? null,
        receivedAt: detail.date,
      })

      if (!conversation?.projectVendorUuid) {
        continue
      }

      const projectVendor = await ProjectVendor.query()
        .where('uuid', conversation.projectVendorUuid)
        .where('project_uuid', projectUuid)
        .where('is_active', true)
        .first()

      if (!projectVendor) {
        continue
      }

      const communication = await getOrCreateEmailCommunicationForProjectVendor(projectVendor.uuid)

      await Message.create({
        communicationUuid: communication.uuid,
        vendorConversationUuid: conversation.uuid,
        direction,
        subject: detail.subject,
        from: detail.from,
        to: detail.to,
        cc: detail.cc ?? undefined,
        body: detail.body || summary.snippet || '',
        createdBy: 'inbox-sync',
        sentTimestamp: DateTime.fromJSDate(detail.date),
        providerMessageId,
        messageIdHeader: detail.messageId ?? null,
        referencesHeader: detail.references ?? null,
        providerThreadId: summary.threadId ?? null,
      })
    }
  }

  return getProjectOutreach(user.uuid, projectUuid)
}

export async function sendOutreachDraft(
  user: User,
  projectUuid: string,
  draftUuid: string,
  overrides?: { subject?: string; body?: string }
) {
  const { draft, projectVendor, conversation } = await getDraftWithProjectVendorOrFail(
    user.uuid,
    projectUuid,
    draftUuid
  )
  const connection = await getPreferredConnection(user.uuid)
  const subject = overrides?.subject?.trim() || draft.subject
  const body = overrides?.body?.trim() || draft.body

  if (!subject.trim() || !body.trim()) {
    throw new Error('Draft subject and body are required')
  }

  const threadConversation =
    conversation?.projectVendorUuid === projectVendor.uuid
      ? conversation
      : await createProjectConversation(user, projectVendor)

  if (draft.vendorConversationUuid !== threadConversation.uuid) {
    draft.vendorConversationUuid = threadConversation.uuid
  }

  try {
    let message: Message
    if (connection) {
      const providerMessageId = await sendOnBehalf(connection, {
        to: projectVendor.vendor.vendorListing.email,
        subject,
        body,
      })

      message = await recordOutboundMessage(user, projectVendor, threadConversation, {
        from: connection.email,
        to: projectVendor.vendor.vendorListing.email,
        subject,
        body,
        providerMessageId: providerMessageId ? `${connection.provider}:${providerMessageId}` : null,
      })
    } else {
      const fallback = await sendViaEnvoySystemMailbox(projectVendor, subject, body)
      message = await recordOutboundMessage(user, projectVendor, threadConversation, {
        from: fallback.from,
        to: projectVendor.vendor.vendorListing.email,
        subject,
        body,
      })
    }

    draft.subject = subject
    draft.body = body
    draft.status = 'sent'
    draft.sentTimestamp = message.sentTimestamp
    draft.sentMessageUuid = message.uuid
    draft.lastError = null
    await draft.save()

    return getProjectOutreach(user.uuid, projectUuid)
  } catch (error) {
    draft.status = 'error'
    draft.lastError = error instanceof Error ? error.message : 'Failed to send outreach email'
    await draft.save()
    throw error
  }
}

export async function reviseOutreachDraft(
  user: User,
  projectUuid: string,
  draftUuid: string,
  instructions: string,
  overrides?: { subject?: string; body?: string }
) {
  const { draft, projectVendor } = await getDraftWithProjectVendorOrFail(
    user.uuid,
    projectUuid,
    draftUuid
  )
  const project = await getProjectOrFail(user.uuid, projectUuid)
  const projectWithConversations = await ProjectService.getProjectWithConversations(
    user.uuid,
    projectUuid
  )
  const pastConversationTurns =
    projectWithConversations.conversations
      .flatMap((conv) => conv.conversationTurns)
      ?.map((turn) => turn?.contents) || []
  const currentSubject = overrides?.subject?.trim() || draft.subject
  const currentBody = overrides?.body?.trim() || draft.body

  let response: AxiosResponse
  try {
    response = await axios.post(env.get('REASONING_ENGINE_URL', ''), {
      agentId: 'envoy-reasoning-agent-001',
      prompt: [
        'Return only valid JSON with keys "subject" and "body".',
        'Revise the outreach email draft using the user instructions.',
        `Project title: ${project.title}`,
        `Vendor: ${projectVendor.vendor.vendorListing.name} <${projectVendor.vendor.vendorListing.email}>`,
        `Current subject: ${currentSubject}`,
        `Current body:\n${currentBody}`,
        `Revision instructions:\n${instructions}`,
      ].join('\n\n'),
      variables: { context: 'INITIAL_OUTREACH' },
      projectUuid,
      pastConversationTurns,
    })
  } catch (error) {
    logger.error({ err: error, projectUuid, draftUuid }, 'Failed to revise outreach draft')
    throw new Error(getAxiosErrorMessage(error, 'Failed to revise outreach draft'))
  }

  const turn = response.data as Turn
  let subject = currentSubject
  let body = currentBody

  const parsed = parseStructuredModelResponse<{ subject?: string; body?: string }>(
    turn.modelResponse
  )
  if (!parsed) {
    throw new Error('AI revision did not return a valid draft payload')
  }

  if (parsed.subject?.trim()) subject = parsed.subject.trim()
  if (parsed.body?.trim()) body = parsed.body.trim()

  draft.subject = subject
  draft.body = body
  draft.status = 'draft'
  draft.lastError = null
  await draft.save()

  return getProjectOutreach(user.uuid, projectUuid)
}

export async function sendThreadReply(
  user: User,
  projectUuid: string,
  threadUuid: string,
  payload: {
    subject: string
    body: string
    inReplyTo?: string
    references?: string
    threadId?: string
  }
) {
  await getProjectOrFail(user.uuid, projectUuid)

  const conversation = await getConversationForProjectOrFail(user.uuid, projectUuid, threadUuid)
  const projectVendor = await getProjectVendorOrFail(
    user.uuid,
    projectUuid,
    conversation.projectVendorUuid!
  )
  const connection = await getPreferredConnection(user.uuid)

  if (connection) {
    const providerMessageId = await sendOnBehalf(connection, {
      to: projectVendor.vendor.vendorListing.email,
      subject: payload.subject,
      body: payload.body,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
      threadId: payload.threadId,
    })

    await recordOutboundMessage(user, projectVendor, conversation, {
      from: connection.email,
      to: projectVendor.vendor.vendorListing.email,
      subject: payload.subject,
      body: payload.body,
      providerMessageId: providerMessageId ? `${connection.provider}:${providerMessageId}` : null,
      threadId: payload.threadId ?? null,
    })
  } else {
    const fallback = await sendViaEnvoySystemMailbox(projectVendor, payload.subject, payload.body)
    await recordOutboundMessage(user, projectVendor, conversation, {
      from: fallback.from,
      to: projectVendor.vendor.vendorListing.email,
      subject: payload.subject,
      body: payload.body,
    })
  }

  return getProjectOutreach(user.uuid, projectUuid)
}

export async function reviseThreadReply(
  user: User,
  projectUuid: string,
  threadUuid: string,
  instructions: string,
  currentBody: string
) {
  const project = await getProjectOrFail(user.uuid, projectUuid)
  const projectWithConversations = await ProjectService.getProjectWithConversations(
    user.uuid,
    projectUuid
  )
  const pastConversationTurns =
    projectWithConversations.conversations
      .flatMap((conv) => conv.conversationTurns)
      ?.map((turn) => turn?.contents) || []
  const conversation = await getConversationForProjectOrFail(user.uuid, projectUuid, threadUuid)
  const projectVendor = await getProjectVendorOrFail(
    user.uuid,
    projectUuid,
    conversation.projectVendorUuid!
  )
  const trimmedCurrentBody = currentBody.trim()
  const recentMessages = await Message.query()
    .where('vendor_conversation_uuid', conversation.uuid)
    .orderBy('sent_timestamp', 'desc')
    .orderBy('id', 'desc')
    .limit(6)
  const threadContext = recentMessages
    .reverse()
    .map((message) => {
      const direction = message.direction === 'inbound' ? 'Vendor' : 'You'
      const subject = message.subject?.trim() || '(no subject)'
      const body = message.body?.trim() || '(no body)'

      return `${direction} - Subject: ${subject}\n${body}`
    })
    .join('\n\n---\n\n')

  let response: AxiosResponse
  try {
    response = await axios.post(env.get('REASONING_ENGINE_URL', ''), {
      agentId: 'envoy-reasoning-agent-001',
      prompt: [
        'Return only valid JSON with key "body".',
        trimmedCurrentBody
          ? 'Revise the email reply body using the user instructions.'
          : 'Write a new email reply body using the user instructions and the thread context.',
        trimmedCurrentBody
          ? 'Treat the revision instructions as natural-language feedback and produce only the revised reply body, not an explanation of changes.'
          : 'Produce only the reply body, not an explanation of changes.',
        `Project title: ${project.title}`,
        `Vendor: ${projectVendor.vendor.vendorListing.name} <${projectVendor.vendor.vendorListing.email}>`,
        threadContext
          ? `Recent thread messages:\n${threadContext}`
          : 'Recent thread messages:\n[none available]',
        trimmedCurrentBody
          ? `Current reply body:\n${trimmedCurrentBody}`
          : 'Current reply body:\n[none provided]',
        `Revision instructions:\n${instructions}`,
      ].join('\n\n'),
      variables: { context: 'HANDLE_VENDOR_RESPONSE' },
      projectUuid,
      pastConversationTurns,
    })
  } catch (error) {
    logger.error({ err: error, projectUuid, threadUuid }, 'Failed to revise thread reply')
    throw new Error(getAxiosErrorMessage(error, 'Failed to revise reply'))
  }

  const turn = response.data as Turn
  let revisedBody = currentBody.trim()

  const parsed = parseStructuredModelResponse<{ body?: string }>(turn.modelResponse)
  if (parsed?.body?.trim()) {
    revisedBody = parsed.body.trim()
  } else if (turn.modelResponse?.trim()) {
    revisedBody = turn.modelResponse
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim()
  }

  if (!revisedBody) {
    logger.warn(
      {
        projectUuid,
        threadUuid,
        modelResponse: turn.modelResponse,
      },
      'Reply revision returned no usable body'
    )
    throw new Error('AI revision did not return a usable reply body')
  }

  const outreach = await getProjectOutreach(user.uuid, projectUuid)
  return {
    ...outreach,
    revisedThreadUuid: threadUuid,
    revisedReplyBody: revisedBody,
  }
}

export async function applyOutreachActions(
  projectUuid: string,
  actions: ActionExecution[] | undefined
) {
  if (!actions?.length) {
    return
  }

  const project = await Project.query().where('uuid', projectUuid).where('is_active', true).first()
  if (!project) {
    return
  }

  const user = await User.query().where('uuid', project.userUuid).first()
  if (!user) {
    return
  }

  const projectVendors = await ProjectVendor.query()
    .where('project_uuid', projectUuid)
    .where('is_active', true)
    .preload('vendor', (q) => q.preload('vendorListing'))

  const byProjectVendorUuid = new Map(
    projectVendors.map((projectVendor) => [projectVendor.uuid, projectVendor])
  )
  const byVendorUuid = new Map(
    projectVendors.map((projectVendor) => [projectVendor.vendorUuid, projectVendor])
  )
  const byVendorEmail = new Map(
    projectVendors.map((projectVendor) => [
      projectVendor.vendor.vendorListing.email.toLowerCase(),
      projectVendor,
    ])
  )

  for (const action of actions) {
    if (!action.success) {
      continue
    }

    const normalizedAction = action.action?.toLowerCase()
    if (
      normalizedAction !== 'draft_outreach_emails' &&
      normalizedAction !== 'revise_outreach_draft'
    ) {
      continue
    }

    const actionData = action.data as
      | {
          projectVendorUuid?: string
          vendorUuid?: string
          vendorEmail?: string
          subject?: string
          body?: string
          draftUuid?: string
          drafts?: Array<{
            projectVendorUuid?: string
            vendorUuid?: string
            vendorEmail?: string
            subject?: string
            body?: string
            draftUuid?: string
          }>
        }
      | undefined

    const candidates = actionData?.drafts?.length
      ? actionData.drafts
      : actionData
        ? [actionData]
        : []

    for (const candidate of candidates) {
      const projectVendor =
        (candidate.projectVendorUuid
          ? byProjectVendorUuid.get(candidate.projectVendorUuid)
          : null) ??
        (candidate.vendorUuid ? byVendorUuid.get(candidate.vendorUuid) : null) ??
        (candidate.vendorEmail ? byVendorEmail.get(candidate.vendorEmail.toLowerCase()) : null)

      if (!projectVendor || !candidate.subject?.trim() || !candidate.body?.trim()) {
        continue
      }

      const existing = candidate.draftUuid
        ? await OutreachDraft.query()
            .where('uuid', candidate.draftUuid)
            .where('project_vendor_uuid', projectVendor.uuid)
            .where('status', 'draft')
            .first()
        : null

      if (existing) {
        existing.subject = candidate.subject.trim()
        existing.body = candidate.body.trim()
        await existing.save()
        continue
      }

      const conversation = await createProjectConversation(user, projectVendor)

      await OutreachDraft.create({
        projectVendorUuid: projectVendor.uuid,
        vendorConversationUuid: conversation.uuid,
        subject: candidate.subject.trim(),
        body: candidate.body.trim(),
        status: 'draft',
        sentTimestamp: null,
        sentMessageUuid: null,
        lastError: null,
      })
    }
  }
}
