import Project from '#models/project'
import { ProjectRequest } from '../../types/request.js'

export default class ProjectService {
  public static async createProject(request: ProjectRequest) {
    const data: any = {
      title: request.title,
      description: request.description,
      location: request.location,
      startDate: request.startDate,
      endDate: request.endDate,
      deadline: request.deadline,
      budgetAmount: request.budgetAmount,
      budgetCurrencyId: request.budgetCurrency,
      goals: request.goals,
      userUuid: request.userUuid,
      isActive: request.isActive ?? true,
    }

    return Project.create(data)
  }
}
