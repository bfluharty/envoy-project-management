export interface ProjectRequest {
  title: string
  description?: string
  location?: any
  startDate?: string
  endDate?: string
  deadline?: string
  budgetAmount?: number
  budgetCurrency?: string
  goals?: string
  isActive?: boolean
}
