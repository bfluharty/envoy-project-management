import axios from 'axios'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { generateInitialOutreachDrafts } from '#services/project_outreach_service'
import ProjectPromptService from '#services/project_prompt_service'
import { ReasoningAgentResponse, ReasoningRequest } from '../../types/request.js'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import { HttpContext } from '@adonisjs/core/http'
import { getReasoningChatUrl, getVendorDiscoveryUrl } from '#utils/reasoning_engine_urls'

const OUTREACH_DRAFTING_NOTICE =
  'I am generating draft emails for all vendors attached to this project, and you can review them in the Outreach tab.'
const NO_OUTREACH_VENDORS_NOTICE =
  'I have the project details needed for outreach, but there are no vendors attached to this project yet. Add vendors to the project before Envoy can prepare outreach drafts.'

export default class ReasoningEngineService {
  public static async requestVendorDiscovery(input: { projectDescription: string }) {
    let reasoningResponse

    logger.info(
      { projectDescriptionLength: input.projectDescription.length },
      'Requesting vendor discovery from reasoning engine'
    )

    try {
      reasoningResponse = await axios.post(getVendorDiscoveryUrl(), input)
    } catch (error) {
      logger.error({ err: error }, 'Error calling reasoning engine vendor discovery')
      throw error
    }

    logger.info(
      { status: reasoningResponse.status },
      'Reasoning engine vendor discovery response received'
    )

    if (reasoningResponse.status !== 200) {
      logger.error(
        { status: reasoningResponse.status, body: reasoningResponse.data },
        'Reasoning engine vendor discovery returned error'
      )
      throw new Error('Reasoning engine vendor discovery error')
    }

    logger.debug(
      {
        responseKeys:
          reasoningResponse.data && typeof reasoningResponse.data === 'object'
            ? Object.keys(reasoningResponse.data)
            : [],
      },
      'Reasoning engine vendor discovery response shape'
    )

    return reasoningResponse.data
  }

  public static async handleReasoningChat(
    reasoningRequest: ReasoningRequest,
    project: Project,
    response: HttpContext['response'],
    options: {
      saveToHistory?: boolean
      historyUserPrompt?: string
      plainTextResponse?: boolean
    } = {}
  ) {
    const { saveToHistory = true, historyUserPrompt, plainTextResponse = false } = options
    try {
      const agentResponse = await this.requestAgent(reasoningRequest)

      if (saveToHistory) {
        const persistedTurn =
          historyUserPrompt === undefined
            ? agentResponse.turn
            : { ...agentResponse.turn, userPrompt: historyUserPrompt }
        await ProjectService.saveConversationTurn(project.conversations[0].uuid, persistedTurn)
        const message = await this.handlePostPlanningResponse(agentResponse, project)
        if (plainTextResponse) {
          return response.status(200).send(message)
        }
        return response.status(200).json(message)
      }

      return response.status(200).send(agentResponse.message ?? agentResponse.turn.modelResponse)
    } catch (error) {
      logger.error('Error calling reasoning engine:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to call reasoning engine', developerText: error.message })
    }
  }

  public static async requestAgent(
    reasoningRequest: ReasoningRequest
  ): Promise<ReasoningAgentResponse> {
    const reasoningResponse = await axios.post(getReasoningChatUrl(), reasoningRequest)

    if (reasoningResponse.status !== 200) {
      logger.error('Reasoning engine returned error:')
      logger.error(reasoningResponse.data)
      throw new Error('Reasoning engine error')
    }

    return reasoningResponse.data as ReasoningAgentResponse
  }

  private static async handlePostPlanningResponse(
    agentResponse: ReasoningAgentResponse,
    project: Project
  ): Promise<string> {
    let message = agentResponse.message ?? agentResponse.turn.modelResponse

    if (
      agentResponse.agentId !== 'PLANNING' ||
      agentResponse.planningStatus !== 'READY_FOR_OUTREACH' ||
      !agentResponse.readyForNextStep
    ) {
      return message
    }

    if (agentResponse.data) {
      await ProjectPromptService.savePromptData({
        projectUuid: project.uuid,
        agentType: 'OUTREACH',
        data: agentResponse.data,
        userUuid: project.userUuid,
      })
    }

    if (!(await this.hasActiveProjectVendors(project.uuid))) {
      return NO_OUTREACH_VENDORS_NOTICE
    }

    const draftResult = await generateInitialOutreachDrafts(project.userUuid, project.uuid)
    message = this.ensureDraftingNotice(message)

    if (draftResult.failed.length > 0) {
      message += ` ${draftResult.failed.length} vendor draft${
        draftResult.failed.length === 1 ? '' : 's'
      } could not be generated; check the Outreach tab to retry or edit the failed draft${
        draftResult.failed.length === 1 ? '' : 's'
      }.`
    }

    return message
  }

  private static async hasActiveProjectVendors(projectUuid: string): Promise<boolean> {
    const projectVendor = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .where('is_active', true)
      .first()

    return !!projectVendor
  }

  private static ensureDraftingNotice(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('draft') && lower.includes('outreach tab')) {
      return message
    }

    return `${message.trim()} ${OUTREACH_DRAFTING_NOTICE}`
  }
}
