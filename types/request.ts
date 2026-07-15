import { DateTime } from 'luxon'

export type AgentId = 'INTAKE' | 'PLANNING' | 'OUTREACH'
export type PlanningStatus = 'COLLECTING_DETAILS' | 'AWAITING_FINAL_DETAILS' | 'READY_FOR_OUTREACH'

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
  vendors?: {
    uuid?: string
    name: string
    email?: string | null
    contactName?: string | null
    contactRole?: string | null
    category?: string | null
    website?: string | null
    notes?: string | null
  }[]
  existingDrafts?: { draftUuid: string; vendorEmail: string | null; subject: string }[]
  details?: Record<string, unknown>
}

export interface ReasoningProjectInsight {
  uuid: string
  type: string
  text: string
  importance: number
  confidence: number | null
}

export interface ReasoningRecentTurn {
  agentId: AgentId
  planningStatus?: PlanningStatus
  userPrompt: string
  modelResponse: string
  timestamp: string
}

export interface StakeholderDetails {
  name: string
}

export interface ReasoningRequest {
  agentId: AgentId
  planningStatus?: PlanningStatus
  promptData?: Record<string, unknown>
  stakeholderDetails?: StakeholderDetails
  projectContext?: ProjectContext
  projectInsights?: ReasoningProjectInsight[]
  recentTurns?: ReasoningRecentTurn[]
}

export interface ReasoningAgentResponse {
  agentId: AgentId
  planningStatus?: PlanningStatus
  message: string | null
  data: Record<string, unknown> | null
  readyForNextStep: boolean
  missingFields: string[]
  turn: import('./turn.js').Turn
}

export interface VendorRequest {
  name?: string
  email?: string
  createdBy?: string
  modifiedBy?: string
  isActive?: boolean
}
