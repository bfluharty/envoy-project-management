import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  type Message as SqsMessage,
  type SendMessageCommandInput,
} from '@aws-sdk/client-sqs'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import ProjectVendor from '#models/project_vendor'
import UserInboxConnection from '#models/user_inbox_connection'
import {
  listInboxChanges,
  searchVendorMessages,
  type InboxMessageSummary,
} from '#services/email_communication_service'
import {
  syncProviderMessageForConnection,
  type ProviderMessageSyncResult,
} from '#services/project_outreach_service'
import { safeError } from '#utils/safe_error'

export type EmailSyncEventType =
  | 'gmail_history'
  | 'microsoft_message_created'
  | 'microsoft_message_updated'
  | 'microsoft_subscription_lifecycle'
  | 'manual_backfill'

export interface EmailSyncEventMessage {
  eventId: string
  provider: 'gmail' | 'microsoft'
  eventType: EmailSyncEventType
  occurredAt: string
  email?: string
  connectionUuid?: string
  providerCursor?: string
  providerMessageId?: string
  providerThreadId?: string | null
  providerSubscriptionId?: string
  rawProviderEvent?: unknown
}

export interface EmailSyncEventProcessResult {
  eventId: string
  connections: number
  processed: number
  created: number
  skipped: number
}

export interface EmailSyncQueueProcessResult {
  received: number
  deleted: number
  failed: number
  invalid: number
  processed: number
  created: number
}

export interface EmailSyncQueueAttributes {
  label: 'main' | 'dlq'
  configured: boolean
  queueUrl?: string
  approximateVisible: number | null
  approximateNotVisible: number | null
  approximateDelayed: number | null
  createdTimestamp: string | null
  lastModifiedTimestamp: string | null
}

export interface EmailSyncQueueDiagnostics {
  main: EmailSyncQueueAttributes
  dlq: EmailSyncQueueAttributes
}

class EmailSyncEventValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailSyncEventValidationError'
  }
}

const sqs = new SQSClient({})

type MessageAttributes = NonNullable<SendMessageCommandInput['MessageAttributes']>

function getQueueUrl(required = true): string | null {
  const queueUrl = env.get('EMAIL_SYNC_QUEUE_URL')?.trim()
  if (!queueUrl && required) {
    throw new Error('EMAIL_SYNC_QUEUE_URL is not set')
  }

  return queueUrl || null
}

function getDlqUrl(): string | null {
  return env.get('EMAIL_SYNC_DLQ_URL')?.trim() || null
}

function isProvider(value: unknown): value is EmailSyncEventMessage['provider'] {
  return value === 'gmail' || value === 'microsoft'
}

function isEventType(value: unknown): value is EmailSyncEventType {
  return (
    value === 'gmail_history' ||
    value === 'microsoft_message_created' ||
    value === 'microsoft_message_updated' ||
    value === 'microsoft_subscription_lifecycle' ||
    value === 'manual_backfill'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEmailSyncEventMessage(body: string | undefined): EmailSyncEventMessage {
  if (!body) {
    throw new EmailSyncEventValidationError('Missing SQS message body')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new EmailSyncEventValidationError('Invalid SQS message JSON')
  }

  if (!isRecord(parsed) || !isProvider(parsed.provider) || !isEventType(parsed.eventType)) {
    throw new EmailSyncEventValidationError('Invalid email sync event provider or eventType')
  }

  if (typeof parsed.eventId !== 'string' || typeof parsed.occurredAt !== 'string') {
    throw new EmailSyncEventValidationError('Invalid email sync event eventId or occurredAt')
  }

  return {
    eventId: parsed.eventId,
    provider: parsed.provider,
    eventType: parsed.eventType,
    occurredAt: parsed.occurredAt,
    email: typeof parsed.email === 'string' ? parsed.email : undefined,
    connectionUuid: typeof parsed.connectionUuid === 'string' ? parsed.connectionUuid : undefined,
    providerCursor: typeof parsed.providerCursor === 'string' ? parsed.providerCursor : undefined,
    providerMessageId:
      typeof parsed.providerMessageId === 'string' ? parsed.providerMessageId : undefined,
    providerThreadId:
      typeof parsed.providerThreadId === 'string' || parsed.providerThreadId === null
        ? parsed.providerThreadId
        : undefined,
    providerSubscriptionId:
      typeof parsed.providerSubscriptionId === 'string' ? parsed.providerSubscriptionId : undefined,
    rawProviderEvent: parsed.rawProviderEvent,
  }
}

function isAuthorizationFailure(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 401 || error.response?.status === 403
  }

  const message = error instanceof Error ? error.message : ''
  return /(^|[^0-9])(401|403)([^0-9]|$)/.test(message)
}

async function markConnectionSuccess(connection: UserInboxConnection) {
  connection.lastSyncAt = DateTime.utc()
  connection.lastSyncError = null
  await connection.save()
}

async function markConnectionFailure(connection: UserInboxConnection, error: unknown) {
  const reason = error instanceof Error ? error.message : 'Email sync failed'
  connection.lastSyncError = reason

  if (isAuthorizationFailure(error)) {
    connection.status = 'reauth_required'
    connection.reauthReason = reason
    connection.reauthRequiredAt = DateTime.utc()
  }

  await connection.save()
  logger.warn(
    {
      err: safeError(error),
      connectionUuid: connection.uuid,
      provider: connection.provider,
      status: connection.status,
      reauthRequired: connection.status === 'reauth_required',
    },
    'Email sync connection failed'
  )
}

async function findConnectionsForEvent(
  event: EmailSyncEventMessage
): Promise<UserInboxConnection[]> {
  if (event.connectionUuid) {
    const connection = await UserInboxConnection.query()
      .where('uuid', event.connectionUuid)
      .where('provider', event.provider)
      .where('status', 'active')
      .first()
    return connection ? [connection] : []
  }

  if (event.providerSubscriptionId) {
    const connection = await UserInboxConnection.query()
      .where('provider_subscription_id', event.providerSubscriptionId)
      .where('provider', event.provider)
      .where('status', 'active')
      .first()
    return connection ? [connection] : []
  }

  if (event.email) {
    return UserInboxConnection.query()
      .where('provider', event.provider)
      .where('email', event.email)
      .where('status', 'active')
      .where('is_primary', true)
  }

  return []
}

async function getVendorEmailsForConnection(connection: UserInboxConnection): Promise<string[]> {
  const projectVendors = await ProjectVendor.query()
    .where('is_active', true)
    .whereHas('project', (query) => {
      query.where('user_uuid', connection.userUuid).where('is_active', true)
    })
    .preload('vendor', (query) => query.preload('vendorListing'))

  const emails = projectVendors
    .map((projectVendor) => projectVendor.vendor.vendorListing.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))

  return [...new Set(emails)]
}

