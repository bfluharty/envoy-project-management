import Project from '#models/project'

export interface ReasoningResponse {
  statusCode: string
  body: string
  headers: Record<string, string>
}

export interface GetAllProjectsResponse {
  projects: Project[]
  count: number
  limit: number
  offset: number
}

export interface GetProjectResponse {
  project: Project
}
