import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import ProjectService from '#services/project_service'
import { ProjectRequest } from '../../types/request.js'
import {
  createProjectValidator,
  getUserProjectsValidator,
  requestParamsValidator,
  updateProjectValidator,
} from '#validators/projects_validator'
import { retrieveReferences } from '../utils/retrieve_references.js'

const CURRENCIES_TABLE = 'envoy_schema.currencies'

export default class ProjectsController {
  /**
   * Display all user projects
   */
  async getAll({ request, response, auth }: HttpContext) {
    // Validate user
    await auth.check()
    const user = auth.user!

    // Validate request
    const { limit, offset } = await request.validateUsing(getUserProjectsValidator)

    // Get all user projects
    try {
      const projects = await ProjectService.getUserProjects(user.uuid, limit, offset)
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
  async getByUuid({ request, response, auth }: HttpContext) {
    // Validate user
    await auth.check()
    const user = auth.user!

    // Validate request
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    // Get user project
    try {
      const project = await ProjectService.getUserProjectByUuid(user.uuid, projectUuid)
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
  async create({ request, response, auth }: HttpContext) {
    // Validate user
    await auth.check()
    const user = auth.user!

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
      const project = await ProjectService.createProject(
        user.uuid,
        validatedRequest as ProjectRequest
      )
      return response.status(201).json({ project })
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
  async update({ request, response, auth }: HttpContext) {
    // Validate user
    await auth.check()
    const user = auth.user!

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
      const project = await ProjectService.updateProject(
        user.uuid,
        projectUuid,
        validatedRequest as ProjectRequest,
        isOnlyActivatingRecord(validatedRequest)
      )
      if (!project) {
        return response.status(404).json({ error: 'Project not found' })
      }
      return response.status(201).json({ project })
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
  async chat({ request, response, auth }: HttpContext) {
    // Validate user
    await auth.check()
    const user = auth.user!

    // Service call

    // Response
    logger.info('Chat request received for user:', user.uuid)
    logger.info(request.headers())
    logger.info(request.params())
    logger.info(request.body())
    return response.send('Project chat!')
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

const isOnlyActivatingRecord = (validatedRequest: Record<string, any>): boolean => {
  if (!validatedRequest || typeof validatedRequest !== 'object') return false
  const keys = Object.keys(validatedRequest).filter((k) => validatedRequest[k] !== undefined)
  return keys.length === 1 && keys[0] === 'isActive' && validatedRequest.isActive === true
}