async function syncSummaries(
  connection: UserInboxConnection,
  summaries: InboxMessageSummary[],
  options: {
    directionHint?: 'inbound' | 'outbound'
  } = {}
): Promise<{
  processed: number
  created: number
  skipped: number
  results: ProviderMessageSyncResult[]
}> {
  let processed = 0
  let created = 0
  let skipped = 0
  const results: ProviderMessageSyncResult[] = []

  for (const summary of summaries) {
    const result = await syncProviderMessageForConnection(
      connection,
      {
        ...summary,
        source: 'email_service',
      },
      options
    )
    results.push(result)

    if (result.processed) {
      processed += 1
    }
    if (result.created) {
      created += 1
    } else {
      skipped += 1
    }
  }

  return { processed, created, skipped, results }
}

async function processGmailHistoryEvent(
  connection: UserInboxConnection,
  event: EmailSyncEventMessage
) {
  const summaries = await listInboxChanges(connection, {
    cursor: connection.providerCursor ?? undefined,
  })
  const result = await syncSummaries(connection, summaries, { directionHint: 'inbound' })

  if (event.providerCursor) {
    connection.providerCursor = event.providerCursor
  }
  await markConnectionSuccess(connection)
  return result
}

async function processMicrosoftMessageEvent(
  connection: UserInboxConnection,
  event: EmailSyncEventMessage
) {
  if (!event.providerMessageId) {
    return processManualBackfillEvent(connection)
  }

  const summaries = await listInboxChanges(connection, {
    messageId: event.providerMessageId,
  })
  const result = await syncSummaries(connection, summaries, { directionHint: 'inbound' })
  await markConnectionSuccess(connection)
  return result
}

async function processManualBackfillEvent(connection: UserInboxConnection) {
  const vendorEmails = await getVendorEmailsForConnection(connection)
  if (vendorEmails.length === 0) {
    await markConnectionSuccess(connection)
    return { processed: 0, created: 0, skipped: 0, results: [] }
  }

  const summaries = await searchVendorMessages(connection, {
    vendorEmails,
    maxResults: 200,
  })
  const result = await syncSummaries(connection, summaries)
  await markConnectionSuccess(connection)
  return result
}

export async function processEmailSyncEvent(
  event: EmailSyncEventMessage
): Promise<EmailSyncEventProcessResult> {
  const connections = await findConnectionsForEvent(event)
  logger.info(
    {
      eventId: event.eventId,
      provider: event.provider,
      eventType: event.eventType,
      connectionCount: connections.length,
      connectionUuid: event.connectionUuid,
      providerSubscriptionId: event.providerSubscriptionId,
      hasProviderMessageId: Boolean(event.providerMessageId),
    },
    'Email sync event processing started'
  )
  let processed = 0
  let created = 0
  let skipped = 0

  for (const connection of connections) {
    try {
      let result: Awaited<ReturnType<typeof processManualBackfillEvent>>

      if (event.eventType === 'gmail_history') {
        result = await processGmailHistoryEvent(connection, event)
      } else if (
        event.eventType === 'microsoft_message_created' ||
        event.eventType === 'microsoft_message_updated'
      ) {
        result = await processMicrosoftMessageEvent(connection, event)
      } else {
        result = await processManualBackfillEvent(connection)
      }

      processed += result.processed
      created += result.created
      skipped += result.skipped
    } catch (error) {
      await markConnectionFailure(connection, error)
      throw error
    }
  }

  const result = {
    eventId: event.eventId,
    connections: connections.length,
    processed,
    created,
    skipped,
  }
  logger.info(result, 'Email sync event processing completed')
  return result
}

