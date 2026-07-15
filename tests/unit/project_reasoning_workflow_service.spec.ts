import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import Project from '#models/project'
import ProjectPromptService from '#services/project_prompt_service'
import ProjectReasoningWorkflowService, {
  ProjectReasoningWorkflowError,
} from '#services/project_reasoning_workflow_service'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'

type Call = {
  service: string
  method: string
  args: unknown[]
}

test.group('ProjectReasoningWorkflowService', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  function stubLatestPromptData(sequence: Array<Record<string, unknown> | null>, calls: Call[]) {
    const original = ProjectPromptService.getLatestPromptData
    restores.push(() => {
      ProjectPromptService.getLatestPromptData = original
    })

    ProjectPromptService.getLatestPromptData = (async (projectUuid: string, agentType: any) => {
      calls.push({
        service: 'ProjectPromptService',
        method: 'getLatestPromptData',
        args: [projectUuid, agentType],
      })
      return sequence.shift() ?? null
    }) as typeof ProjectPromptService.getLatestPromptData
  }

  function stubRunIntakeForProject(
    result: Awaited<ReturnType<typeof ProjectReasoningWorkflowService.runIntakeForProject>>,
    calls: Call[]
  ) {
    const original = ProjectReasoningWorkflowService.runIntakeForProject
    restores.push(() => {
      ProjectReasoningWorkflowService.runIntakeForProject = original
    })

    ProjectReasoningWorkflowService.runIntakeForProject = (async (
      projectUuid: string,
      userUuid: string
    ) => {
      calls.push({
        service: 'ProjectReasoningWorkflowService',
        method: 'runIntakeForProject',
        args: [projectUuid, userUuid],
      })
      return result
    }) as typeof ProjectReasoningWorkflowService.runIntakeForProject
  }

  function stubProjectQuery(project: unknown, calls: Call[]) {
    const original = Project.query
    restores.push(() => {
      Project.query = original
    })

    Project.query = (() => {
      return {
        where(column: string, value: unknown) {
          calls.push({ service: 'Project', method: 'where', args: [column, value] })
          return this
        },
        first() {
          calls.push({ service: 'Project', method: 'first', args: [] })
          return project
        },
      }
    }) as unknown as typeof Project.query
  }

  function stubBuildProjectContext(calls: Call[]) {
    const original = ReasoningRequestContextService.buildProjectContext
    restores.push(() => {
      ReasoningRequestContextService.buildProjectContext = original
    })

    ReasoningRequestContextService.buildProjectContext = (async (project: any, options?: any) => {
      calls.push({
        service: 'ReasoningRequestContextService',
        method: 'buildProjectContext',
        args: [project.uuid, options],
      })
      return {
        uuid: project.uuid,
        name: project.title,
        description: options?.descriptionFallback ?? project.description ?? null,
      }
    }) as typeof ReasoningRequestContextService.buildProjectContext
  }

  function stubRequestAgent(responses: Array<unknown>, calls: Call[]) {
    const original = ReasoningEngineService.requestAgent
    restores.push(() => {
      ReasoningEngineService.requestAgent = original
    })

    ReasoningEngineService.requestAgent = (async (request: any) => {
      calls.push({
        service: 'ReasoningEngineService',
        method: 'requestAgent',
        args: [request],
      })
      const response = responses.shift()
      if (response instanceof Error) {
        throw response
      }
      return response
    }) as typeof ReasoningEngineService.requestAgent
  }

  function stubSavePromptData(calls: Call[]) {
    const original = ProjectPromptService.savePromptData
    restores.push(() => {
      ProjectPromptService.savePromptData = original
    })

    ProjectPromptService.savePromptData = (async (payload: any) => {
      calls.push({
        service: 'ProjectPromptService',
        method: 'savePromptData',
        args: [payload],
      })
      return payload
    }) as typeof ProjectPromptService.savePromptData
  }

  test('buildPlanningRequest includes prompt data, stakeholder details, project context, insights, and turns', () => {
    const request = ProjectReasoningWorkflowService.buildPlanningRequest({
      project: { uuid: 'project-1' } as Project,
      user: { fullName: '  Alice Example  ' } as any,
      prompt: 'What should we ask vendors?',
      promptData: {
        planningAgent: {
          title: 'Planning PM',
        },
      },
      context: {
        planningStatus: 'AWAITING_FINAL_DETAILS',
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
            agentId: 'PLANNING',
            userPrompt: 'Earlier',
            modelResponse: 'Response',
            timestamp: '2026-07-05T12:00:00.000Z',
          },
        ],
      },
      projectContext: {
        uuid: 'project-1',
        name: 'Office Renovation',
      },
    })

    assert.deepEqual(request, {
      agentId: 'PLANNING',
      planningStatus: 'AWAITING_FINAL_DETAILS',
      promptData: {
        prompt: 'What should we ask vendors?',
        planningAgent: {
          title: 'Planning PM',
        },
      },
      stakeholderDetails: { name: 'Alice Example' },
      projectContext: {
        uuid: 'project-1',
        name: 'Office Renovation',
      },
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
          agentId: 'PLANNING',
          userPrompt: 'Earlier',
          modelResponse: 'Response',
          timestamp: '2026-07-05T12:00:00.000Z',
        },
      ],
    })
  })

  test('ensurePlanningPromptData returns existing prompt data without running intake', async () => {
    const calls: Call[] = []
    const promptData = { planningAgent: { title: 'Existing PM' } }
    stubLatestPromptData([promptData], calls)
    stubRunIntakeForProject({ success: true }, calls)

    const result = await ProjectReasoningWorkflowService.ensurePlanningPromptData(
      { uuid: 'project-1' } as Project,
      'user-1'
    )

    assert.equal(result, promptData)
    assert.deepEqual(calls, [
      {
        service: 'ProjectPromptService',
        method: 'getLatestPromptData',
        args: ['project-1', 'PLANNING'],
      },
    ])
  })

  test('ensurePlanningPromptData runs intake when prompt data is missing and returns the created data', async () => {
    const calls: Call[] = []
    const createdPromptData = { planningAgent: { title: 'Created PM' } }
    stubLatestPromptData([null, createdPromptData], calls)
    stubRunIntakeForProject({ success: true }, calls)

    const result = await ProjectReasoningWorkflowService.ensurePlanningPromptData(
      { uuid: 'project-1' } as Project,
      'user-1'
    )

    assert.equal(result, createdPromptData)
    assert.deepEqual(calls, [
      {
        service: 'ProjectPromptService',
        method: 'getLatestPromptData',
        args: ['project-1', 'PLANNING'],
      },
      {
        service: 'ProjectReasoningWorkflowService',
        method: 'runIntakeForProject',
        args: ['project-1', 'user-1'],
      },
      {
        service: 'ProjectPromptService',
        method: 'getLatestPromptData',
        args: ['project-1', 'PLANNING'],
      },
    ])
  })

  test('ensurePlanningPromptData throws when intake cannot create prompt data', async () => {
    const calls: Call[] = []
    stubLatestPromptData([null], calls)
    stubRunIntakeForProject({ success: false, error: 'Reasoning unavailable' }, calls)

    await assert.rejects(
      () =>
        ProjectReasoningWorkflowService.ensurePlanningPromptData(
          { uuid: 'project-1' } as Project,
          'user-1'
        ),
      (error: Error) =>
        error instanceof ProjectReasoningWorkflowError && error.message === 'Reasoning unavailable'
    )
  })

  test('runIntakeForProject retries once, omits promptData, and saves returned planning data', async () => {
    const calls: Call[] = []
    const project = {
      uuid: 'project-1',
      title: 'Office Renovation',
      description: null,
    }
    const planningData = {
      planningAgent: {
        title: 'Office Planning PM',
      },
    }
    stubProjectQuery(project, calls)
    stubBuildProjectContext(calls)
    stubRequestAgent(
      [
        new Error('temporary reasoning failure'),
        {
          agentId: 'INTAKE',
          message: null,
          data: planningData,
          readyForNextStep: true,
          missingFields: [],
          turn: {
            agentId: 'INTAKE',
            userPrompt: 'Office Renovation',
            modelResponse: JSON.stringify(planningData),
            timestamp: '2026-07-05T12:00:00.000Z',
          },
        },
      ],
      calls
    )
    stubSavePromptData(calls)

    const result = await ProjectReasoningWorkflowService.runIntakeForProject('project-1', 'user-1')

    assert.deepEqual(result, { success: true })
    const requestAgentCalls = calls.filter((call) => call.method === 'requestAgent')
    assert.equal(requestAgentCalls.length, 2)
    assert.deepEqual(requestAgentCalls[0].args[0], {
      agentId: 'INTAKE',
      projectContext: {
        uuid: 'project-1',
        name: 'Office Renovation',
        description: 'N/A',
      },
    })
    assert.equal('promptData' in (requestAgentCalls[0].args[0] as any), false)
    assert.deepEqual(calls.find((call) => call.method === 'savePromptData')?.args[0], {
      projectUuid: 'project-1',
      agentType: 'PLANNING',
      data: planningData,
      userUuid: 'user-1',
    })
  })

  test('runIntakeForProject returns controlled failures for missing project and empty intake data', async () => {
    const missingProjectCalls: Call[] = []
    stubProjectQuery(null, missingProjectCalls)

    const missingProject = await ProjectReasoningWorkflowService.runIntakeForProject(
      'project-1',
      'user-1'
    )

    assert.deepEqual(missingProject, { success: false, error: 'Project not found' })

    while (restores.length) {
      restores.pop()?.()
    }

    const emptyDataCalls: Call[] = []
    stubProjectQuery({ uuid: 'project-1', title: 'Office Renovation' }, emptyDataCalls)
    stubBuildProjectContext(emptyDataCalls)
    stubRequestAgent(
      [
        {
          agentId: 'INTAKE',
          message: null,
          data: null,
          readyForNextStep: true,
          missingFields: [],
          turn: {
            agentId: 'INTAKE',
            userPrompt: 'Office Renovation',
            modelResponse: '{}',
            timestamp: '2026-07-05T12:00:00.000Z',
          },
        },
      ],
      emptyDataCalls
    )

    const emptyData = await ProjectReasoningWorkflowService.runIntakeForProject(
      'project-1',
      'user-1'
    )

    assert.deepEqual(emptyData, {
      success: false,
      error: 'Intake did not return planning prompt data',
    })
  })
})
