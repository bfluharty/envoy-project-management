import axios from 'axios'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import OutreachDraft from '#models/outreach_draft'
import Message from '#models/message'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import VendorConversation from '#models/vendor_conversation'
import ProjectPromptService from '#services/project_prompt_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import { getReasoningChatUrl } from '#utils/reasoning_engine_urls'
import { safeError } from '#utils/safe_error'
import type {
  ReasoningAgentResponse,
  ReasoningRecentTurn,
  ReasoningRequest,
} from '../../types/request.js'
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

const ACTIVE_INBOX_REQUIRED_MESSAGE =
  'An active connected email account is required before sending outreach'
const OUTBOUND_RECONCILIATION_WINDOW_MINUTES = 15
const INITIAL_OUTREACH_CONCURRENCY = 3
const OUTREACH_TRANSCRIPT_MESSAGE_LIMIT = 10

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

function getVendorEmailOrFail(projectVendor: ProjectVendor): string {
  const email = projectVendor.vendor.vendorListing.email?.trim()
  if (!email) {
    throw new Error('Vendor email is required before outreach can be sent')
  }

  return email
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

async function getActivePrimaryConnectionOrFail(userUuid: string) {
  const connection = await UserInboxConnection.query()
    .where('user_uuid', userUuid)
    .where('is_primary', true)
    .where('status', 'active')
    .first()

  if (!connection) {
    throw new Error(ACTIVE_INBOX_REQUIRED_MESSAGE)
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

function normalizeComparableText(value?: string | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function emailHeadersMatch(left?: string | null, right?: string | null) {
  if (!left || !right) {
    return false
  }

  return normalizeEmailForMatching(parseEmailFromHeader(left)) === normalizeEmailForMatching(right)
}

function recipientHeadersOverlap(left?: string | null, right?: string | null) {
  const leftEmails = new Set(parseEmailList(left).map((email) => normalizeEmailForMatching(email)))
  return parseEmailList(right).some((email) => leftEmails.has(normalizeEmailForMatching(email)))
}

function bodiesLikelyMatch(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeComparableText(left)
  const normalizedRight = normalizeComparableText(right)

  if (!normalizedLeft || !normalizedRight) {
    return true
  }

  if (normalizedLeft === normalizedRight) {
    return true
  }

  const leftPrefix = normalizedLeft.slice(0, 160)
  const rightPrefix = normalizedRight.slice(0, 160)
  return normalizedLeft.includes(rightPrefix) || normalizedRight.includes(leftPrefix)
}

async function reconcileProviderOutboundMessage(
  conversation: VendorConversation,
  connection: UserInboxConnection,
  params: {
    providerMessageId: string
    providerThreadId: string | null
    detail: {
      from: string
      to: string
      subject: string
      body: string
      date: Date
      messageId?: string
      references?: string
    }
    snippet?: string
  }
): Promise<Message | null> {
  const sentAt = DateTime.fromJSDate(params.detail.date)
  const candidates = await Message.query()
    .where('vendor_conversation_uuid', conversation.uuid)
    .where('direction', 'outbound')
    .whereNull('provider_message_id')
    .whereBetween('sent_timestamp', [
      sentAt.minus({ minutes: OUTBOUND_RECONCILIATION_WINDOW_MINUTES }).toJSDate(),
      sentAt.plus({ minutes: OUTBOUND_RECONCILIATION_WINDOW_MINUTES }).toJSDate(),
    ])
    .orderBy('sent_timestamp', 'desc')

  const normalizedSubject = normalizeComparableText(params.detail.subject)
  const body = params.detail.body || params.snippet || ''
  const match = candidates.find((candidate) => {
    if (normalizeComparableText(candidate.subject) !== normalizedSubject) {
      return false
    }

    if (!emailHeadersMatch(candidate.from, connection.email)) {
      return false
    }

    if (!recipientHeadersOverlap(candidate.to, params.detail.to)) {
      return false
    }

    return bodiesLikelyMatch(candidate.body, body)
  })

  if (!match) {
    return null
  }

  match.providerMessageId = params.providerMessageId
  match.messageIdHeader = params.detail.messageId ?? match.messageIdHeader
  match.referencesHeader = params.detail.references ?? match.referencesHeader
  match.providerThreadId = params.providerThreadId ?? match.providerThreadId
  match.sentTimestamp = sentAt
  await match.save()
  return match
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
      projectVendor.vendor.vendorListing.email?.toLowerCase() ===
      params.counterpartyEmail.toLowerCase()
  )

  const normalizedCounterparty = normalizeEmailForMatching(params.counterpartyEmail)
  const normalizedMatches = candidateProjectVendors.filter((projectVendor) => {
    const email = projectVendor.vendor.vendorListing.email
    return email ? normalizeEmailForMatching(email) === normalizedCounterparty : false
  })

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

export interface ProviderMessageSyncSummary {
  id: string
  threadId: string | null
  from: string
  to: string
  subject: string
  date: string
  snippet?: string
  source?: 'email_service' | 'gmail_direct'
}

export interface ProviderMessageSyncResult {
  processed: boolean
  created: boolean
  reason?: string
  messageUuid?: string
  conversationUuid?: string
  projectUuid?: string
  direction?: 'inbound' | 'outbound'
}

export async function syncProviderMessageForConnection(
  connection: UserInboxConnection,
  summary: ProviderMessageSyncSummary,
  options: { projectUuid?: string } = {}
): Promise<ProviderMessageSyncResult> {
  const user = await User.findBy('uuid', connection.userUuid)
  if (!user) {
    return { processed: false, created: false, reason: 'user_not_found' }
  }

  const validConnection = await ensureValidToken(connection)
  const providerMessageId = `${validConnection.provider}:${summary.id}`
  const existing = await Message.query().where('provider_message_id', providerMessageId).first()
  if (existing) {
    return {
      processed: true,
      created: false,
      reason: 'duplicate',
      messageUuid: existing.uuid,
      conversationUuid: existing.vendorConversationUuid ?? undefined,
    }
  }

  const detail =
    summary.source === 'gmail_direct'
      ? await getGmailMessageDirect(validConnection, summary.id)
      : await getInboxMessage(validConnection, summary.id)
  if (!detail) {
    return { processed: true, created: false, reason: 'message_not_found' }
  }

  const counterpartyEmail = resolveCounterpartyEmail(detail, validConnection.email)
  if (!counterpartyEmail) {
    return { processed: true, created: false, reason: 'counterparty_not_found' }
  }

  const direction = getMessageDirectionForConnection(detail.from, validConnection.email)
  const providerThreadId = summary.threadId ?? detail.threadId ?? null
  const conversation = await resolveConversationForEmail(user, {
    counterpartyEmail,
    projectUuid: options.projectUuid,
    providerThreadId,
    inReplyTo: detail.inReplyTo ?? null,
    references: detail.references ?? null,
    receivedAt: detail.date,
  })

  if (!conversation?.projectVendorUuid) {
    return { processed: true, created: false, reason: 'vendor_not_matched' }
  }

  const projectVendorQuery = ProjectVendor.query()
    .where('uuid', conversation.projectVendorUuid)
    .where('is_active', true)

  if (options.projectUuid) {
    projectVendorQuery.where('project_uuid', options.projectUuid)
  }

  const projectVendor = await projectVendorQuery.first()
  if (!projectVendor) {
    return { processed: true, created: false, reason: 'project_vendor_not_found' }
  }

  if (direction === 'outbound') {
    const reconciled = await reconcileProviderOutboundMessage(conversation, validConnection, {
      providerMessageId,
      providerThreadId,
      detail,
      snippet: summary.snippet,
    })

    if (reconciled) {
      return {
        processed: true,
        created: false,
        reason: 'reconciled',
        messageUuid: reconciled.uuid,
        conversationUuid: reconciled.vendorConversationUuid ?? undefined,
        projectUuid: projectVendor.projectUuid,
        direction,
      }
    }
  }

  const communication = await getOrCreateEmailCommunicationForProjectVendor(projectVendor.uuid)
  const message = await Message.create({
    communicationUuid: communication.uuid,
    vendorConversationUuid: conversation.uuid,
    direction,
    subject: detail.subject,
    from: detail.from,
    to: detail.to,
    cc: detail.cc ?? undefined,
    body: detail.body || summary.snippet || '',
    createdBy: 'email-sync-worker',
    sentTimestamp: DateTime.fromJSDate(detail.date),
    providerMessageId,
    messageIdHeader: detail.messageId ?? null,
    referencesHeader: detail.references ?? null,
    providerThreadId,
  })

  if (direction === 'inbound') {
    await draftReplyForInboundMessage(projectVendor.projectUuid, conversation, {
      subject: detail.subject,
      body: detail.body || summary.snippet || '',
    }).catch((err) => {
      logger.warn(
        { err, projectUuid: projectVendor.projectUuid, conversationUuid: conversation.uuid },
        'Email sync worker: auto-reply draft failed'
      )
    })
  }

  return {
    processed: true,
    created: true,
    messageUuid: message.uuid,
    conversationUuid: conversation.uuid,
    projectUuid: projectVendor.projectUuid,
    direction,
  }
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
          email: projectVendor.vendor.vendorListing.email ?? '',
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

  const activePrimaryConnection = await UserInboxConnection.query()
    .where('user_uuid', userUuid)
    .where('is_primary', true)
    .where('status', 'active')
    .first()

  return {
    cards,
    hasConnectedInbox: Boolean(activePrimaryConnection),
    senderMode: activePrimaryConnection ? 'connected_inbox' : 'unavailable',
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

export interface InitialOutreachDraftGenerationResult {
  successful: Array<{ projectVendorUuid: string; draftUuid: string }>
  failed: Array<{ projectVendorUuid: string; vendorName: string; error: string }>
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

function buildVendorPromptData(projectVendor: ProjectVendor) {
  const listing = projectVendor.vendor.vendorListing

  return {
    uuid: projectVendor.uuid,
    name: listing.name,
    email: listing.email ?? 'N/A',
    contactName: 'N/A',
    contactRole: 'N/A',
    category: listing.categories?.[0] ?? 'N/A',
    website: listing.website ?? 'N/A',
    notes: 'N/A',
  }
}

function formatThreadMessageForTranscript(message: Message): string {
  const author = message.direction === 'inbound' ? 'Vendor' : 'Envoy'
  const subject = message.subject?.trim() || '(no subject)'
  const body = message.body?.trim() || '(no body)'

  return `${author} - Subject: ${subject}\n${body}`
}

async function buildOutreachTranscript(
  conversationUuid?: string | null
): Promise<ReasoningRecentTurn[]> {
  if (!conversationUuid) {
    return []
  }

  const messages = await Message.query()
    .where('vendor_conversation_uuid', conversationUuid)
    .orderBy('sent_timestamp', 'desc')
    .orderBy('id', 'desc')
    .limit(OUTREACH_TRANSCRIPT_MESSAGE_LIMIT)

  return messages.reverse().map((message) => {
    const transcriptEntry = formatThreadMessageForTranscript(message)

    return {
      agentId: 'OUTREACH',
      userPrompt: message.direction === 'inbound' ? transcriptEntry : '',
      modelResponse: message.direction === 'outbound' ? transcriptEntry : '',
      timestamp: message.sentTimestamp.toISO() ?? new Date().toISOString(),
    }
  })
}

async function getOutreachPromptData(projectUuid: string): Promise<Record<string, unknown>> {
  const outreachPromptData = await ProjectPromptService.getLatestPromptData(projectUuid, 'OUTREACH')
  if (!outreachPromptData) {
    throw new Error('Outreach prompt data is missing')
  }

  return outreachPromptData
}

async function buildOutreachRequestContext(
  user: User,
  project: Project,
  conversationUuid?: string | null
) {
  const [projectContext, projectInsights, recentTurns] = await Promise.all([
    ReasoningRequestContextService.buildProjectContext(project),
    ReasoningRequestContextService.getProjectInsights(project.uuid),
    buildOutreachTranscript(conversationUuid),
  ])

  return {
    stakeholderDetails: ReasoningRequestContextService.getStakeholderDetails(user),
    projectContext,
    projectInsights,
    recentTurns,
  }
}

function parseOutreachDraftResponse(agentResponse: ReasoningAgentResponse): {
  subject: string | null
  body: string
} {
  if (agentResponse.agentId !== 'OUTREACH') {
    throw new Error('Reasoning engine returned the wrong agent response')
  }

  const data = agentResponse.data
  const subject =
    typeof data?.subject === 'string' && data.subject.trim() ? data.subject.trim() : null
  const body = typeof data?.body === 'string' ? data.body.trim() : ''

  if (!body) {
    throw new Error('Reasoning engine did not return an outreach draft body')
  }

  return { subject, body }
}

async function requestOutreachDraft(
  request: ReasoningRequest
): Promise<{ subject: string | null; body: string }> {
  const response = await axios.post(getReasoningChatUrl(), request)

  if (response.status !== 200) {
    throw new Error('Reasoning engine error')
  }

  return parseOutreachDraftResponse(response.data as ReasoningAgentResponse)
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))

  return results
}

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (firstError) {
    logger.warn({ err: safeError(firstError) }, 'Initial outreach draft attempt failed; retrying')
    return operation()
  }
}

async function findEditableInitialDraft(projectVendorUuid: string) {
  return OutreachDraft.query()
    .where('project_vendor_uuid', projectVendorUuid)
    .whereIn('status', ['draft', 'error'])
    .orderBy('modified_timestamp', 'desc')
    .orderBy('id', 'desc')
    .first()
}

async function saveInitialDraft(
  user: User,
  projectVendor: ProjectVendor,
  draft: { subject: string | null; body: string }
) {
  const existing = await findEditableInitialDraft(projectVendor.uuid)
  const subject = draft.subject?.trim() ?? ''
  const body = draft.body.trim()

  if (existing) {
    existing.subject = subject
    existing.body = body
    existing.status = 'draft'
    existing.sentTimestamp = null
    existing.sentMessageUuid = null
    existing.lastError = null
    await existing.save()
    return existing
  }

  const conversation = await createProjectConversation(user, projectVendor)
  return OutreachDraft.create({
    projectVendorUuid: projectVendor.uuid,
    vendorConversationUuid: conversation.uuid,
    subject,
    body,
    status: 'draft',
    sentTimestamp: null,
    sentMessageUuid: null,
    lastError: null,
  })
}

async function saveInitialDraftFailure(user: User, projectVendor: ProjectVendor, error: string) {
  const existing = await findEditableInitialDraft(projectVendor.uuid)

  if (existing) {
    existing.status = 'error'
    existing.lastError = error
    await existing.save()
    return existing
  }

  const conversation = await createProjectConversation(user, projectVendor)
  return OutreachDraft.create({
    projectVendorUuid: projectVendor.uuid,
    vendorConversationUuid: conversation.uuid,
    subject: '',
    body: '',
    status: 'error',
    sentTimestamp: null,
    sentMessageUuid: null,
    lastError: error,
  })
}

export async function generateInitialOutreachDrafts(
  userUuid: string,
  projectUuid: string
): Promise<InitialOutreachDraftGenerationResult> {
  const [user, project] = await Promise.all([
    User.query().where('uuid', userUuid).where('is_active', true).first(),
    getProjectOrFail(userUuid, projectUuid),
  ])

  if (!user) {
    throw new Error('User not found')
  }

  const outreachPromptData = await ProjectPromptService.getLatestPromptData(projectUuid, 'OUTREACH')
  if (!outreachPromptData) {
    throw new Error('Outreach prompt data is missing')
  }

  const projectVendors = await ProjectVendor.query()
    .where('project_uuid', projectUuid)
    .where('is_active', true)
    .preload('vendor', (q) => q.preload('vendorListing'))

  const outreachContext = await buildOutreachRequestContext(user, project)
  const successful: InitialOutreachDraftGenerationResult['successful'] = []
  const failed: InitialOutreachDraftGenerationResult['failed'] = []

  await mapWithConcurrency(projectVendors, INITIAL_OUTREACH_CONCURRENCY, async (projectVendor) => {
    const vendorName = projectVendor.vendor.vendorListing.name?.trim()
    if (!vendorName) {
      return
    }

    const reasoningRequest: ReasoningRequest = {
      agentId: 'OUTREACH',
      promptData: {
        ...outreachPromptData,
        mode: 'initial_outreach',
        vendor: buildVendorPromptData(projectVendor),
        latestVendorReply: null,
        draft: {
          subject: null,
          body: 'N/A',
        },
        revisionInstructions: 'N/A',
      },
      ...outreachContext,
      recentTurns: [],
    }

    try {
      const draft = await retryOnce(() => requestOutreachDraft(reasoningRequest))
      const savedDraft = await saveInitialDraft(user, projectVendor, draft)
      successful.push({ projectVendorUuid: projectVendor.uuid, draftUuid: savedDraft.uuid })
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to generate outreach draft')
      await saveInitialDraftFailure(user, projectVendor, message)
      failed.push({
        projectVendorUuid: projectVendor.uuid,
        vendorName,
        error: message,
      })
    }
  })

  return { successful, failed }
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
      threadId: string | null
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
      const providerThreadId = summary.threadId ?? detail.threadId ?? null

      const conversation = await resolveConversationForEmail(user, {
        counterpartyEmail,
        projectUuid,
        providerThreadId,
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

      if (direction === 'outbound') {
        const reconciled = await reconcileProviderOutboundMessage(conversation, validConnection, {
          providerMessageId,
          providerThreadId,
          detail,
          snippet: summary.snippet,
        })

        if (reconciled) {
          continue
        }
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
        providerThreadId,
      })

      // When a vendor replies, automatically draft a response for the user to review.
      // Fire-and-forget; a drafting failure must never interrupt inbox sync.
      if (direction === 'inbound') {
        draftReplyForInboundMessage(projectUuid, conversation, {
          subject: detail.subject,
          body: detail.body || summary.snippet || '',
        }).catch((err) => {
          logger.warn(
            { err, projectUuid, conversationUuid: conversation.uuid },
            'Inbox sync: auto-reply draft failed'
          )
        })
      }
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
  const subject = overrides?.subject?.trim() || draft.subject
  const body = overrides?.body?.trim() || draft.body

  if (!subject.trim() || !body.trim()) {
    throw new Error('Draft subject and body are required')
  }

  const vendorEmail = getVendorEmailOrFail(projectVendor)

  const threadConversation =
    conversation?.projectVendorUuid === projectVendor.uuid
      ? conversation
      : await createProjectConversation(user, projectVendor)

  if (draft.vendorConversationUuid !== threadConversation.uuid) {
    draft.vendorConversationUuid = threadConversation.uuid
  }

  try {
    const connection = await getActivePrimaryConnectionOrFail(user.uuid)
    const sendResult = await sendOnBehalf(connection, {
      to: vendorEmail,
      subject,
      body,
    })

    const message = await recordOutboundMessage(user, projectVendor, threadConversation, {
      from: connection.email,
      to: vendorEmail,
      subject,
      body,
      providerMessageId: sendResult.messageId
        ? `${connection.provider}:${sendResult.messageId}`
        : null,
      threadId: sendResult.threadId,
    })

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
    logger.error(
      {
        err: safeError(error),
        projectUuid,
        draftUuid,
        projectVendorUuid: projectVendor.uuid,
      },
      'Outreach draft send failed'
    )
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
  const outreachPromptData = await getOutreachPromptData(projectUuid)
  const outreachContext = await buildOutreachRequestContext(
    user,
    project,
    draft.vendorConversationUuid
  )
  const currentSubject = overrides?.subject?.trim() || draft.subject
  const currentBody = overrides?.body?.trim() || draft.body
  const reasoningRequest: ReasoningRequest = {
    agentId: 'OUTREACH',
    promptData: {
      ...outreachPromptData,
      mode: 'revision',
      vendor: buildVendorPromptData(projectVendor),
      latestVendorReply: null,
      draft: {
        subject: currentSubject || null,
        body: currentBody || 'N/A',
      },
      revisionInstructions: instructions,
    },
    ...outreachContext,
  }

  let revisedDraft: { subject: string | null; body: string }
  try {
    revisedDraft = await requestOutreachDraft(reasoningRequest)
  } catch (error) {
    logger.error(
      { err: safeError(error), projectUuid, draftUuid },
      'Failed to revise outreach draft'
    )
    throw new Error(getAxiosErrorMessage(error, 'Failed to revise outreach draft'))
  }

  draft.subject = revisedDraft.subject ?? currentSubject
  draft.body = revisedDraft.body
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
  const connection = await getActivePrimaryConnectionOrFail(user.uuid)
  const vendorEmail = getVendorEmailOrFail(projectVendor)

  let sendResult: Awaited<ReturnType<typeof sendOnBehalf>>
  try {
    sendResult = await sendOnBehalf(connection, {
      to: vendorEmail,
      subject: payload.subject,
      body: payload.body,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
      threadId: payload.threadId,
    })
  } catch (error) {
    logger.error(
      {
        err: safeError(error),
        projectUuid,
        threadUuid,
        projectVendorUuid: projectVendor.uuid,
      },
      'Outreach thread reply send failed'
    )
    throw error
  }

  await recordOutboundMessage(user, projectVendor, conversation, {
    from: connection.email,
    to: vendorEmail,
    subject: payload.subject,
    body: payload.body,
    providerMessageId: sendResult.messageId
      ? `${connection.provider}:${sendResult.messageId}`
      : null,
    threadId: sendResult.threadId ?? payload.threadId ?? null,
  })

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
  const conversation = await getConversationForProjectOrFail(user.uuid, projectUuid, threadUuid)
  const projectVendor = await getProjectVendorOrFail(
    user.uuid,
    projectUuid,
    conversation.projectVendorUuid!
  )
  const outreachPromptData = await getOutreachPromptData(projectUuid)
  const outreachContext = await buildOutreachRequestContext(user, project, conversation.uuid)
  const trimmedCurrentBody = currentBody.trim()
  const latestMessage = await Message.query()
    .where('vendor_conversation_uuid', conversation.uuid)
    .orderBy('sent_timestamp', 'desc')
    .orderBy('id', 'desc')
    .first()
  const reasoningRequest: ReasoningRequest = {
    agentId: 'OUTREACH',
    promptData: {
      ...outreachPromptData,
      mode: 'revision',
      vendor: buildVendorPromptData(projectVendor),
      latestVendorReply: null,
      draft: {
        subject: latestMessage?.subject?.trim() || null,
        body: trimmedCurrentBody || 'N/A',
      },
      revisionInstructions: instructions,
    },
    ...outreachContext,
  }

  let revisedDraft: { subject: string | null; body: string }
  try {
    revisedDraft = await requestOutreachDraft(reasoningRequest)
  } catch (error) {
    logger.error(
      { err: safeError(error), projectUuid, threadUuid },
      'Failed to revise thread reply'
    )
    throw new Error(getAxiosErrorMessage(error, 'Failed to revise reply'))
  }

  const outreach = await getProjectOutreach(user.uuid, projectUuid)
  return {
    ...outreach,
    revisedThreadUuid: threadUuid,
    revisedReplyBody: revisedDraft.body,
  }
}

/**
 * Called after a new inbound message is recorded during inbox sync.
 * Guards against creating duplicate drafts, then asks the reasoning engine
 * to draft a reply and saves it to the existing
 * conversation thread so the user can review and send it from the Outreach tab.
 *
 * This is intentionally fire-and-forget; callers should .catch() errors so
 * a drafting failure never breaks the inbox sync.
 */
export async function draftReplyForInboundMessage(
  projectUuid: string,
  conversation: VendorConversation,
  inboundMessage: { subject: string; body: string }
): Promise<void> {
  // Skip if a draft already exists for this thread to avoid duplicate pending drafts.
  const existingDraft = await OutreachDraft.query()
    .where('vendor_conversation_uuid', conversation.uuid)
    .first()
  if (existingDraft?.status === 'draft') {
    return
  }

  // Only draft if we have previously sent something on this thread.
  // An inbound message with no prior outbound is an unsolicited email, not a reply.
  const priorOutbound = await Message.query()
    .where('vendor_conversation_uuid', conversation.uuid)
    .where('direction', 'outbound')
    .first()
  if (!priorOutbound) {
    return
  }

  const project = await Project.query().where('uuid', projectUuid).where('is_active', true).first()
  if (!project) {
    return
  }

  const user = await User.query().where('uuid', project.userUuid).where('is_active', true).first()
  if (!user || !conversation.projectVendorUuid) {
    return
  }

  const projectVendor = await ProjectVendor.query()
    .where('uuid', conversation.projectVendorUuid)
    .where('project_uuid', projectUuid)
    .where('is_active', true)
    .preload('vendor', (q) => q.preload('vendorListing'))
    .first()

  if (!projectVendor) {
    return
  }

  const latestVendorReply = firstNonEmptyString(inboundMessage.body, inboundMessage.subject)
  if (!latestVendorReply) {
    return
  }

  logger.info(
    { projectUuid, conversationUuid: conversation.uuid },
    'Inbox sync: auto-drafting reply for inbound message'
  )

  const outreachPromptData = await getOutreachPromptData(projectUuid)
  const outreachContext = await buildOutreachRequestContext(user, project, conversation.uuid)
  const draft = await requestOutreachDraft({
    agentId: 'OUTREACH',
    promptData: {
      ...outreachPromptData,
      mode: 'vendor_reply',
      vendor: buildVendorPromptData(projectVendor),
      latestVendorReply,
      draft: {
        subject: null,
        body: 'N/A',
      },
      revisionInstructions: 'N/A',
    },
    ...outreachContext,
  })

  const subject = draft.subject ?? inboundMessage.subject.trim()

  if (existingDraft) {
    existingDraft.merge({
      projectVendorUuid: conversation.projectVendorUuid,
      subject,
      body: draft.body,
      status: 'draft',
      sentTimestamp: null,
      sentMessageUuid: null,
      lastError: null,
    })
    await existingDraft.save()
  } else {
    await OutreachDraft.create({
      projectVendorUuid: conversation.projectVendorUuid,
      vendorConversationUuid: conversation.uuid,
      subject,
      body: draft.body,
      status: 'draft',
      sentTimestamp: null,
      sentMessageUuid: null,
      lastError: null,
    })
  }

  logger.info(
    { projectUuid, conversationUuid: conversation.uuid },
    'Inbox sync: auto-reply draft saved'
  )
}
