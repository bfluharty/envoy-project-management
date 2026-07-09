import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import axios from 'axios'
import ProjectService from '#services/project_service'
import ReasoningEngineService from '#services/reasoning_engine_service'
import type { ReasoningAgentResponse, ReasoningRequest } from '../../types/request.js'

type ResponsePayload = {
  statusCode?: number
  body?: unknown
  sent?: unknown
}

function makeResponse(payload: ResponsePayload) {
  return {
    status(statusCode: number) {
      payload.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      payload.body = body
      return body
    },
    send(body: unknown) {
      payload.sent = body
      return body
    },
  }
}

function makePlanningResponse(input: Partial<ReasoningAgentResponse> = {}): ReasoningAgentResponse {
  return {
    agentId: 'PLANNING',
    message: 'Planning response',
    data: null,
    readyForNextStep: false,
    missingFields: [],
    turn: {
      agentId: 'PLANNING',
      userPrompt: 'What should we do?',
      modelResponse: 'Planning response',
      timestamp: '2026-07-05T12:00:00.000Z',
    },
    ...input,
  }
}

test.group('ReasoningEngineService', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubAxiosPost(
    implementation: (url: string, payload: unknown) => Promise<{ status: number; data: unknown }>,
    calls: Array<{ url: string; payload: unknown }>
  ) {
    const original = axios.post
    restores.push(() => {
      axios.post = original
    })

    axios.post = (async (url: string, payload: unknown) => {
      calls.push({ url, payload })
      return implementation(url, payload)
    }) as typeof axios.post
  }

  function stubRequestAgent(responseOrError: ReasoningAgentResponse | Error) {
    const original = ReasoningEngineService.requestAgent
    restores.push(() => {
      ReasoningEngineService.requestAgent = original
    })

    ReasoningEngineService.requestAgent = (async () => {
      if (responseOrError instanceof Error) {
        throw responseOrError
      }

      return responseOrError
    }) as typeof ReasoningEngineService.requestAgent
  }

  function stubSaveConversationTurn(calls: unknown[]) {
    const original = ProjectService.saveConversationTurn
    restores.push(() => {
      ProjectService.saveConversationTurn = original
    })

    ProjectService.saveConversationTurn = (async (conversationUuid: string, turn: unknown) => {
      calls.push({ conversationUuid, turn })
    }) as typeof ProjectService.saveConversationTurn
  }

  test('requestAgent posts deterministic requests to the reasoning chat endpoint', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    const reasoningRequest: ReasoningRequest = {
      agentId: 'INTAKE',
      projectContext: {
        uuid: 'project-1',
        name: 'Office Renovation',
      },
    }
    const agentResponse = makePlanningResponse({ agentId: 'INTAKE', message: null })
    stubAxiosPost(async () => ({ status: 200, data: agentResponse }), calls)

    const result = await ReasoningEngineService.requestAgent(reasoningRequest)

    assert.equal(result, agentResponse)
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /\/reasoning\/chat$/)
    assert.equal(calls[0].payload, reasoningRequest)
  })

  test('requestAgent throws when reasoning chat returns a non-200 status', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    stubAxiosPost(async () => ({ status: 502, data: { error: 'bad output' } }), calls)

    await assert.rejects(
      () =>
        ReasoningEngineService.requestAgent({
          agentId: 'INTAKE',
          projectContext: {
            uuid: 'project-1',
            name: 'Office Renovation',
          },
        }),
      /Reasoning engine error/
    )
  })

  test('requestVendorDiscovery posts descriptions and returns vendor searches', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    const vendorDiscoveryResponse = {
      vendorSearches: [
        {
          classification: 'Electrician',
          query: 'commercial electrician',
          rationale: 'Electrical work is needed.',
        },
      ],
    }
    stubAxiosPost(async () => ({ status: 200, data: vendorDiscoveryResponse }), calls)

    const result = await ReasoningEngineService.requestVendorDiscovery({
      projectDescription: 'Renovate an office.',
    })

    assert.equal(result, vendorDiscoveryResponse)
    assert.match(calls[0].url, /\/reasoning\/vendor-discovery$/)
    assert.deepEqual(calls[0].payload, { projectDescription: 'Renovate an office.' })
  })

  test('requestVendorDiscovery surfaces transport and non-200 failures', async () => {
    const transportCalls: Array<{ url: string; payload: unknown }> = []
    stubAxiosPost(async () => {
      throw new Error('network unavailable')
    }, transportCalls)

    await assert.rejects(
      () => ReasoningEngineService.requestVendorDiscovery({ projectDescription: 'Renovate.' }),
      /network unavailable/
    )

    while (restores.length) {
      restores.pop()?.()
    }

    const statusCalls: Array<{ url: string; payload: unknown }> = []
    stubAxiosPost(async () => ({ status: 500, data: { error: 'failed' } }), statusCalls)

    await assert.rejects(
      () => ReasoningEngineService.requestVendorDiscovery({ projectDescription: 'Renovate.' }),
      /Reasoning engine vendor discovery error/
    )
  })

  test('handleReasoningChat can return unsaved greeting text when saveToHistory is false', async () => {
    const responsePayload: ResponsePayload = {}
    stubRequestAgent(makePlanningResponse({ message: 'Hello stakeholder.' }))

    await ReasoningEngineService.handleReasoningChat(
      {
        agentId: 'PLANNING',
        promptData: { prompt: 'Hello' },
      },
      { uuid: 'project-1', conversations: [{ uuid: 'conversation-1' }] } as any,
      makeResponse(responsePayload) as any,
      { saveToHistory: false }
    )

    assert.equal(responsePayload.statusCode, 200)
    assert.equal(responsePayload.sent, 'Hello stakeholder.')
  })

  test('handleReasoningChat saves non-ready planning turns without generating outreach drafts', async () => {
    const responsePayload: ResponsePayload = {}
    const saveCalls: unknown[] = []
    const agentResponse = makePlanningResponse({
      message: null,
      turn: {
        agentId: 'PLANNING',
        userPrompt: 'Budget is $40,000.',
        modelResponse: 'Need the timeline before outreach.',
        timestamp: '2026-07-05T12:00:00.000Z',
      },
    })
    stubRequestAgent(agentResponse)
    stubSaveConversationTurn(saveCalls)

    await ReasoningEngineService.handleReasoningChat(
      {
        agentId: 'PLANNING',
        promptData: { prompt: 'Budget is $40,000.' },
      },
      { uuid: 'project-1', conversations: [{ uuid: 'conversation-1' }] } as any,
      makeResponse(responsePayload) as any
    )

    assert.equal(responsePayload.statusCode, 200)
    assert.equal(responsePayload.body, 'Need the timeline before outreach.')
    assert.deepEqual(saveCalls, [
      {
        conversationUuid: 'conversation-1',
        turn: agentResponse.turn,
      },
    ])
  })

  test('handleReasoningChat maps request failures to a 500 response', async () => {
    const responsePayload: ResponsePayload = {}
    stubRequestAgent(new Error('reasoning unavailable'))

    await ReasoningEngineService.handleReasoningChat(
      {
        agentId: 'PLANNING',
        promptData: { prompt: 'Budget is $40,000.' },
      },
      { uuid: 'project-1', conversations: [{ uuid: 'conversation-1' }] } as any,
      makeResponse(responsePayload) as any
    )

    assert.equal(responsePayload.statusCode, 500)
    assert.deepEqual(responsePayload.body, {
      error: 'Failed to call reasoning engine',
      developerText: 'reasoning unavailable',
    })
  })

  test('ensureDraftingNotice only appends the outreach tab notice when missing', () => {
    assert.equal(
      (ReasoningEngineService as any).ensureDraftingNotice('Ready.'),
      'Ready. I am generating draft emails for all vendors attached to this project, and you can review them in the Outreach tab.'
    )
    assert.equal(
      (ReasoningEngineService as any).ensureDraftingNotice(
        'Draft emails are being created; check the Outreach tab.'
      ),
      'Draft emails are being created; check the Outreach tab.'
    )
  })
})