export async function enqueueEmailSyncEvent(event: EmailSyncEventMessage): Promise<boolean> {
  const queueUrl = getQueueUrl(false)
  if (!queueUrl) {
    logger.warn(
      { provider: event.provider, eventType: event.eventType },
      'EMAIL_SYNC_QUEUE_URL is not set; skipping email sync event enqueue'
    )
    return false
  }

  const messageAttributes: MessageAttributes = {
    provider: { DataType: 'String', StringValue: event.provider },
    eventType: { DataType: 'String', StringValue: event.eventType },
  }

  if (event.connectionUuid) {
    messageAttributes.connectionUuid = {
      DataType: 'String',
      StringValue: event.connectionUuid,
    }
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
      MessageAttributes: messageAttributes,
    })
  )
  logger.info(
    {
      eventId: event.eventId,
      provider: event.provider,
      eventType: event.eventType,
      connectionUuid: event.connectionUuid,
      hasProviderMessageId: Boolean(event.providerMessageId),
    },
    'Email sync event enqueued'
  )
  return true
}

function parseSqsNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseSqsTimestamp(value: string | undefined): string | null {
  const seconds = parseSqsNumber(value)
  if (seconds === null) {
    return null
  }

  return new Date(seconds * 1000).toISOString()
}

async function getQueueAttributes(
  label: 'main' | 'dlq',
  queueUrl: string | null
): Promise<EmailSyncQueueAttributes> {
  if (!queueUrl) {
    return {
      label,
      configured: false,
      approximateVisible: null,
      approximateNotVisible: null,
      approximateDelayed: null,
      createdTimestamp: null,
      lastModifiedTimestamp: null,
    }
  }

  const response = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed',
        'CreatedTimestamp',
        'LastModifiedTimestamp',
      ],
    })
  )
  const attributes = response.Attributes ?? {}
  return {
    label,
    configured: true,
    queueUrl,
    approximateVisible: parseSqsNumber(attributes.ApproximateNumberOfMessages),
    approximateNotVisible: parseSqsNumber(attributes.ApproximateNumberOfMessagesNotVisible),
    approximateDelayed: parseSqsNumber(attributes.ApproximateNumberOfMessagesDelayed),
    createdTimestamp: parseSqsTimestamp(attributes.CreatedTimestamp),
    lastModifiedTimestamp: parseSqsTimestamp(attributes.LastModifiedTimestamp),
  }
}

export async function getEmailSyncQueueDiagnostics(): Promise<EmailSyncQueueDiagnostics> {
  const [main, dlq] = await Promise.all([
    getQueueAttributes('main', getQueueUrl(true)),
    getQueueAttributes('dlq', getDlqUrl()),
  ])

  return { main, dlq }
}

export function buildManualBackfillEvent(connection: UserInboxConnection): EmailSyncEventMessage {
  return {
    eventId: uuidv4(),
    provider: connection.provider === 'microsoft' ? 'microsoft' : 'gmail',
    eventType: 'manual_backfill',
    occurredAt: new Date().toISOString(),
    email: connection.email,
    connectionUuid: connection.uuid,
  }
}

async function deleteSqsMessage(queueUrl: string, message: SqsMessage) {
  if (!message.ReceiptHandle) {
    return
  }

  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    })
  )
}

export async function processEmailSyncQueue(
  options: {
    maxBatches?: number
    maxMessages?: number
    waitTimeSeconds?: number
  } = {}
): Promise<EmailSyncQueueProcessResult> {
  const queueUrl = getQueueUrl(true)!
  const maxBatches = options.maxBatches ?? 5
  const maxMessages = Math.min(options.maxMessages ?? 10, 10)
  const waitTimeSeconds = options.waitTimeSeconds ?? 10
  const result: EmailSyncQueueProcessResult = {
    received: 0,
    deleted: 0,
    failed: 0,
    invalid: 0,
    processed: 0,
    created: 0,
  }

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: waitTimeSeconds,
        MessageAttributeNames: ['All'],
      })
    )

    const messages = response.Messages ?? []
    if (messages.length === 0) {
      break
    }

    result.received += messages.length

    for (const message of messages) {
      try {
        const event = parseEmailSyncEventMessage(message.Body)
        const eventResult = await processEmailSyncEvent(event)
        result.processed += eventResult.processed
        result.created += eventResult.created
        await deleteSqsMessage(queueUrl, message)
        result.deleted += 1
      } catch (error) {
        if (error instanceof EmailSyncEventValidationError) {
          logger.warn(
            { err: safeError(error), sqsMessageId: message.MessageId },
            'Invalid email sync SQS message'
          )
          await deleteSqsMessage(queueUrl, message)
          result.deleted += 1
          result.invalid += 1
          continue
        }

        logger.error(
          { err: safeError(error), sqsMessageId: message.MessageId },
          'Email sync SQS message failed'
        )
        result.failed += 1
      }
    }
  }

  logger.info(result, 'Email sync queue processing completed')
  return result
}
