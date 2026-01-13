import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import ProjectService from '#services/project_service'
import Project from '#models/project'
import { ProjectRequest } from '../../types/request.js'

export default class ProjectsController {
  /**
   * Display all user projects
   */
  async getAll({ auth, response }: HttpContext) {
    await auth.check()
    const user = auth.user!

    try {
      const projects = await Project.query()
        .where('user_uuid', user.uuid)
        .where('is_active', true)
        .orderBy('created_timestamp', 'desc')

      return response.json({
        projects: projects,
        count: projects.length,
      })
    } catch (error) {
      logger.error('Error fetching projects:', error)
      return response.status(500).json({ error: 'Failed to fetch projects' })
    }
  }

  /**
   * Create a new project
   */
  async create({ request, response, auth }: HttpContext) {
    await auth.check()
    const user = auth.user!

    try {
      // Add user UUID to project data
      const projectData = {
        ...request.body(),
        userUuid: user.uuid,
      }

      const project = await ProjectService.createProject(projectData as ProjectRequest)

      return response.status(201).json({
        message: 'Project created successfully',
        project: {
          uuid: project.uuid,
          title: project.title,
          description: project.description,
        },
      })
    } catch (error) {
      logger.error('Error creating project:', error)
      return response.status(500).json({ error: 'Failed to create project' })
    }
  }

  /**
   * Display a single project
   */
  async getByUuid({ request, inertia, auth, response }: HttpContext) {
    await auth.check()
    const user = auth.user!
    const projectUuid = request.params().uuid

    try {
      const project = await Project.query()
        .where('uuid', projectUuid)
        .where('user_uuid', user.uuid)
        .where('is_active', true)
        .first()

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
   * Update a project
   */
  async update({ request, response }: HttpContext) {
    // Validator

    // Service call

    // Response
    logger.info(request.headers())
    logger.info(request.params())
    logger.info(request.body())
    return response.send('Project updated!')
  }

  /**
   * Chat with reasoning engine about a project
   */
  async chat({ request, response }: HttpContext) {
    // Validator

    // Service call

    // Response
    logger.info(request.headers())
    logger.info(request.params())
    logger.info(request.body())
    return response.send('Project chat!')
  }

  validateUser(user: string) {
    return user !== null && user.length > 0
  }
}
