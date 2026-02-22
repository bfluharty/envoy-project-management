import Project from '#models/project'
import logger from '@adonisjs/core/services/logger'
import { ProjectRequest } from '../../types/request.js'
import { Turn } from '../../types/turn.js'
import ConversationTurn from '#models/conversation_turn'
import ProjectVendor from '#models/project_vendor'
import Currency from '#models/currency'

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

  public static async createProject(userUuid: string, request: ProjectRequest) {
    const mappedRequest = await this.mapRequest(request, userUuid)
    return Project.create(mappedRequest)
  }

  public static async updateProject(
    userUuid: string,
    projectUuid: string,
    request: Partial<ProjectRequest>,
    isOnlyActivatingRecord: boolean = false
  ) {
    let query = Project.query().where('user_uuid', userUuid).andWhere('uuid', projectUuid)

    if (!isOnlyActivatingRecord) {
      query = query.andWhere('is_active', true)
    }

    const project = await query.first()

    if (!project) {
      return null
    }

    const mappedRequest = await this.mapRequest(request)
    await project.merge(mappedRequest).save()

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

  private static async mapRequest(request: Partial<ProjectRequest>, userUuid?: string) {
    let budgetCurrencyId: number | undefined
    if (request.budgetCurrency) {
      budgetCurrencyId = await this.resolveCurrencyId(request.budgetCurrency)
    }

    return {
      title: request.title,
      description: request.description,
      location: request.location,
      startDate: request.startDate,
      endDate: request.endDate,
      deadline: request.deadline,
      budgetAmount: request.budgetAmount,
      budgetCurrencyId,
      goals: request.goals,
      userUuid: userUuid,
      isActive: request.isActive ?? true,
    }
  }

  private static async resolveCurrencyId(currencyCode: string): Promise<number> {
    const currency = await Currency.query()
      .where('code', currencyCode)
      .andWhere('is_active', true)
      .first()

    if (!currency) {
      throw new Error(
        `Invalid currency code: ${currencyCode}. Please use a valid active currency code.`
      )
    }

    return currency.id
  }
}
