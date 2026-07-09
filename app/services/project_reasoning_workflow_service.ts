import logger from '@adonisjs/core/services/logger'
import Project from '#models/project'
import ProjectPromptService from '#services/project_prompt_service'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import type User from '#models/user'
import type { ReasoningRequest } from '../../types/request.js'

export interface ProjectReasoningWorkflowResult {
  success: boolean
  error?: string
}

export class ProjectReasoningWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectReasoningWorkflowError'
  }
}

export default class ProjectReasoningWorkflowService {
  public static async runIntakeForProject(
    projectUuid: string,
    userUuid: string
  ): Promise<ProjectReasoningWorkflowResult> {
    try {
      await this.runIntakeForProjectOrFail(projectUuid, userUuid)
      return { success: true }
    } catch (error) {
      const message = this.getErrorMessage(error, 'Failed to generate project planning prompt data')
      logger.warn({ err: error, projectUuid, userUuid }, 'Project intake failed after retry')
      return { success: false, error: message }
    }
  }

  public static async ensurePlanningPromptData(
    project: Project,
    userUuid: string
  ): Promise<Record<string, unknown>> {
    const existing = await ProjectPromptService.getLatestPromptData(project.uuid, 'PLANNING')
    if (existing) {
      return existing
    }

    const result = await this.runIntakeForProject(project.uuid, userUuid)
    if (!result.success) {
      throw new ProjectReasoningWorkflowError(result.error ?? 'Planning prompt data is missing')
    }

    const created = await ProjectPromptService.getLatestPromptData(project.uuid, 'PLANNING')
    if (!created) {
      throw new ProjectReasoningWorkflowError('Planning prompt data is missing')
    }

    return created
  }

  public static buildPlanningRequest(input: {
    project: Project
    user: Pick<User, 'fullName'>
    prompt: string
    promptData: Record<string, unknown>
    context: Awaited<ReturnType<typeof ReasoningRequestContextService.buildContext>>
    projectContext: Awaited<ReturnType<typeof ReasoningRequestContextService.buildProjectContext>>
  }): ReasoningRequest {
    return {
      agentId: 'PLANNING',
      promptData: {
        prompt: input.prompt,
        ...input.promptData,
      },
      stakeholderDetails: ReasoningRequestContextService.getStakeholderDetails(input.user),
      projectContext: input.projectContext,
      ...input.context,
    }
  }

  private static async runIntakeForProjectOrFail(projectUuid: string, userUuid: string) {
    const project = await Project.query()
      .where('uuid', projectUuid)
      .where('user_uuid', userUuid)
      .where('is_active', true)
      .first()

    if (!project) {
      throw new ProjectReasoningWorkflowError('Project not found')
    }

    const projectContext = await ReasoningRequestContextService.buildProjectContext(project, {
      descriptionFallback: 'N/A',
    })
    const request: ReasoningRequest = {
      agentId: 'INTAKE',
      projectContext,
    }
    const response = await this.retryOnce(() => ReasoningEngineService.requestAgent(request))

    if (!response.data) {
      throw new ProjectReasoningWorkflowError('Intake did not return planning prompt data')
    }

    await ProjectPromptService.savePromptData({
      projectUuid,
      agentType: 'PLANNING',
      data: response.data,
      userUuid,
    })
  }

  private static async retryOnce<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (firstError) {
      logger.warn({ err: firstError }, 'Project reasoning operation failed; retrying')
      return operation()
    }
  }

  private static getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim()
    }

    return fallback
  }
}
