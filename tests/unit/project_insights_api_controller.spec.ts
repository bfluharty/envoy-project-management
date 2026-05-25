import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import logger from '@adonisjs/core/services/logger'
import ProjectInsightsApiController from '#controllers/api/project_insights_api_controller'
import ProjectInsightService, {
  ProjectInsightProjectNotFoundError,
  ProjectInsightValidationError,
} from '#services/project_insight_service'

type ResponsePayload = {
  statusCode?: number
  body?: unknown
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
  }
}

function makeRequest({
  projectUuid = '11111111-1111-4111-8111-111111111111',
  payload,
  validateError,
  validateCalls,
}: {
  projectUuid?: string
  payload?: unknown
  validateError?: Error
  validateCalls?: unknown[]
}) {
  return {
    params() {
      return { projectUuid }
    },
    async validateUsing(validator: unknown) {
      validateCalls?.push(validator)

      if (validateError) {
        throw validateError
      }

      return payload ?? {}
    },
  }
}

test.group('ProjectInsightsApiController.apply', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubInsightService({
    ensureError,
    applyError,
    applyResult = { created_count: 0, updated_count: 0, skipped_count: 0 },
    calls,
  }: {
    ensureError?: Error
    applyError?: Error
    applyResult?: unknown
    calls: Array<{ method: string; args: unknown[] }>
  }) {
    const originalEnsure = ProjectInsightService.ensureActiveProjectExists
    const originalApply = ProjectInsightService.applyExtractedChanges

    restores.push(() => {
      ProjectInsightService.ensureActiveProjectExists = originalEnsure
      ProjectInsightService.applyExtractedChanges = originalApply
    })

    ProjectInsightService.ensureActiveProjectExists = (async (projectUuid: string) => {
      calls.push({ method: 'ensureActiveProjectExists', args: [projectUuid] })

      if (ensureError) {
        throw ensureError
      }

      return { uuid: projectUuid }
    }) as typeof ProjectInsightService.ensureActiveProjectExists

    ProjectInsightService.applyExtractedChanges = (async (projectUuid: string, input: unknown) => {
      calls.push({ method: 'applyExtractedChanges', args: [projectUuid, input] })

      if (applyError) {
        throw applyError
      }

      return applyResult
    }) as typeof ProjectInsightService.applyExtractedChanges
  }

  test('applies validated changes and maps request payload fields', async () => {
    const controller = new ProjectInsightsApiController()
    const responsePayload: ResponsePayload = {}
    const calls: Array<{ method: string; args: unknown[] }> = []
    stubInsightService({
      calls,
      applyResult: {
        created_count: 2,
        updated_count: 2,
        skipped_count: 1,
      },
    })

    await controller.apply({
      request: makeRequest({
        payload: {
          new_insights: [
            {
              insight_type: 'project_fact',
              insight_text: 'The project is in Richmond.',
              importance: 4,
              confidence: undefined,
            },
            {
              insight_type: 'risk_or_blocker',
              insight_text: 'Permit approval is pending.',
              confidence: 0.8,
            },
          ],
          updates: [
            {
              existing_insight_uuid: '22222222-2222-4222-8222-222222222222',
              operation: 'ARCHIVED',
            },
            {
              existing_insight_uuid: '33333333-3333-4333-8333-333333333333',
              operation: 'SUPERSEDED',
              replacement_insight: {
                insight_type: 'project_constraint',
                insight_text: 'Budget is now $40,000.',
                importance: 5,
                confidence: undefined,
              },
            },
          ],
        },
      }),
      response: makeResponse(responsePayload),
    } as any)

    assert.equal(responsePayload.statusCode, 200)
    assert.deepEqual(responsePayload.body, {
      created_count: 2,
      updated_count: 2,
      skipped_count: 1,
    })
    assert.deepEqual(calls, [
      {
        method: 'ensureActiveProjectExists',
        args: ['11111111-1111-4111-8111-111111111111'],
      },
      {
        method: 'applyExtractedChanges',
        args: [
          '11111111-1111-4111-8111-111111111111',
          {
            newInsights: [
              {
                insightType: 'project_fact',
                insightText: 'The project is in Richmond.',
                importance: 4,
                confidence: null,
              },
              {
                insightType: 'risk_or_blocker',
                insightText: 'Permit approval is pending.',
                importance: undefined,
                confidence: 0.8,
              },
            ],
            updates: [
              {
                existingInsightUuid: '22222222-2222-4222-8222-222222222222',
                operation: 'ARCHIVED',
                replacementInsight: undefined,
              },
              {
                existingInsightUuid: '33333333-3333-4333-8333-333333333333',
                operation: 'SUPERSEDED',
                replacementInsight: {
                  insightType: 'project_constraint',
                  insightText: 'Budget is now $40,000.',
                  importance: 5,
                  confidence: null,
                },
              },
            ],
          },
        ],
      },
    ])
  })

  test('passes undefined insight arrays when payload omits them', async () => {
    const controller = new ProjectInsightsApiController()
    const responsePayload: ResponsePayload = {}
    const calls: Array<{ method: string; args: unknown[] }> = []
    stubInsightService({ calls })

    await controller.apply({
      request: makeRequest({ payload: {} }),
      response: makeResponse(responsePayload),
    } as any)

    assert.equal(responsePayload.statusCode, 200)
    assert.deepEqual(calls[1], {
      method: 'applyExtractedChanges',
      args: [
        '11111111-1111-4111-8111-111111111111',
        {
          newInsights: undefined,
          updates: undefined,
        },
      ],
    })
  })

  test('returns 404 and does not validate body when project is missing', async () => {
    const controller = new ProjectInsightsApiController()
    const responsePayload: ResponsePayload = {}
    const calls: Array<{ method: string; args: unknown[] }> = []
    const validateCalls: unknown[] = []
    stubInsightService({
      calls,
      ensureError: new ProjectInsightProjectNotFoundError('11111111-1111-4111-8111-111111111111'),
    })

    await controller.apply({
      request: makeRequest({
        validateCalls,
        validateError: new Error('body validation should not run'),
      }),
      response: makeResponse(responsePayload),
    } as any)

    assert.equal(responsePayload.statusCode, 404)
    assert.deepEqual(responsePayload.body, { error: 'Project not found' })
    assert.deepEqual(validateCalls, [])
    assert.equal(calls.length, 1)
  })

  test('returns 400 for project insight validation errors', async () => {
    const controller = new ProjectInsightsApiController()
    const responsePayload: ResponsePayload = {}
    const calls: Array<{ method: string; args: unknown[] }> = []
    stubInsightService({
      calls,
      applyError: new ProjectInsightValidationError('Unknown insight type: unknown'),
    })

    await controller.apply({
      request: makeRequest({ payload: {} }),
      response: makeResponse(responsePayload),
    } as any)

    assert.equal(responsePayload.statusCode, 400)
    assert.deepEqual(responsePayload.body, { error: 'Unknown insight type: unknown' })
  })

  test('returns 500 for unexpected errors', async () => {
    const controller = new ProjectInsightsApiController()
    const responsePayload: ResponsePayload = {}
    const calls: Array<{ method: string; args: unknown[] }> = []
    const logCalls: unknown[] = []
    const originalLoggerError = logger.error
    restores.push(() => {
      logger.error = originalLoggerError
    })
    logger.error = ((value: unknown) => {
      logCalls.push(value)
    }) as typeof logger.error
    stubInsightService({
      calls,
      applyError: new Error('database unavailable'),
    })

    await controller.apply({
      request: makeRequest({ payload: {} }),
      response: makeResponse(responsePayload),
    } as any)

    assert.equal(responsePayload.statusCode, 500)
    assert.deepEqual(responsePayload.body, {
      error: 'Failed to apply project insight changes',
      developerText: 'database unavailable',
    })
    assert.equal(logCalls.length, 2)
  })
})
