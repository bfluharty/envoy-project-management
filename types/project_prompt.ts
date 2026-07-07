import type { ProjectPromptAgentType } from '#models/project_prompt'

export interface SaveProjectPromptDataInput {
  projectUuid: string
  agentType: ProjectPromptAgentType
  data: Record<string, unknown>
  userUuid?: string | null
}

export interface ProjectPromptDataResult {
  projectUuid: string
  agentType: ProjectPromptAgentType
  data: Record<string, unknown>
}
