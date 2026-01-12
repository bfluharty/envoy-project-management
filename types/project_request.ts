import { DateTime } from 'luxon'

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
}
