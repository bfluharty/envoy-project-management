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

export interface ReasoningRequest {
  agentId: string
  prompt: string
  variables: Variables
  pastConversationTurns: Turn[]
}

export interface Variables {
  context?: string
}

export interface VendorRequest {
  name?: string
  email?: string
  createdBy?: string
  modifiedBy?: string
  isActive?: boolean
}
