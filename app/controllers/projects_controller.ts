import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import ProjectService from '#services/project_service'
import { ProjectRequest } from '../../types/request.js'
import {
  createProjectValidator,
  getUserProjectsValidator,
  getUserProjectByUuidValidator,
  updateProjectValidator,
} from '#validators/projects_validator'

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
      logger.error('Error fetching projects:', error)
      return response.status(500).json({ error: 'Failed to fetch projects' })
    }
  }

  /**
   * Get a single user project
   */
  async getByUuid({ request, response, auth, inertia }: HttpContext) {
    // Validate user
    await auth.check()
    const user = auth.user!

    // Validate request
    const { uuid: projectUuid } = await request.validateUsing(getUserProjectByUuidValidator)

    // Get user project
    try {
      const project = await ProjectService.getUserProjectByUuid(user.uuid, projectUuid)
      if (!project) {
        return response.status(404).json({ error: 'Project not found' })
      }

      return inertia.render('projects/chat', {
        project: {
          uuid: project.uuid,
          name: project.title,
        },
      })
    } catch (error) {
      logger.error('Error fetching project:', error)
      return response.status(500).json({ error: 'Failed to fetch project' })
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

    // Save project
    try {
      const project = await ProjectService.createProject(
        user.uuid,
        validatedRequest as ProjectRequest
      )
      return response.status(201).json({ project })
    } catch (error) {
      logger.error('Error creating project:', error)
      return response.status(500).json({ error: 'Failed to create project' })
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
    const validatedRequest = await request.validateUsing(updateProjectValidator)

    // Update project
    try {
      const project = await ProjectService.updateProject(
        user.uuid,
        request.params().uuid,
        validatedRequest as ProjectRequest
      )
      if (!project) {
        return response.status(404).json({ error: 'Project not found' })
      }
      return response.status(201).json({ project })
    } catch (error) {
      logger.error('Error updating project:', error)
      return response.status(500).json({ error: 'Failed to update project' })
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
    logger.info(request.headers())
    logger.info(request.params())
    logger.info(request.body())
    return response.send('Project chat!')
  }
}
