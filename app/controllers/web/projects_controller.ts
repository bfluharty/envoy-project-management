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
import ReasoningEngineService from '#services/reasoning_engine_service'
import { parseDateFields } from '#helpers/date_helper'

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

    return inertia.render('projects/chat', {
      project: {
        uuid: project.uuid,
        name: project.title,
      },
    })
  }

  /**
   * Store a new project
   */
  async store({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const body = parseDateFields(request)
    const validatedRequest = await createProjectValidator.validate(body)
    const project = await ProjectService.createProject(
      user.uuid,
      validatedRequest as ProjectRequest
    )
    return response.redirect().toPath(`/projects/${project.uuid}`)
  }

  /**
   * Update a project
   */
  async update({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    const body = parseDateFields(request)
    const validatedRequest = await updateProjectValidator.validate(body)

    const project = await ProjectService.updateProject(
      user.uuid,
      projectUuid,
      validatedRequest as ProjectRequest
    )

    if (!project) {
      return response.abort({ error: 'Project not found' }, 404)
    }

    return response.json({ project })
  }

  /**
   * Chat with reasoning engine about a project
   */
  async chat({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt, variables } = await request.validateUsing(chatProjectValidator)

    const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
    const pastConversationTurns =
      project.conversations
        .flatMap((conv) => conv.conversationTurns)
        ?.map((turn) => turn?.contents) || []

    const reasoningRequest: ReasoningRequest = {
      agentId: 'envoy-reasoning-agent-001',
      prompt,
      variables,
      projectUuid,
      pastConversationTurns,
    }

    return ReasoningEngineService.handleReasoningChat(reasoningRequest, project, response)
  }
}
