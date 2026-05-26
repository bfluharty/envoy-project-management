import { DateTime } from 'luxon'

export interface ProjectRequest {
  title?: string
  description?: string
  location?: any
  startDate?: DateTime
  endDate?: DateTime
  deadline?: DateTime
  budgetAmount?: number
  budgetCurrency?: string
  goals?: string
  isActive?: boolean
  vendors?: string[]
}

export interface ProjectContext {
  uuid: string
  name: string
  description?: string | null
  location?: any
  startDate?: string | null
  endDate?: string | null
  deadline?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  goals?: string | null
  vendors?: { name: string; email?: string | null }[]
}

export interface ReasoningProjectInsight {
  uuid: string
  type: string
  text: string
  importance: number
  confidence: number | null
}

export interface ReasoningActionMetadata {
  action: string
  success: boolean
  error?: string | null
}

export interface ReasoningRecentTurn {
  user_message: string
  assistant_response: string
  action_metadata: ReasoningActionMetadata[]
}

export interface ReasoningRequest {
  agentId: string
  prompt: string
  variables: Variables
  projectUuid: string
  projectContext: ProjectContext
  projectInsights: ReasoningProjectInsight[]
  recentTurns: ReasoningRecentTurn[]
}

export interface Variables {
  context?: string
  assistantGreeting?: string
}

export interface VendorRequest {
  name?: string
  email?: string
  createdBy?: string
  modifiedBy?: string
  isActive?: boolean
}
