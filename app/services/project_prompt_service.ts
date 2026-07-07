import ProjectPrompt, { type ProjectPromptAgentType } from '#models/project_prompt'
import type { SaveProjectPromptDataInput } from '../../types/project_prompt.js'

export class ProjectPromptValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectPromptValidationError'
  }
}

export default class ProjectPromptService {
  private static readonly VALID_AGENT_TYPES = new Set<ProjectPromptAgentType>([
    'PLANNING',
    'OUTREACH',
  ])

  public static async getLatestPrompt(
    projectUuid: string,
    agentType: ProjectPromptAgentType
  ): Promise<ProjectPrompt | null> {
    const normalized = this.normalizeAgentType(agentType)

    return ProjectPrompt.query()
      .where('project_uuid', projectUuid)
      .andWhere('agent_type', normalized)
      .orderBy('modified_timestamp', 'desc')
      .orderBy('id', 'desc')
      .first()
  }

  public static async getLatestPromptData(
    projectUuid: string,
    agentType: ProjectPromptAgentType
  ): Promise<Record<string, unknown> | null> {
    const latest = await this.getLatestPrompt(projectUuid, agentType)
    return latest?.data ?? null
  }

  public static async savePromptData(input: SaveProjectPromptDataInput): Promise<ProjectPrompt> {
    const agentType = this.normalizeAgentType(input.agentType)
    const data = this.normalizeData(input.data)
    const existing = await this.getLatestPrompt(input.projectUuid, agentType)

    if (existing) {
      existing.data = data
      existing.modifiedByUserUuid = input.userUuid ?? existing.modifiedByUserUuid ?? null
      await existing.save()
      return existing
    }

    return ProjectPrompt.create({
      projectUuid: input.projectUuid,
      agentType,
      data,
      createdByUserUuid: input.userUuid ?? null,
      modifiedByUserUuid: input.userUuid ?? null,
    })
  }

  private static normalizeAgentType(agentType: ProjectPromptAgentType): ProjectPromptAgentType {
    const normalized = String(agentType).trim().toUpperCase() as ProjectPromptAgentType

    if (!this.VALID_AGENT_TYPES.has(normalized)) {
      throw new ProjectPromptValidationError(`Unsupported project prompt agent type: ${agentType}`)
    }

    return normalized
  }

  private static normalizeData(data: Record<string, unknown>): Record<string, unknown> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ProjectPromptValidationError('Project prompt data must be an object.')
    }

    return data
  }
}
