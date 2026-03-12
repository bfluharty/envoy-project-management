import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { ProjectRequest, ReasoningRequest } from '../../../types/request.js'
import {
  chatProjectValidator,
  createProjectValidator,
  getUserProjectsValidator,
  requestParamsValidator,
  updateProjectValidator,
} from '#validators/projects_validator'
import ReasoningEngineService from '#services/reasoning_engine_service'
import { parseDateFields } from '#utils/date_helper'

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

    return inertia.render('projects/chat', {
      project: {
        uuid: project.uuid,
        name: project.title,
      },
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

  /**
   * Update a project
   */
  async update({ request, response, auth, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    const body = parseDateFields(request)
    const validatedRequest = await updateProjectValidator.validate(body)

    try {
      const { combinedProject, errors } = await ProjectService.updateProject(
        user.uuid,
        projectUuid,
        validatedRequest as ProjectRequest,
        isOnlyActivatingRecord(validatedRequest)
      )
      if (!combinedProject) {
        return response.abort({ error: 'Project not found' }, 404)
      }
      if (errors?.length) {
        logger.warn('Project updated with errors:')
        logger.warn(errors)
        return response.json({ project: combinedProject, errors })
      }
      return response.json({ project: combinedProject })
    } catch (error) {
      logger.error('Error updating project:')
      logger.error(error)
      session.flash('error', error.message || 'Failed to update project. Please try again.')
      return response.redirect().back()
    }
  }

  /**
   * Chat with reasoning engine about a project
   */
  async chat({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt, variables } = await request.validateUsing(chatProjectValidator)

    try {
      const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
      const pastConversationTurns =
        project.conversations
          .flatMap((conv) => conv.conversationTurns)
          ?.map((turn) => turn?.contents) || []

      const reasoningRequest = {
        agentId: 'envoy-reasoning-agent-001',
        prompt,
        variables: variables ?? {},
        projectUuid,
        pastConversationTurns,
      } as ReasoningRequest

      return await ReasoningEngineService.handleReasoningChat(reasoningRequest, project, response)
    } catch (error) {
      if (error.message === 'Project not found') {
        return response.abort({ error: 'Project not found' }, 404)
      }
      logger.error('Error preparing chat request:')
      logger.error(error)
      throw error
    }
  }
}

const isOnlyActivatingRecord = (validatedRequest: Record<string, any>): boolean => {
  if (!validatedRequest || typeof validatedRequest !== 'object') return false
  const keys = Object.keys(validatedRequest).filter((k) => validatedRequest[k] !== undefined)
  return keys.length === 1 && keys[0] === 'isActive' && validatedRequest.isActive === true
}
