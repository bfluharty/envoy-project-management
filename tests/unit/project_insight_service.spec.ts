import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import ProjectInsight from '#models/project_insight'
import ProjectInsightStatus from '#models/project_insight_status'
import ProjectInsightType from '#models/project_insight_type'
import ProjectInsightService from '#services/project_insight_service'

type Call = {
  model: string
  method: string
  args: unknown[]
}

type ReferenceRow = {
  id: number
  code: string
}

function stubReferenceLookup(
  model: typeof ProjectInsightStatus | typeof ProjectInsightType,
  rowsByCode: Record<string, ReferenceRow>,
  calls: Call[]
) {
  const originalQuery = model.query

  model.query = (() => {
    const state: { code?: string } = {}

    return {
      where(column: string, value: unknown) {
        calls.push({ model: model.name, method: 'where', args: [column, value] })
        if (column === 'code') {
          state.code = String(value)
        }
        return this
      },
      andWhere(column: string, value: unknown) {
        calls.push({ model: model.name, method: 'andWhere', args: [column, value] })
        return this
      },
      firstOrFail() {
        calls.push({ model: model.name, method: 'firstOrFail', args: [] })
        const row = state.code ? rowsByCode[state.code] : undefined
        if (!row) {
          throw new Error(`Missing reference row: ${state.code}`)
        }
        return row
      },
    }
  }) as unknown as typeof model.query

  return () => {
    model.query = originalQuery
  }
}

test.group('ProjectInsightService.getActiveInsightsByProject', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  test('fetches active insights with the default limit and expected ordering', async () => {
    const calls: Call[] = []
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ACTIVE: { id: 11, code: 'ACTIVE' } }, calls)
    )

    const originalInsightQuery = ProjectInsight.query
    restores.push(() => {
      ProjectInsight.query = originalInsightQuery
    })

    ProjectInsight.query = (() => {
      return {
        where(column: string, value: unknown) {
          calls.push({ model: 'ProjectInsight', method: 'where', args: [column, value] })
          return this
        },
        andWhere(column: string, value: unknown) {
          calls.push({ model: 'ProjectInsight', method: 'andWhere', args: [column, value] })
          return this
        },
        preload(relation: string) {
          calls.push({ model: 'ProjectInsight', method: 'preload', args: [relation] })
          return this
        },
        orderBy(column: string, direction: string) {
          calls.push({ model: 'ProjectInsight', method: 'orderBy', args: [column, direction] })
          return this
        },
        limit(value: number) {
          calls.push({ model: 'ProjectInsight', method: 'limit', args: [value] })
          return [{ uuid: 'insight-1' }]
        },
      }
    }) as unknown as typeof ProjectInsight.query

    const insights = await ProjectInsightService.getActiveInsightsByProject('project-1')

    assert.deepEqual(insights, [{ uuid: 'insight-1' }])
    assert.deepEqual(
      calls.filter((call) => call.model === 'ProjectInsightStatus'),
      [
        { model: 'ProjectInsightStatus', method: 'where', args: ['code', 'ACTIVE'] },
        { model: 'ProjectInsightStatus', method: 'andWhere', args: ['is_active', true] },
        { model: 'ProjectInsightStatus', method: 'firstOrFail', args: [] },
      ]
    )
    assert.deepEqual(
      calls.filter((call) => call.model === 'ProjectInsight'),
      [
        { model: 'ProjectInsight', method: 'where', args: ['project_uuid', 'project-1'] },
        { model: 'ProjectInsight', method: 'andWhere', args: ['status_id', 11] },
        { model: 'ProjectInsight', method: 'andWhere', args: ['is_active', true] },
        { model: 'ProjectInsight', method: 'preload', args: ['insightType'] },
        { model: 'ProjectInsight', method: 'preload', args: ['status'] },
        { model: 'ProjectInsight', method: 'orderBy', args: ['importance', 'desc'] },
        { model: 'ProjectInsight', method: 'orderBy', args: ['modified_timestamp', 'desc'] },
        { model: 'ProjectInsight', method: 'limit', args: [30] },
      ]
    )
  })

  test('uses a caller supplied limit', async () => {
    const calls: Call[] = []
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ACTIVE: { id: 11, code: 'ACTIVE' } }, calls)
    )

    const originalInsightQuery = ProjectInsight.query
    restores.push(() => {
      ProjectInsight.query = originalInsightQuery
    })

    ProjectInsight.query = (() => {
      return {
        where() {
          return this
        },
        andWhere() {
          return this
        },
        preload() {
          return this
        },
        orderBy() {
          return this
        },
        limit(value: number) {
          calls.push({ model: 'ProjectInsight', method: 'limit', args: [value] })
          return []
        },
      }
    }) as unknown as typeof ProjectInsight.query

    await ProjectInsightService.getActiveInsightsByProject('project-1', 5)

    assert.deepEqual(calls.find((call) => call.method === 'limit')?.args, [5])
  })
})

