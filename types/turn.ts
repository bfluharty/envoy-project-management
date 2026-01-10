export interface ActionExecution {
  action: string
  timestamp: Date
  success: boolean
  data?: any
  error?: string
}

export interface Turn {
  userPrompt: string
  topic: string
  actionExecutions: ActionExecution[]
  modelResponse: string
  timestamp: Date
}
