import Project from '#models/project'
import logger from '@adonisjs/core/services/logger'
import { ProjectRequest, ProjectVendorRequest } from '../../types/request.js'
import { Turn } from '../../types/turn.js'
import ConversationTurn from '#models/conversation_turn'
import ProjectVendor from '#models/project_vendor'
import Vendor from '#models/vendor'

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
      .andWhere('is_active', true)
      .preload('vendor')

    const combinedProject = project.toJSON()
    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return combinedProject
  }

  public static async createProject(userUuid: string, request: ProjectRequest) {
    const project = await Project.create(this.mapRequest(request, userUuid))
    const errors = await this.handleVendorUpdates(project.uuid, request.vendors)
    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', project.uuid)
      .andWhere('is_active', true)
      .preload('vendor')

    const combinedProject = project.toJSON()
    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return { combinedProject, errors }
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
      return { project, errors: [] }
    }
    await project.merge(this.mapRequest(request)).save()

    const errors = await this.handleVendorUpdates(projectUuid, request.vendors)

    const updatedProject = await Project.query()
      .where('user_uuid', userUuid)
      .andWhere('uuid', projectUuid)
      .first()

    const combinedProject = updatedProject?.toJSON() || {}

    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .andWhere('is_active', true)
      .preload('vendor')

    combinedProject.vendors = projectVendors.map((pv) => pv.vendor.toJSON())

    return { combinedProject, errors }
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

  private static async handleVendorUpdates(
    projectUuid: string,
    vendorRequest?: ProjectVendorRequest
  ) {
    if (!vendorRequest) {
      return
    }

    const existingProjectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .select('vendor_uuid', 'is_active')

    const existingVendorMap = new Map(existingProjectVendors.map((v) => [v.vendorUuid, v.isActive]))

    const errors = []

    try {
      await this.handleAddingVendors(projectUuid, vendorRequest.toAddVendorIds, existingVendorMap)
      await this.handleRemovingVendors(
        projectUuid,
        vendorRequest.toRemoveVendorIds,
        existingVendorMap
      )
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Unknown error occurred while updating vendors'
      )
    }
    return errors
  }

  private static async handleAddingVendors(
    projectUuid: string,
    vendorIds?: string[],
    existingVendorMap?: Map<string, boolean>
  ) {
    if (!vendorIds?.length || !existingVendorMap) {
      return
    }

    const validVendors = await Vendor.query().whereIn('uuid', vendorIds).select('uuid')
    const validVendorSet = new Set(validVendors.map((v) => v.uuid))

    const invalidVendorIds = vendorIds.filter((id) => !validVendorSet.has(id))
    if (invalidVendorIds.length) {
      logger.error(`Invalid vendor IDs provided for addition: ${invalidVendorIds.join(', ')}`)
      throw new Error(`The following vendor IDs do not exist: ${invalidVendorIds.join(', ')}`)
    }

    const vendorsToReactivate: string[] = []
    const vendorsToCreate: string[] = []

    for (const vendorId of vendorIds) {
      if (existingVendorMap.has(vendorId)) {
        if (!existingVendorMap.get(vendorId)) {
          vendorsToReactivate.push(vendorId)
        }
      } else {
        vendorsToCreate.push(vendorId)
      }
    }

    if (vendorsToReactivate.length) {
      logger.info(
        `Reactivating vendors for project ${projectUuid}: ${vendorsToReactivate.join(', ')}`
      )
      await ProjectVendor.query()
        .where('project_uuid', projectUuid)
        .whereIn('vendor_uuid', vendorsToReactivate)
        .update({ isActive: true })
    }

    if (vendorsToCreate.length) {
      logger.info(`Adding new vendors for project ${projectUuid}: ${vendorsToCreate.join(', ')}`)
      await ProjectVendor.createMany(
        vendorsToCreate.map((vendorUuid) => ({
          projectUuid,
          vendorUuid,
        }))
      )
    }
  }

  private static async handleRemovingVendors(
    projectUuid: string,
    vendorIds?: string[],
    existingVendorMap?: Map<string, boolean>
  ) {
    if (!vendorIds?.length || !existingVendorMap) {
      return
    }

    const invalidVendorIds = vendorIds.filter((id) => !existingVendorMap.has(id))
    if (invalidVendorIds.length) {
      logger.error(`Invalid vendor IDs provided for removal: ${invalidVendorIds.join(', ')}`)
      throw new Error(`The following vendor IDs do not exist: ${invalidVendorIds.join(', ')}`)
    }

    logger.info(`Deactivating vendors for project ${projectUuid}: ${vendorIds.join(', ')}`)
    await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .whereIn('vendor_uuid', vendorIds)
      .update({ isActive: false })
  }
}
