import Project from '#models/project'
import logger from '@adonisjs/core/services/logger'
import { ProjectRequest } from '../../types/request.js'
import { Turn } from '../../types/turn.js'
import ConversationTurn from '#models/conversation_turn'
import ProjectVendor from '#models/project_vendor'
import Vendor from '#models/vendor'
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
      .preload('budgetCurrency')
      .first()

    if (!project) {
      return null
    }

    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .andWhere('is_active', true)
      .preload('vendor', (q) => q.preload('vendorListing'))

    const combinedProject = project.toJSON()
    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return combinedProject
  }

  public static async createProject(userUuid: string, request: ProjectRequest) {
    const mappedRequest = await this.mapRequest(request, userUuid)
    const project = await Project.create(mappedRequest)
    await project.load('budgetCurrency')
    const errors = await this.handleVendorUpdates(project.uuid, userUuid, request.vendors)
    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', project.uuid)
      .andWhere('is_active', true)
      .preload('vendor', (q) => q.preload('vendorListing'))

    const combinedProject = project.toJSON()
    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return { combinedProject, errors }
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
      return { project, errors: [] }
    }

    const mappedRequest = await this.mapRequest(request)
    await project.merge(mappedRequest).save()

    const errors = await this.handleVendorUpdates(projectUuid, userUuid, request.vendors)

    const updatedProject = await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', projectUuid)
      .preload('budgetCurrency')
      .first()

    const combinedProject = updatedProject?.toJSON() || {}

    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .andWhere('is_active', true)
      .preload('vendor', (q) => q.preload('vendorListing'))

    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return { combinedProject, errors }
  }

  public static async getProjectConversationHistoryReadOnly(userUuid: string, projectUuid: string) {
    const project = await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', projectUuid)
      .andWhere('is_active', true)
      .preload('conversations', (conversationQuery) => {
        conversationQuery.preload('conversationTurns')
      })
      .first()

    return project ?? null
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

  private static async handleVendorUpdates(
    projectUuid: string,
    userUuid: string,
    vendorUuids?: string[]
  ) {
    if (vendorUuids === undefined) {
      return []
    }

    // Filter to only vendors owned by this user (silently ignore others per spec §8)
    const ownedVendors =
      vendorUuids.length > 0
        ? await Vendor.query()
            .whereIn('uuid', vendorUuids)
            .where('user_uuid', userUuid)
            .select('uuid')
        : []
    const validUuids = new Set(ownedVendors.map((v) => v.uuid))

    const existingRows = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .select('vendor_uuid', 'is_active')
    const existingMap = new Map(existingRows.map((r) => [r.vendorUuid, r.isActive]))

    // Deactivate rows no longer in the submitted list
    const toDeactivate = [...existingMap.keys()].filter((id) => !validUuids.has(id))
    if (toDeactivate.length) {
      logger.info(`Deactivating vendors for project ${projectUuid}: ${toDeactivate.join(', ')}`)
      await ProjectVendor.query()
        .where('project_uuid', projectUuid)
        .whereIn('vendor_uuid', toDeactivate)
        .update({ isActive: false })
    }

    // Reactivate or create rows for each valid UUID
    const toReactivate: string[] = []
    const toCreate: string[] = []
    for (const uuid of validUuids) {
      if (existingMap.has(uuid)) {
        if (!existingMap.get(uuid)) toReactivate.push(uuid)
      } else {
        toCreate.push(uuid)
      }
    }

    if (toReactivate.length) {
      logger.info(`Reactivating vendors for project ${projectUuid}: ${toReactivate.join(', ')}`)
      await ProjectVendor.query()
        .where('project_uuid', projectUuid)
        .whereIn('vendor_uuid', toReactivate)
        .update({ isActive: true })
    }

    if (toCreate.length) {
      logger.info(`Adding vendors for project ${projectUuid}: ${toCreate.join(', ')}`)
      await ProjectVendor.createMany(toCreate.map((vendorUuid) => ({ projectUuid, vendorUuid })))
    }

    return []
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
