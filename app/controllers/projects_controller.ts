import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import ProjectService from '#services/project_service'
import { ProjectRequest } from '../../types/project_request.js'

export default class ProjectsController {
  /**
   * Display all user projects
   */
  async getAll({ request, response }: HttpContext) {
    // Validator

    // Service call

    // Response
    logger.info(request.headers())
    return response.send('Hello, Projects!')
  }

  /**
   * Create a new project
   */
  async create({ request, response }: HttpContext) {
    logger.info(request.headers())
    logger.info(request.body())
    // Validator

    // Service call
    const project = await ProjectService.createProject(request.body() as ProjectRequest)

    // Response
    return response.send('Project created!' + JSON.stringify(project))
  }

  /**
   * Display a single project
   */
  async getByUuid({ request, inertia }: HttpContext) {
    // Validator

    // Service call

    // Response
    logger.info(request.headers())
    logger.info(request.params())

    const mockProjects = [
      {
        uuid: '1',
        name: 'Weekend Plans',
      },
      {
        uuid: '2',
        name: 'Recipe Ideas',
      },
      {
        uuid: '3',
        name: 'Travel Advice',
      },
      {
        uuid: '4',
        name: 'Book Recommendations',
      },
      {
        uuid: '5',
        name: 'Workout Tips',
      },
    ]

    const project = { project: mockProjects.find((p) => p.uuid === request.params().uuid) }

    logger.info(project)

    return inertia.render('projects/chat', { ...project })
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
}