test.group('ProjectInsightService.createInsight', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  test('creates an insight with default optional values and default active status', async () => {
    const calls: Call[] = []
    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { project_fact: { id: 21, code: 'project_fact' } },
        calls
      )
    )
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ACTIVE: { id: 11, code: 'ACTIVE' } }, calls)
    )

    const originalCreate = ProjectInsight.create
    restores.push(() => {
      ProjectInsight.create = originalCreate
    })

    ProjectInsight.create = (async (payload: unknown) => {
      calls.push({ model: 'ProjectInsight', method: 'create', args: [payload] })
      return { uuid: 'created-insight', ...(payload as object) }
    }) as typeof ProjectInsight.create

    const input = {
      insightType: 'project_fact',
      insightText: 'The project is in Richmond.',
    } as Parameters<typeof ProjectInsightService.createInsight>[1]

    const insight = await ProjectInsightService.createInsight('project-1', input)

    assert.equal(insight.uuid, 'created-insight')
    assert.deepEqual(
      calls.filter((call) => call.model === 'ProjectInsightStatus'),
      [
        { model: 'ProjectInsightStatus', method: 'where', args: ['code', 'ACTIVE'] },
        { model: 'ProjectInsightStatus', method: 'andWhere', args: ['is_active', true] },
        { model: 'ProjectInsightStatus', method: 'firstOrFail', args: [] },
      ]
    )
    assert.deepEqual(calls.find((call) => call.method === 'create')?.args[0], {
      projectUuid: 'project-1',
      insightTypeId: 21,
      statusId: 11,
      insightText: 'The project is in Richmond.',
      importance: 3,
      confidence: null,
      supersedesInsightUuid: null,
    })
  })

  test('creates an insight with supplied status and optional values', async () => {
    const calls: Call[] = []
    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { project_constraint: { id: 22, code: 'project_constraint' } },
        calls
      )
    )
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ARCHIVED: { id: 14, code: 'ARCHIVED' } }, calls)
    )

    const originalCreate = ProjectInsight.create
    restores.push(() => {
      ProjectInsight.create = originalCreate
    })

    ProjectInsight.create = (async (payload: unknown) => {
      calls.push({ model: 'ProjectInsight', method: 'create', args: [payload] })
      return payload
    }) as typeof ProjectInsight.create

    await ProjectInsightService.createInsight('project-1', {
      insightType: 'project_constraint',
      insightStatus: 'ARCHIVED',
      insightText: 'Budget must stay below $50,000.',
      importance: 5,
      confidence: 0.94,
      supersedesInsightUuid: 'old-insight',
    })

    assert.deepEqual(
      calls.filter((call) => call.model === 'ProjectInsightStatus'),
      [
        { model: 'ProjectInsightStatus', method: 'where', args: ['code', 'ARCHIVED'] },
        { model: 'ProjectInsightStatus', method: 'andWhere', args: ['is_active', true] },
        { model: 'ProjectInsightStatus', method: 'firstOrFail', args: [] },
      ]
    )
    assert.deepEqual(calls.find((call) => call.method === 'create')?.args[0], {
      projectUuid: 'project-1',
      insightTypeId: 22,
      statusId: 14,
      insightText: 'Budget must stay below $50,000.',
      importance: 5,
      confidence: 0.94,
      supersedesInsightUuid: 'old-insight',
    })
  })
})
