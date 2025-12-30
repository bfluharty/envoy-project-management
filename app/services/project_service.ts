import Project from '#models/project'
import { ProjectRequest } from '../../types/project_request.js'

export default class ProjectService {
  public static async createProject(data: ProjectRequest) {
    return Project.create(data)
  }
}
