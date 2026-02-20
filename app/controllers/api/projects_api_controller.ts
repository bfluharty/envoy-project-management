import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import ProjectService from '#services/project_service'
import { ProjectRequest, ReasoningRequest } from '../../../types/request.js'
import {
  chatProjectValidator,
  createProjectValidator,
  getUserProjectsValidator,
  requestParamsValidator,
  updateProjectValidator,
} from '#validators/projects_validator'
import { retrieveReferences } from '../../utils/retrieve_references.js'
import ReasoningEngineService from '#services/reasoning_engine_service'
import User from '#models/user'
import { isOnlyActivatingRecord, validateUser } from '../../utils/controller_utils.js'
const CURRENCIES_TABLE = 'envoy_schema.currencies'

export default class ProjectsAPIController {
  /**
   * Display all user projects
   */
  async getAll({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

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
  async getByUuid({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

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
  async create({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

    // Validate request
    const validatedRequest = await request.validateUsing(createProjectValidator)
    if (validatedRequest.isActive === false) {
      return response.status(400).json({ error: 'Projects cannot be deleted during creation' })
    }
    if (validatedRequest.budgetCurrency) {
      try {
        validatedRequest.budgetCurrency = await validateCurrency(validatedRequest.budgetCurrency)
      } catch (error) {
        return response.status(400).json({ error: error.message })
      }
    }

    // Save project
    try {
      const { combinedProject, errors } = await ProjectService.createProject(
        userId,
        validatedRequest as ProjectRequest
      )
      if (errors?.length) {
        logger.warn('Project created with errors:')
        logger.warn(errors)
        return response.status(203).json({
          project: combinedProject,
          errors,
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
  async update({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

    // Validate request
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const validatedRequest = await request.validateUsing(updateProjectValidator)

    if (validatedRequest.budgetCurrency) {
      try {
        validatedRequest.budgetCurrency = await validateCurrency(validatedRequest.budgetCurrency)
      } catch (error) {
        return response.status(400).json({ error: error.message })
      }
    }

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
   * Chat with reasoning engine about a project
   */
  async chat({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

    // Validate request
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt, variables } = await request.validateUsing(chatProjectValidator)

    // Build reasoning request
    const agentId = 'envoy-reasoning-agent-001' // Placeholder agent ID
    try {
      const project = await ProjectService.getProjectWithConversations(userId, projectUuid)
      const pastConversationTurns =
        project.conversations
          .flatMap((conv) => conv.conversationTurns)
          ?.map((turn) => turn?.contents) || []

      const reasoningRequest = {
        agentId,
        prompt,
        variables,
        projectUuid,
        pastConversationTurns,
      } as ReasoningRequest

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

const validateCurrency = async (currencyCode: string) => {
  if (currencyCode) {
    const currencies = await retrieveReferences(CURRENCIES_TABLE)
    const currencyId = currencies.find((c) => c.code === currencyCode)?.id
    if (!currencyId) {
      throw new Error('Invalid currency code')
    } else {
      return currencyId
    }
  }
}
