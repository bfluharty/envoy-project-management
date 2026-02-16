import Project from '#models/project'
import logger from '@adonisjs/core/services/logger'
import { ProjectRequest } from '../../types/request.js'
import { Turn } from '../../types/turn.js'
import ConversationTurn from '#models/conversation_turn'
import ProjectVendor from '#models/project_vendor'

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
    const project = await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', projectUuid)
      .andWhere('is_active', true)
      .first()

    if (!project) {
      return null
    }

    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .preload('vendor')

    const combinedProject = project.toJSON()
    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return combinedProject
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

  public static async getProjectWithConversations(userUuid: string, projectUuid: string) {
    const project = await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', projectUuid)
      .andWhere('is_active', true)
      .preload('conversations', (conversationQuery) => {
        conversationQuery.preload('conversationTurns')
      })
      .first()

    if (!project) {
      throw new Error('Project not found')
    }

    if (!project.conversations?.length) {
      logger.info('No conversations found for project, creating a new one.')
      await project.related('conversations').create({ projectUuid: project.uuid })
      await project.load('conversations')
    }

    return project
  }

  public static async saveConversationTurn(conversationUuid: string, turn: Turn) {
    await ConversationTurn.create({
      conversationUuid: conversationUuid,
      contents: turn,
    })
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
