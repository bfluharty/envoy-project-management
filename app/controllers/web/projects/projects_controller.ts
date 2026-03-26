import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { ProjectRequest } from '../../../../types/request.js'
import {
  createProjectValidator,
  getUserProjectsValidator,
  requestParamsValidator,
} from '#validators/projects_validator'
import { parseDateFields } from '#utils/date_helper'
import ProjectVendor from '#models/project_vendor'
import Vendor from '#models/vendor'

export default class ProjectsController {
  /**
   * Display all user projects
   */
  async index({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { limit, offset } = await request.validateUsing(getUserProjectsValidator)

    const projects = await ProjectService.getUserProjects(user.uuid, limit, offset)
    return response.json({
      projects,
      count: projects.length,
      limit,
      offset,
    })
  }

  /**
   * Display a single project
   */
  async show({ request, response, inertia, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    const project = await ProjectService.getUserProjectByUuid(user.uuid, projectUuid)
    if (!project) {
      return response.abort({ error: 'Project not found' }, 404)
    }

    const projectWithHistory = await ProjectService.getProjectConversationHistoryReadOnly(
      user.uuid,
      projectUuid
    )
    const allTurns = projectWithHistory?.conversations?.flatMap((c) => c.conversationTurns) ?? []
    const hasPriorConversation = allTurns.length > 0
    const conversationHistory = allTurns.flatMap((turn) => [
      { role: 'user', content: turn.contents.userPrompt },
      { role: 'assistant', content: turn.contents.modelResponse },
    ])

    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .where('is_active', true)
      .preload('vendor')
    const linkedVendors = projectVendors.map((pv) => ({
      uuid: pv.vendor.uuid,
      name: pv.vendor.name,
      email: pv.vendor.email,
    }))

    const allVendors = await Vendor.query()
      .where('user_uuid', user.uuid)
      .where('is_active', true)
      .orderBy('name', 'asc')
      .select(['uuid', 'name', 'email'])

    return inertia.render('projects/project', {
      project: {
        uuid: project.uuid,
        name: project.title,
        description: project.description ?? null,
        location: project.location ?? null,
        startDate: project.startDate ?? null,
        endDate: project.endDate ?? null,
        deadline: project.deadline ?? null,
        budgetAmount: project.budgetAmount ?? null,
        goals: project.goals ?? null,
      },
      linkedVendors,
      allVendors: allVendors.map((v) => ({ uuid: v.uuid, name: v.name, email: v.email })),
      hasPriorConversation,
      conversationHistory,
    })
  }

  /**
   * Store a new project
   */
  async store({ request, response, auth, session }: HttpContext) {
    const user = auth.getUserOrFail()

    const body = parseDateFields(request)
    const validatedRequest = await createProjectValidator.validate(body)

    try {
      const { combinedProject, errors } = await ProjectService.createProject(
        user.uuid,
        validatedRequest as ProjectRequest
      )
      if (errors?.length) {
        logger.warn('Project created with errors:')
        logger.warn(errors)
        session.flash('partial_success', 'Project created with errors: ' + errors.join('; '))
        return response.redirect().toPath(`/projects/${combinedProject.uuid}`)
      }
      session.flash('success', 'Project created successfully!')
      return response.redirect().toPath(`/projects/${combinedProject.uuid}`)
    } catch (error) {
      logger.error('Error creating project:')
      logger.error(error)
      session.flash('error', error.message || 'Failed to create project. Please try again.')
      return response.redirect().back()
    }
  }
}
