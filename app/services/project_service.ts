import Project from '#models/project'
import { ProjectRequest } from '../../types/request.js'

export default class ProjectService {
  private static readonly DEFAULT_PROJECT_LIMIT = 10
  private static readonly DEFAULT_PROJECT_OFFSET = 0

  public static async getUserProjects(userUuid: string, limit?: number, offset?: number) {
    return await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('is_active', true)
      .orderBy('created_timestamp', 'desc')
      .limit(limit ?? this.DEFAULT_PROJECT_LIMIT)
      .offset(offset ?? this.DEFAULT_PROJECT_OFFSET)
  }

  public static async getUserProjectByUuid(userUuid: string, projectUuid: string) {
    return await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', projectUuid)
      .andWhere('is_active', true)
      .first()
  }

  public static createProject(userUuid: string, request: ProjectRequest) {
    return Project.create(this.mapRequest(request, userUuid))
  }

  public static async updateProject(
    userUuid: string,
    projectUuid: string,
    request: Partial<ProjectRequest>,
    isOnlyActivatingRecord: boolean
  ) {
    let query = Project.query().where('user_uuid', userUuid).andWhere('uuid', projectUuid)
    if (!isOnlyActivatingRecord) {
      query = query.andWhere('is_active', true)
    }
    const project = await query.first()

    if (!project) {
      return null
    }
    await project.merge(this.mapRequest(request)).save()

    return await Project.query().where('user_uuid', userUuid).andWhere('uuid', projectUuid).first()
  }

  private static mapRequest(request: Partial<ProjectRequest>, userUuid?: string) {
    return {
      title: request.title,
      description: request.description,
      location: request.location,
      startDate: request.startDate,
      endDate: request.endDate,
      deadline: request.deadline,
      budgetAmount: request.budgetAmount,
      budgetCurrencyId: request.budgetCurrency,
      goals: request.goals,
      userUuid: userUuid,
      isActive: request.isActive ?? true,
    }
  }
}
