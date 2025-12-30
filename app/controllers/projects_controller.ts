import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'

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
    // Validator

    // Service call

    // Response
    logger.info(request.headers())
    logger.info(request.body())
    return response.send('Project created!')
  }

  /**
   * Display a single project
   */
  async getByUuid({ request, response }: HttpContext) {
    // Validator

    // Service call

    // Response
    logger.info(request.headers())
    logger.info(request.params())
    return response.send('Project by id details!')
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
