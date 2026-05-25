export enum ProjectInsightStatusCode {
  Active = 'ACTIVE',
  Superseded = 'SUPERSEDED',
  Contradicted = 'CONTRADICTED',
  Archived = 'ARCHIVED',
}

export type ProjectInsightInput = {
  insightType: string
  insightText: string
  importance?: number
  confidence?: number | null
  supersedesInsightUuid?: string | null
}

export type ProjectInsightUpdateInput = {
  existingInsightUuid: string
  operation: string
  replacementInsight?: ProjectInsightInput
}

export type ApplyProjectInsightChangesInput = {
  newInsights?: ProjectInsightInput[]
  updates?: ProjectInsightUpdateInput[]
}

export type ApplyProjectInsightChangesResult = {
  created_count: number
  updated_count: number
  skipped_count: number
}
