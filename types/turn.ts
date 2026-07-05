import type { AgentId } from './request.js'

export interface Turn {
  agentId: AgentId
  userPrompt: string
  modelResponse: string
  timestamp: string
}
