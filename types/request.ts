import { DateTime } from 'luxon'
import { Turn } from './turn.js'

export interface ProjectRequest {
  title: string
  description?: string
  location?: any
  startDate?: DateTime
  endDate?: DateTime
  deadline?: DateTime
  budgetAmount?: number
  budgetCurrency?: number
  goals?: string
  isActive?: boolean
  vendors?: ProjectVendorRequest
}

export interface ProjectVendorRequest {
  toAddVendorIds?: string[]
  toRemoveVendorIds?: string[]
}

export interface ReasoningRequest {
  agentId: string
  prompt: string
  variables: Variables
  pastConversationTurns: Turn[]
}

export interface Variables {
  context?: string
}
