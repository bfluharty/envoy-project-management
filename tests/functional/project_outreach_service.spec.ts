import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { DateTime } from 'luxon'
import { selectConversationForInboundEmail } from '#services/project_outreach_service'

function buildMessage({
  direction = 'outbound',
  sentAt,
  messageIdHeader = null,
  providerThreadId = null,
}: {
  direction?: string
  sentAt: string
  messageIdHeader?: string | null
  providerThreadId?: string | null
}) {
  return {
    direction,
    sentTimestamp: DateTime.fromISO(sentAt),
    messageIdHeader,
    providerThreadId,
  }
}

function buildConversation({
  uuid,
  createdAt,
  messages = [],
}: {
  uuid: string
  createdAt: string
  messages?: Array<ReturnType<typeof buildMessage>>
}) {
  return {
    uuid,
    timestamp: DateTime.fromISO(createdAt),
    messages,
  }
}

test('selectConversationForInboundEmail prioritizes exact provider thread matches', () => {
  const olderConversation = buildConversation({
    uuid: 'thread-a',
    createdAt: '2026-04-01T10:00:00.000Z',
    messages: [
      buildMessage({
        sentAt: '2026-04-01T10:05:00.000Z',
        providerThreadId: 'gmail-thread-a',
      }),
    ],
  })
  const newerConversation = buildConversation({
    uuid: 'thread-b',
    createdAt: '2026-04-01T12:00:00.000Z',
    messages: [buildMessage({ sentAt: '2026-04-01T12:05:00.000Z' })],
  })

  const selectedConversation = selectConversationForInboundEmail(
    [newerConversation, olderConversation],
    {
      providerThreadId: 'gmail-thread-a',
      receivedAt: '2026-04-01T13:00:00.000Z',
    }
  )

  assert.equal(selectedConversation?.uuid, 'thread-a')
})

test('selectConversationForInboundEmail prioritizes exact reference matches', () => {
  const exactReferenceConversation = buildConversation({
    uuid: 'thread-reference',
    createdAt: '2026-04-01T09:00:00.000Z',
    messages: [
      buildMessage({
        sentAt: '2026-04-01T09:10:00.000Z',
        messageIdHeader: '<message-123@example.com>',
      }),
    ],
  })
  const fallbackConversation = buildConversation({
    uuid: 'thread-fallback',
    createdAt: '2026-04-01T11:00:00.000Z',
    messages: [buildMessage({ sentAt: '2026-04-01T11:05:00.000Z' })],
  })

  const selectedConversation = selectConversationForInboundEmail(
    [fallbackConversation, exactReferenceConversation],
    {
      referenceTokens: ['<message-123@example.com>'],
      receivedAt: '2026-04-01T12:00:00.000Z',
    }
  )

  assert.equal(selectedConversation?.uuid, 'thread-reference')
})

test('selectConversationForInboundEmail uses the nearest prior outbound send as the fallback', () => {
  const earlyConversation = buildConversation({
    uuid: 'thread-early',
    createdAt: '2026-04-01T09:00:00.000Z',
    messages: [buildMessage({ sentAt: '2026-04-01T09:15:00.000Z' })],
  })
  const bestConversation = buildConversation({
    uuid: 'thread-best',
    createdAt: '2026-04-01T11:00:00.000Z',
    messages: [buildMessage({ sentAt: '2026-04-01T11:45:00.000Z' })],
  })
  const tooLateConversation = buildConversation({
    uuid: 'thread-too-late',
    createdAt: '2026-04-01T12:30:00.000Z',
    messages: [buildMessage({ sentAt: '2026-04-01T12:30:00.000Z' })],
  })

  const selectedConversation = selectConversationForInboundEmail(
    [tooLateConversation, bestConversation, earlyConversation],
    {
      receivedAt: '2026-04-01T12:00:00.000Z',
    }
  )

  assert.equal(selectedConversation?.uuid, 'thread-best')
})

test('selectConversationForInboundEmail falls back to the newest conversation when no outbound send qualifies', () => {
  const olderConversation = buildConversation({
    uuid: 'thread-older',
    createdAt: '2026-04-01T10:00:00.000Z',
    messages: [buildMessage({ sentAt: '2026-04-01T13:00:00.000Z' })],
  })
  const newestConversation = buildConversation({
    uuid: 'thread-newest',
    createdAt: '2026-04-01T12:00:00.000Z',
    messages: [],
  })

  const selectedConversation = selectConversationForInboundEmail(
    [olderConversation, newestConversation],
    {
      receivedAt: '2026-04-01T11:00:00.000Z',
    }
  )

  assert.equal(selectedConversation?.uuid, 'thread-newest')
})
