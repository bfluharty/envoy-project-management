import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import ProjectPrompt from '#models/project_prompt'
import ProjectPromptService, {
  ProjectPromptValidationError,
} from '#services/project_prompt_service'

type Call = {
  model: string
  method: string
  args: unknown[]
}

test.group('ProjectPromptService', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubPromptQuery(result: unknown, calls: Call[]) {
    const originalQuery = ProjectPrompt.query
    restores.push(() => {
      ProjectPrompt.query = originalQuery
    })

    ProjectPrompt.query = (() => {
      return {
        where(column: string, value: unknown) {
          calls.push({ model: 'ProjectPrompt', method: 'where', args: [column, value] })
          return this
        },
        andWhere(column: string, value: unknown) {
          calls.push({ model: 'ProjectPrompt', method: 'andWhere', args: [column, value] })
          return this
        },
        orderBy(column: string, direction: string) {
          calls.push({ model: 'ProjectPrompt', method: 'orderBy', args: [column, direction] })
          return this
        },
        first() {
          calls.push({ model: 'ProjectPrompt', method: 'first', args: [] })
          return result
        },
      }
    }) as unknown as typeof ProjectPrompt.query
  }

  function stubPromptCreate(calls: Call[]) {
    const originalCreate = ProjectPrompt.create
    restores.push(() => {
      ProjectPrompt.create = originalCreate
    })

    ProjectPrompt.create = (async (payload: unknown) => {
      calls.push({ model: 'ProjectPrompt', method: 'create', args: [payload] })
      return { uuid: 'created-prompt', ...(payload as object) }
    }) as typeof ProjectPrompt.create
  }

  test('gets the latest prompt by project and agent ordered by modified timestamp then id', async () => {
    const calls: Call[] = []
    const prompt = {
      projectUuid: 'project-1',
      agentType: 'PLANNING',
      data: { planningAgent: { title: 'PM' } },
    }
    stubPromptQuery(prompt, calls)

    const result = await ProjectPromptService.getLatestPrompt('project-1', 'PLANNING')

    assert.equal(result, prompt)
    assert.deepEqual(calls, [
      { model: 'ProjectPrompt', method: 'where', args: ['project_uuid', 'project-1'] },
      { model: 'ProjectPrompt', method: 'andWhere', args: ['agent_type', 'PLANNING'] },
      { model: 'ProjectPrompt', method: 'orderBy', args: ['modified_timestamp', 'desc'] },
      { model: 'ProjectPrompt', method: 'orderBy', args: ['id', 'desc'] },
      { model: 'ProjectPrompt', method: 'first', args: [] },
    ])
  })

  test('returns only prompt data for getLatestPromptData', async () => {
    const calls: Call[] = []
    stubPromptQuery({ data: { outreachAgent: { title: 'Outreach' } } }, calls)

    const result = await ProjectPromptService.getLatestPromptData('project-1', 'OUTREACH')

    assert.deepEqual(result, { outreachAgent: { title: 'Outreach' } })
  })

  test('updates the latest prompt row when one exists', async () => {
    const calls: Call[] = []
    const saves: Array<Record<string, unknown>> = []
    const existing = {
      projectUuid: 'project-1',
      agentType: 'PLANNING',
      data: { old: true },
      modifiedByUserUuid: null as string | null,
      async save() {
        saves.push({
          data: this.data,
          modifiedByUserUuid: this.modifiedByUserUuid,
        })
      },
    }
    stubPromptQuery(existing, calls)
    stubPromptCreate(calls)

    const result = await ProjectPromptService.savePromptData({
      projectUuid: 'project-1',
      agentType: 'PLANNING',
      data: { planningAgent: { title: 'Updated PM' } },
      userUuid: 'user-1',
    })

    assert.equal(result, existing)
    assert.deepEqual(saves, [
      {
        data: { planningAgent: { title: 'Updated PM' } },
        modifiedByUserUuid: 'user-1',
      },
    ])
    assert.equal(
      calls.some((call) => call.method === 'create'),
      false
    )
  })

  test('creates a prompt row when none exists', async () => {
    const calls: Call[] = []
    stubPromptQuery(null, calls)
    stubPromptCreate(calls)

    const result = await ProjectPromptService.savePromptData({
      projectUuid: 'project-1',
      agentType: 'OUTREACH',
      data: { outreachAgent: { title: 'Outreach' } },
      userUuid: 'user-1',
    })

    assert.deepEqual(result, {
      uuid: 'created-prompt',
      projectUuid: 'project-1',
      agentType: 'OUTREACH',
      data: { outreachAgent: { title: 'Outreach' } },
      createdByUserUuid: 'user-1',
      modifiedByUserUuid: 'user-1',
    })
    assert.deepEqual(calls.find((call) => call.method === 'create')?.args, [
      {
        projectUuid: 'project-1',
        agentType: 'OUTREACH',
        data: { outreachAgent: { title: 'Outreach' } },
        createdByUserUuid: 'user-1',
        modifiedByUserUuid: 'user-1',
      },
    ])
  })

  test('rejects unsupported agent types and non-object prompt data', async () => {
    await assert.rejects(
      () =>
        ProjectPromptService.savePromptData({
          projectUuid: 'project-1',
          agentType: 'INTAKE' as any,
          data: {},
        }),
      ProjectPromptValidationError
    )

    await assert.rejects(
      () =>
        ProjectPromptService.savePromptData({
          projectUuid: 'project-1',
          agentType: 'PLANNING',
          data: [] as any,
        }),
      /Project prompt data must be an object/
    )
  })
})
