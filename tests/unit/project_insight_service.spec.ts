import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import Project from '#models/project'
import ProjectInsight from '#models/project_insight'
import ProjectInsightStatus from '#models/project_insight_status'
import ProjectInsightType from '#models/project_insight_type'
import ProjectInsightService from '#services/project_insight_service'
import { ProjectInsightStatusCode } from '../../types/project_insight.js'

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
      first() {
        calls.push({ model: model.name, method: 'first', args: [] })
        const row = state.code ? rowsByCode[state.code] : undefined
        return row ?? null
      },
    }
  }) as unknown as typeof model.query

  return () => {
    model.query = originalQuery
  }
}

function stubActiveProjectLookup(project: unknown, calls: Call[], restores: Array<() => void>) {
  const originalProjectQuery = Project.query
  restores.push(() => {
    Project.query = originalProjectQuery
  })

  Project.query = (() => {
    return {
      where(column: string, value: unknown) {
        calls.push({ model: 'Project', method: 'where', args: [column, value] })
        return this
      },
      andWhere(column: string, value: unknown) {
        calls.push({ model: 'Project', method: 'andWhere', args: [column, value] })
        return this
      },
      first() {
        calls.push({ model: 'Project', method: 'first', args: [] })
        return project
      },
    }
  }) as unknown as typeof Project.query
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
        { model: 'ProjectInsightStatus', method: 'first', args: [] },
      ]
    )
    assert.deepEqual(
      calls.filter((call) => call.model === 'ProjectInsight'),
      [
        { model: 'ProjectInsight', method: 'where', args: ['project_uuid', 'project-1'] },
        { model: 'ProjectInsight', method: 'andWhere', args: ['status_id', 11] },
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

test.group('ProjectInsightService.applyExtractedChanges', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubInsightQueries(
    queryResults: Array<{ firstResult?: any; thenResult?: any[] }>,
    calls: Call[]
  ) {
    const originalInsightQuery = ProjectInsight.query
    restores.push(() => {
      ProjectInsight.query = originalInsightQuery
    })

    ProjectInsight.query = (() => {
      const result = queryResults.shift() ?? { thenResult: [] }

      return {
        where(column: string, value: unknown) {
          calls.push({ model: 'ProjectInsight', method: 'where', args: [column, value] })
          return this
        },
        andWhere(column: string, value: unknown) {
          calls.push({ model: 'ProjectInsight', method: 'andWhere', args: [column, value] })
          return this
        },
        first() {
          calls.push({ model: 'ProjectInsight', method: 'first', args: [] })
          return result.firstResult ?? null
        },
        then(resolve: (value: any[]) => void) {
          resolve(result.thenResult ?? [])
        },
      }
    }) as unknown as typeof ProjectInsight.query
  }

  function stubInsightCreate(calls: Call[]) {
    const originalCreate = ProjectInsight.create
    restores.push(() => {
      ProjectInsight.create = originalCreate
    })

    let createCount = 0
    ProjectInsight.create = (async (payload: unknown) => {
      createCount += 1
      const insight = { uuid: `created-${createCount}`, ...(payload as object) }
      calls.push({ model: 'ProjectInsight', method: 'create', args: [insight] })
      return insight
    }) as typeof ProjectInsight.create
  }

  test('creates new insights and skips duplicate active insights', async () => {
    const calls: Call[] = []
    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { PROJECT_FACT: { id: 21, code: 'PROJECT_FACT' } },
        calls
      )
    )
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ACTIVE: { id: 11, code: 'ACTIVE' } }, calls)
    )
    stubInsightQueries(
      [
        { thenResult: [] },
        {
          thenResult: [
            {
              uuid: 'duplicate-insight',
              insightText: 'The project is in Richmond.',
            },
          ],
        },
      ],
      calls
    )
    stubInsightCreate(calls)

    const result = await ProjectInsightService.applyExtractedChanges('project-1', {
      newInsights: [
        {
          insightType: 'project_fact',
          insightText: 'The project is in Richmond.',
        },
        {
          insightType: 'project_fact',
          insightText: '  the   project is in richmond.  ',
        },
      ],
    })

    assert.deepEqual(result, {
      created_count: 1,
      updated_count: 0,
      skipped_count: 1,
    })
    assert.equal(calls.filter((call) => call.method === 'create').length, 1)
  })

  test('applies lifecycle updates and creates a superseding replacement insight', async () => {
    const calls: Call[] = []
    const savedInsights: string[] = []
    const buildExistingInsight = (uuid: string) => ({
      uuid,
      statusId: 11,
      modifiedTimestamp: null,
      supersededByInsightUuid: null,
      async save() {
        savedInsights.push(uuid)
      },
    })
    const archiveInsight = buildExistingInsight('archive-insight')
    const contradictInsight = buildExistingInsight('contradict-insight')
    const supersededInsight = buildExistingInsight('superseded-insight')

    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { PROJECT_CONSTRAINT: { id: 22, code: 'PROJECT_CONSTRAINT' } },
        calls
      )
    )
    restores.push(
      stubReferenceLookup(
        ProjectInsightStatus,
        {
          ACTIVE: { id: 11, code: 'ACTIVE' },
          ARCHIVED: { id: 14, code: 'ARCHIVED' },
          CONTRADICTED: { id: 13, code: 'CONTRADICTED' },
          SUPERSEDED: { id: 12, code: 'SUPERSEDED' },
        },
        calls
      )
    )
    stubInsightQueries(
      [
        { firstResult: null },
        { firstResult: archiveInsight },
        { firstResult: contradictInsight },
        { firstResult: supersededInsight },
        { thenResult: [] },
      ],
      calls
    )
    stubInsightCreate(calls)

    const result = await ProjectInsightService.applyExtractedChanges('project-1', {
      updates: [
        {
          existingInsightUuid: 'missing-insight',
          operation: ProjectInsightStatusCode.Archived,
        },
        {
          existingInsightUuid: 'archive-insight',
          operation: ProjectInsightStatusCode.Archived,
        },
        {
          existingInsightUuid: 'contradict-insight',
          operation: ProjectInsightStatusCode.Contradicted,
        },
        {
          existingInsightUuid: 'superseded-insight',
          operation: ProjectInsightStatusCode.Superseded,
          replacementInsight: {
            insightType: 'project_constraint',
            insightText: 'Budget is now $40,000.',
            importance: 5,
            confidence: 0.96,
          },
        },
      ],
    })

    assert.deepEqual(result, {
      created_count: 1,
      updated_count: 3,
      skipped_count: 1,
    })
    assert.equal(archiveInsight.statusId, 14)
    assert.equal(contradictInsight.statusId, 13)
    assert.equal(supersededInsight.statusId, 12)
    assert.equal(supersededInsight.supersededByInsightUuid, 'created-1')
    assert.deepEqual(savedInsights, ['archive-insight', 'contradict-insight', 'superseded-insight'])
  })

  test('rejects unknown insight types', async () => {
    const calls: Call[] = []
    restores.push(stubReferenceLookup(ProjectInsightType, {}, calls))
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ACTIVE: { id: 11, code: 'ACTIVE' } }, calls)
    )

    await assert.rejects(
      () =>
        ProjectInsightService.applyExtractedChanges('project-1', {
          newInsights: [
            {
              insightType: 'unknown_type',
              insightText: 'Some fact.',
            },
          ],
        }),
      /Unknown insight type: unknown_type/
    )
  })

  test('rejects unknown insight statuses', async () => {
    const calls: Call[] = []
    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { PROJECT_FACT: { id: 21, code: 'PROJECT_FACT' } },
        calls
      )
    )
    restores.push(stubReferenceLookup(ProjectInsightStatus, {}, calls))

    await assert.rejects(
      () =>
        ProjectInsightService.applyExtractedChanges('project-1', {
          newInsights: [
            {
              insightType: 'project_fact',
              insightText: 'Some fact.',
            },
          ],
        }),
      /Unknown insight status: ACTIVE/
    )
  })

  test('normalizes update status codes before lookup', async () => {
    const calls: Call[] = []
    const existingInsight = {
      uuid: 'existing-insight',
      statusId: 11,
      async save() {},
    }
    restores.push(
      stubReferenceLookup(ProjectInsightStatus, { ARCHIVED: { id: 14, code: 'ARCHIVED' } }, calls)
    )
    stubInsightQueries([{ firstResult: existingInsight }], calls)

    const result = await ProjectInsightService.applyExtractedChanges('project-1', {
      updates: [
        {
          existingInsightUuid: 'existing-insight',
          operation: 'archived' as ProjectInsightStatusCode,
        },
      ],
    })

    assert.deepEqual(result, {
      created_count: 0,
      updated_count: 1,
      skipped_count: 0,
    })
    assert.equal(existingInsight.statusId, 14)
    assert.deepEqual(
      calls.filter((call) => call.model === 'ProjectInsightStatus'),
      [
        { model: 'ProjectInsightStatus', method: 'where', args: ['code', 'ARCHIVED'] },
        { model: 'ProjectInsightStatus', method: 'andWhere', args: ['is_active', true] },
        { model: 'ProjectInsightStatus', method: 'first', args: [] },
      ]
    )
  })

  test('returns zero counts for an empty apply payload', async () => {
    const result = await ProjectInsightService.applyExtractedChanges('project-1', {})

    assert.deepEqual(result, {
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
    })
  })

  test('marks an insight as superseded without a replacement insight', async () => {
    const calls: Call[] = []
    const savedInsights: string[] = []
    const existingInsight = {
      uuid: 'existing-insight',
      statusId: 11,
      supersededByInsightUuid: 'previous-replacement',
      async save() {
        savedInsights.push(this.uuid)
      },
    }
    restores.push(
      stubReferenceLookup(
        ProjectInsightStatus,
        { SUPERSEDED: { id: 12, code: 'SUPERSEDED' } },
        calls
      )
    )
    stubInsightQueries([{ firstResult: existingInsight }], calls)

    const result = await ProjectInsightService.applyExtractedChanges('project-1', {
      updates: [
        {
          existingInsightUuid: 'existing-insight',
          operation: ProjectInsightStatusCode.Superseded,
        },
      ],
    })

    assert.deepEqual(result, {
      created_count: 0,
      updated_count: 1,
      skipped_count: 0,
    })
    assert.equal(existingInsight.statusId, 12)
    assert.equal(existingInsight.supersededByInsightUuid, null)
    assert.deepEqual(savedInsights, ['existing-insight'])
  })

  test('uses a duplicate active replacement when superseding an insight', async () => {
    const calls: Call[] = []
    const savedInsights: string[] = []
    const existingInsight = {
      uuid: 'existing-insight',
      statusId: 11,
      supersededByInsightUuid: null,
      async save() {},
    }
    const duplicateReplacement = {
      uuid: 'duplicate-replacement',
      insightText: 'Budget is now $40,000.',
      supersedesInsightUuid: null,
      async save() {
        savedInsights.push(this.uuid)
      },
    }
    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { PROJECT_CONSTRAINT: { id: 22, code: 'PROJECT_CONSTRAINT' } },
        calls
      )
    )
    restores.push(
      stubReferenceLookup(
        ProjectInsightStatus,
        {
          ACTIVE: { id: 11, code: 'ACTIVE' },
          SUPERSEDED: { id: 12, code: 'SUPERSEDED' },
        },
        calls
      )
    )
    stubInsightQueries(
      [{ firstResult: existingInsight }, { thenResult: [duplicateReplacement] }],
      calls
    )
    stubInsightCreate(calls)

    const result = await ProjectInsightService.applyExtractedChanges('project-1', {
      updates: [
        {
          existingInsightUuid: 'existing-insight',
          operation: ProjectInsightStatusCode.Superseded,
          replacementInsight: {
            insightType: 'project_constraint',
            insightText: '  budget   is now $40,000.  ',
          },
        },
      ],
    })

    assert.deepEqual(result, {
      created_count: 0,
      updated_count: 1,
      skipped_count: 1,
    })
    assert.equal(existingInsight.statusId, 12)
    assert.equal(existingInsight.supersededByInsightUuid, 'duplicate-replacement')
    assert.equal(duplicateReplacement.supersedesInsightUuid, 'existing-insight')
    assert.deepEqual(savedInsights, ['duplicate-replacement'])
    assert.equal(calls.filter((call) => call.method === 'create').length, 0)
  })

  test('rejects superseding an insight with itself as the replacement', async () => {
    const calls: Call[] = []
    const existingInsight = {
      uuid: 'existing-insight',
      statusId: 11,
      insightText: 'Budget is now $40,000.',
      supersededByInsightUuid: null,
      async save() {},
    }
    restores.push(
      stubReferenceLookup(
        ProjectInsightType,
        { PROJECT_CONSTRAINT: { id: 22, code: 'PROJECT_CONSTRAINT' } },
        calls
      )
    )
    restores.push(
      stubReferenceLookup(
        ProjectInsightStatus,
        {
          ACTIVE: { id: 11, code: 'ACTIVE' },
          SUPERSEDED: { id: 12, code: 'SUPERSEDED' },
        },
        calls
      )
    )
    stubInsightQueries([{ firstResult: existingInsight }, { thenResult: [existingInsight] }], calls)
    stubInsightCreate(calls)

    await assert.rejects(
      () =>
        ProjectInsightService.applyExtractedChanges('project-1', {
          updates: [
            {
              existingInsightUuid: 'existing-insight',
              operation: ProjectInsightStatusCode.Superseded,
              replacementInsight: {
                insightType: 'project_constraint',
                insightText: '  budget   is now $40,000.  ',
              },
            },
          ],
        }),
      /Superseding replacement insight must differ from existing insight: existing-insight/
    )
    assert.equal(existingInsight.statusId, 11)
    assert.equal(existingInsight.supersededByInsightUuid, null)
    assert.equal(calls.filter((call) => call.method === 'create').length, 0)
  })
})

test.group('ProjectInsightService.ensureActiveProjectExists', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  test('returns the active project', async () => {
    const calls: Call[] = []
    const project = { uuid: 'project-1' }
    stubActiveProjectLookup(project, calls, restores)

    const result = await ProjectInsightService.ensureActiveProjectExists('project-1')

    assert.equal(result, project)
    assert.deepEqual(calls, [
      { model: 'Project', method: 'where', args: ['uuid', 'project-1'] },
      { model: 'Project', method: 'andWhere', args: ['is_active', true] },
      { model: 'Project', method: 'first', args: [] },
    ])
  })

  test('rejects missing or inactive projects', async () => {
    const calls: Call[] = []
    stubActiveProjectLookup(null, calls, restores)

    await assert.rejects(
      () => ProjectInsightService.ensureActiveProjectExists('project-1'),
      /Project not found: project-1/
    )

    assert.deepEqual(calls, [
      { model: 'Project', method: 'where', args: ['uuid', 'project-1'] },
      { model: 'Project', method: 'andWhere', args: ['is_active', true] },
      { model: 'Project', method: 'first', args: [] },
    ])
  })
})
