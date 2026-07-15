import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import ConversationTurn from '#models/conversation_turn'
import ProjectInsightService from '#services/project_insight_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'

type Call = {
  model: string
  method: string
  args: unknown[]
}

test.group('ReasoningRequestContextService', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubProjectInsights(insights: unknown[], calls: Call[]) {
    const originalGetActiveInsightsByProject = ProjectInsightService.getActiveInsightsByProject
    restores.push(() => {
      ProjectInsightService.getActiveInsightsByProject = originalGetActiveInsightsByProject
    })

    ProjectInsightService.getActiveInsightsByProject = (async (
      projectUuid: string,
      limit?: number
    ) => {
      calls.push({
        model: 'ProjectInsightService',
        method: 'getActiveInsightsByProject',
        args: [projectUuid, limit],
      })
      return insights
    }) as typeof ProjectInsightService.getActiveInsightsByProject
  }

  function stubConversationTurns(turns: unknown[], calls: Call[]) {
    const originalConversationTurnQuery = ConversationTurn.query
    restores.push(() => {
      ConversationTurn.query = originalConversationTurnQuery
    })

    ConversationTurn.query = (() => {
      return {
        where(column: string, value: unknown) {
          calls.push({ model: 'ConversationTurn', method: 'where', args: [column, value] })
          return this
        },
        orderBy(column: string, direction: string) {
          calls.push({ model: 'ConversationTurn', method: 'orderBy', args: [column, direction] })
          return this
        },
        limit(value: number) {
          calls.push({ model: 'ConversationTurn', method: 'limit', args: [value] })
          return turns
        },
      }
    }) as unknown as typeof ConversationTurn.query
  }

  test('maps active project insights to the reasoning-engine payload shape', async () => {
    const calls: Call[] = []
    stubProjectInsights(
      [
        {
          uuid: 'insight-1',
          insightType: { code: 'PROJECT_CONSTRAINT' },
          insightText: 'Budget should remain below $50,000.',
          importance: '5',
          confidence: '0.940',
        },
        {
          uuid: 'insight-2',
          insightType: { code: 'USER_PREFERENCE' },
          insightText: 'User prefers local vendors when practical.',
          importance: 3,
          confidence: null,
        },
      ],
      calls
    )

    const payload = await ReasoningRequestContextService.getProjectInsights('project-1')

    assert.deepEqual(calls, [
      {
        model: 'ProjectInsightService',
        method: 'getActiveInsightsByProject',
        args: ['project-1', 30],
      },
    ])
    assert.deepEqual(payload, [
      {
        uuid: 'insight-1',
        type: 'project_constraint',
        text: 'Budget should remain below $50,000.',
        importance: 5,
        confidence: 0.94,
      },
      {
        uuid: 'insight-2',
        type: 'user_preference',
        text: 'User prefers local vendors when practical.',
        importance: 3,
        confidence: null,
      },
    ])
  })

  test('fetches previous turns and returns new agent turns in chronological form', async () => {
    const calls: Call[] = []
    stubConversationTurns(
      [
        {
          contents: {
            agentId: 'PLANNING',
            planningStatus: 'AWAITING_FINAL_DETAILS',
            userPrompt: 'Newest user message',
            modelResponse: 'Newest assistant response',
            timestamp: '2026-07-05T12:05:00.000Z',
          },
        },
        {
          contents: {
            agentId: 'PLANNING',
            userPrompt: 'Older user message',
            modelResponse: 'Older assistant response',
            timestamp: '2026-07-05T12:00:00.000Z',
          },
        },
        {
          contents: {
            userPrompt: 'Legacy user message',
            modelResponse: 'Legacy assistant response',
          },
        },
      ],
      calls
    )

    const payload = await ReasoningRequestContextService.getRecentTurns('conversation-1')

    assert.deepEqual(calls, [
      { model: 'ConversationTurn', method: 'where', args: ['conversation_uuid', 'conversation-1'] },
      { model: 'ConversationTurn', method: 'orderBy', args: ['timestamp', 'desc'] },
      { model: 'ConversationTurn', method: 'orderBy', args: ['id', 'desc'] },
      { model: 'ConversationTurn', method: 'limit', args: [5] },
    ])
    assert.deepEqual(payload, [
      {
        agentId: 'PLANNING',
        userPrompt: 'Older user message',
        modelResponse: 'Older assistant response',
        timestamp: '2026-07-05T12:00:00.000Z',
      },
      {
        agentId: 'PLANNING',
        planningStatus: 'AWAITING_FINAL_DETAILS',
        userPrompt: 'Newest user message',
        modelResponse: 'Newest assistant response',
        timestamp: '2026-07-05T12:05:00.000Z',
      },
    ])
  })

  test('builds complete lean reasoning context when no insights or turns exist', async () => {
    const calls: Call[] = []
    stubProjectInsights([], calls)
    stubConversationTurns([], calls)

    const context = await ReasoningRequestContextService.buildContext('project-1', 'conversation-1')

    assert.deepEqual(context, {
      projectInsights: [],
      recentTurns: [],
      planningStatus: 'COLLECTING_DETAILS',
    })
  })

  test('builds the current planning status from the latest persisted planning turn', async () => {
    const calls: Call[] = []
    stubProjectInsights([], calls)
    stubConversationTurns(
      [
        {
          contents: {
            agentId: 'PLANNING',
            planningStatus: 'AWAITING_FINAL_DETAILS',
            userPrompt: 'Ready for final details.',
            modelResponse: 'Anything else to include?',
            timestamp: '2026-07-05T12:05:00.000Z',
          },
        },
      ],
      calls
    )

    const context = await ReasoningRequestContextService.buildContext('project-1', 'conversation-1')

    assert.equal(context.planningStatus, 'AWAITING_FINAL_DETAILS')
    assert.equal(context.recentTurns[0].planningStatus, 'AWAITING_FINAL_DETAILS')
  })
})
