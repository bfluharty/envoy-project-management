import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import ProjectService from '#services/project_service'
import { ProjectRequest, ReasoningRequest } from '../../../types/request.js'
import {
  chatProjectValidator,
  attachVendorListingsValidator,
  createProjectValidator,
  getUserProjectsValidator,
  requestParamsValidator,
  updateProjectValidator,
} from '#validators/projects_validator'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import { isOnlyActivatingRecord } from '../../utils/controller_utils.js'
import ProjectVendorAttachmentService, {
  ProjectVendorAttachmentError,
} from '#services/project_vendor_attachment_service'
import ProjectReasoningWorkflowService from '#services/project_reasoning_workflow_service'
import UserRoleService from '#services/user_role_service'
import {
  getClientIp,
  projectChatRateLimitRules,
  rejectWhenRateLimited,
} from '#utils/rate_limit_utils'

export default class ProjectsAPIController {
  private async getConsumer(auth: HttpContext['auth']) {
    const user = auth.getUserOrFail()
    if (!user.isActive || !(await UserRoleService.isConsumer(user))) return null
    return user
  }

  async attachVendors({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { vendorListingUuids } = await request.validateUsing(attachVendorListingsValidator)

    try {
      const result = await ProjectVendorAttachmentService.attachListings(
        userId,
        projectUuid,
        vendorListingUuids
      )
      return response.status(200).json(result)
    } catch (error) {
      if (error instanceof ProjectVendorAttachmentError) {
        return response.status(error.statusCode).json({
          error: error.message,
          unavailableVendorListingUuids: error.unavailableVendorListingUuids,
        })
      }
      throw error
    }
  }

  /**
   * Display all user projects
   */
  async getAll({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { limit, offset } = await request.validateUsing(getUserProjectsValidator)

    // Get all user projects
    try {
      const projects = await ProjectService.getUserProjects(userId, limit, offset)
      return response.status(200).json({
        projects: projects,
        count: projects.length,
        limit: limit,
        offset: offset,
      })
    } catch (error) {
      logger.error('Error fetching projects:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to fetch projects', developerText: error.message })
    }
  }

  /**
   * Get a single user project
   */
  async getByUuid({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    // Get user project
    try {
      const project = await ProjectService.getUserProjectByUuid(userId, projectUuid)
      if (!project) {
        return response.status(404).json({ error: 'Project not found' })
      }
      return response.status(200).json({ project })
    } catch (error) {
      logger.error('Error fetching project:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to fetch project', developerText: error.message })
    }
  }

  /**
   * Create a new project
   */
  async create({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const validatedRequest = await request.validateUsing(createProjectValidator)
    if (validatedRequest.isActive === false) {
      return response.status(400).json({ error: 'Projects cannot be deleted during creation' })
    }

    // Save project
    try {
      const { combinedProject, errors } = await ProjectService.createProject(
        userId,
        validatedRequest as ProjectRequest
      )
      const intakeResult = await ProjectReasoningWorkflowService.runIntakeForProject(
        combinedProject.uuid,
        userId
      )
      const allErrors = [
        ...(errors ?? []),
        ...(intakeResult.success ? [] : [intakeResult.error ?? 'Project intake failed']),
      ]

      if (allErrors.length) {
        logger.warn('Project created with errors:')
        logger.warn(allErrors)
        return response.status(203).json({
          project: combinedProject,
          errors: allErrors,
        })
      }
      return response.status(201).json({ combinedProject })
    } catch (error) {
      logger.error('Error creating project:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to create project', developerText: error.message })
    }
  }

  /**
   * Update a project
   */
  async update({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const validatedRequest = await request.validateUsing(updateProjectValidator)

    // Update project
    try {
      const { combinedProject, errors } = await ProjectService.updateProject(
        userId,
        projectUuid,
        validatedRequest as ProjectRequest,
        isOnlyActivatingRecord(validatedRequest)
      )
      if (!combinedProject) {
        return response.status(404).json({ error: 'Project not found' })
      }
      if (errors?.length) {
        logger.warn('Project updated with errors:')
        logger.warn(errors)
        return response.status(203).json({
          project: combinedProject,
          errors,
        })
      }
      return response.status(201).json({ project: combinedProject })
    } catch (error) {
      logger.error('Error updating project:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to update project', developerText: error.message })
    }
  }

  /**
   * Retry project intake and planning prompt-data generation.
   */
  async retryIntake({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    const result = await ProjectReasoningWorkflowService.runIntakeForProject(projectUuid, userId)
    if (!result.success) {
      const statusCode = result.error === 'Project not found' ? 404 : 502
      return response.status(statusCode).json({
        success: false,
        error: result.error ?? 'Project intake failed',
      })
    }

    return response.status(200).json({ success: true })
  }

  /**
   * Chat with reasoning engine about a project
   */
  async chat({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt } = await request.validateUsing(chatProjectValidator)
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      projectChatRateLimitRules({ userUuid: userId, projectUuid, ip: getClientIp(request) })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      const project = await ProjectService.getProjectWithConversations(userId, projectUuid)
      const reasoningContext = await ReasoningRequestContextService.buildContext(
        projectUuid,
        project.conversations[0].uuid
      )
      const planningPromptData = await ProjectReasoningWorkflowService.ensurePlanningPromptData(
        project,
        userId
      )
      const projectContext = await ReasoningRequestContextService.buildProjectContext(project)

      const reasoningRequest: ReasoningRequest =
        ProjectReasoningWorkflowService.buildPlanningRequest({
          project,
          user,
          prompt,
          promptData: planningPromptData,
          context: reasoningContext,
          projectContext,
        })

      // Send request
      return await ReasoningEngineService.handleReasoningChat(reasoningRequest, project, response)
    } catch (error) {
      logger.error('Error preparing chat request:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to prepare chat request', developerText: error.message })
    }
  }
}
