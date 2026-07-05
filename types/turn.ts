import type { AgentId } from './request.js'

export interface ActionExecution {
  action: string
  timestamp: Date
  success: boolean
  data?: any
  error?: string
}

export interface Turn {
  agentId: AgentId
  userPrompt: string
  modelResponse: string
  timestamp: string
  topic?: string
  actionExecutions?: ActionExecution[]
}
