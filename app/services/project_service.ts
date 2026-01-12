import Project from '#models/project'
import { ProjectRequest } from '../../types/request.js'

export default class ProjectService {
  public static async createProject(request: ProjectRequest) {
    const data: any = request
    data.budgetCurrency = null
    return Project.create(data)
  }
}
