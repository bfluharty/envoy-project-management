import type { AgentId, PlanningStatus } from './request.js'

export interface Turn {
  agentId: AgentId
  planningStatus?: PlanningStatus
  userPrompt: string
  modelResponse: string
  timestamp: string
}
