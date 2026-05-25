import { DateTime } from 'luxon'
import { Turn } from './turn.js'

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

export interface ReasoningRequest {
  agentId: string
  prompt: string
  variables: Variables
  pastConversationTurns: Turn[]
  projectUuid: string
  projectContext: ProjectContext
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

export type CreateProjectInsightInput = {
  insightType: string
  insightStatus: string
  insightText: string
  importance?: number
  confidence?: number | null
  supersedesInsightUuid?: string | null
}
