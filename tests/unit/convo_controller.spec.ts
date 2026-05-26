import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import ConvoController from '#controllers/web/projects/convo_controller'
import ProjectVendor from '#models/project_vendor'
import ProjectService from '#services/project_service'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'

function makeResponse() {
  return {
    abort(payload: unknown, statusCode: number) {
      return { payload, statusCode }
    },
  }
}

test.group('ConvoController reasoning request assembly', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubProjectService(project: unknown) {
    const originalGetProjectWithConversations = ProjectService.getProjectWithConversations
    restores.push(() => {
      ProjectService.getProjectWithConversations = originalGetProjectWithConversations
    })

    ProjectService.getProjectWithConversations = (async () =>
      project) as typeof ProjectService.getProjectWithConversations
  }

  function stubReasoningContext(calls: unknown[]) {
    const originalBuildContext = ReasoningRequestContextService.buildContext
    restores.push(() => {
      ReasoningRequestContextService.buildContext = originalBuildContext
    })

    ReasoningRequestContextService.buildContext = (async (
      projectUuid: string,
      conversationUuid: string
    ) => {
      calls.push({ projectUuid, conversationUuid })
      return {
        projectInsights: [
          {
            uuid: 'insight-1',
            type: 'project_fact',
            text: 'Project is in Richmond.',
            importance: 3,
            confidence: 0.9,
          },
        ],
        recentTurns: [
          {
            user_message: 'Earlier question',
            assistant_response: 'Earlier answer',
            action_metadata: [{ action: 'GET_PROJECT_DETAILS', success: true, error: null }],
          },
        ],
      }
    }) as typeof ReasoningRequestContextService.buildContext
  }

  function stubEmptyProjectVendors() {
    const originalProjectVendorQuery = ProjectVendor.query
    restores.push(() => {
      ProjectVendor.query = originalProjectVendorQuery
    })

    ProjectVendor.query = (() => {
      return {
        where() {
          return this
        },
        preload() {
          return []
        },
      }
    }) as unknown as typeof ProjectVendor.query
  }

  function stubReasoningEngine(calls: unknown[]) {
    const originalHandleReasoningChat = ReasoningEngineService.handleReasoningChat
    restores.push(() => {
      ReasoningEngineService.handleReasoningChat = originalHandleReasoningChat
    })

    ReasoningEngineService.handleReasoningChat = (async (
      reasoningRequest: unknown,
      project: unknown,
      response: unknown,
      options?: unknown
    ) => {
      calls.push({ reasoningRequest, project, response, options })
    }) as typeof ReasoningEngineService.handleReasoningChat
  }

  test('chat includes active insights and previous 5 turns in the reasoning request', async () => {
    const controller = new ConvoController()
    const projectUuid = '11111111-1111-4111-8111-111111111111'
    const project = {
      uuid: projectUuid,
      title: 'Office Renovation',
      description: null,
      location: null,
      budgetAmount: null,
      goals: null,
      conversations: [{ uuid: 'conversation-1' }],
    }
    const contextCalls: unknown[] = []
    const reasoningCalls: any[] = []
    stubProjectService(project)
    stubReasoningContext(contextCalls)
    stubEmptyProjectVendors()
    stubReasoningEngine(reasoningCalls)

    await controller.chat({
      auth: { getUserOrFail: () => ({ uuid: 'user-1' }) },
      request: {
        params: () => ({ uuid: projectUuid }),
        validateUsing: async () => ({ prompt: 'What should we do next?', variables: {} }),
      },
      response: makeResponse(),
    } as any)

    assert.deepEqual(contextCalls, [{ projectUuid, conversationUuid: 'conversation-1' }])
    assert.equal(reasoningCalls.length, 1)
    assert.deepEqual(reasoningCalls[0].reasoningRequest.projectInsights, [
      {
        uuid: 'insight-1',
        type: 'project_fact',
        text: 'Project is in Richmond.',
        importance: 3,
        confidence: 0.9,
      },
    ])
    assert.deepEqual(reasoningCalls[0].reasoningRequest.recentTurns, [
      {
        user_message: 'Earlier question',
        assistant_response: 'Earlier answer',
        action_metadata: [{ action: 'GET_PROJECT_DETAILS', success: true, error: null }],
      },
    ])
    assert.equal('pastConversationTurns' in reasoningCalls[0].reasoningRequest, false)
    assert.equal(reasoningCalls[0].reasoningRequest.prompt, 'What should we do next?')
  })

  test('greeting also includes the lean reasoning context', async () => {
    const controller = new ConvoController()
    const projectUuid = '11111111-1111-4111-8111-111111111111'
    const project = {
      uuid: projectUuid,
      title: 'Office Renovation',
      description: null,
      location: null,
      budgetAmount: null,
      goals: null,
      conversations: [{ uuid: 'conversation-1' }],
    }
    const contextCalls: unknown[] = []
    const reasoningCalls: any[] = []
    stubProjectService(project)
    stubReasoningContext(contextCalls)
    stubEmptyProjectVendors()
    stubReasoningEngine(reasoningCalls)

    await controller.greeting({
      auth: { getUserOrFail: () => ({ uuid: 'user-1' }) },
      request: {
        params: () => ({ uuid: projectUuid }),
      },
      response: makeResponse(),
    } as any)

    assert.deepEqual(contextCalls, [{ projectUuid, conversationUuid: 'conversation-1' }])
    assert.deepEqual(reasoningCalls[0].reasoningRequest.recentTurns, [
      {
        user_message: 'Earlier question',
        assistant_response: 'Earlier answer',
        action_metadata: [{ action: 'GET_PROJECT_DETAILS', success: true, error: null }],
      },
    ])
    assert.deepEqual(reasoningCalls[0].options, { saveToHistory: false })
  })
})
