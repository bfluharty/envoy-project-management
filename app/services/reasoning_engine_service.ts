import axios from 'axios'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { applyOutreachActions } from '#services/project_outreach_service'
import { Turn } from '../../types/turn.js'
import { ReasoningRequest } from '../../types/request.js'
import Project from '#models/project'
import { HttpContext } from '@adonisjs/core/http'
import { getReasoningChatUrl, getVendorDiscoveryUrl } from '#utils/reasoning_engine_urls'

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
    options: { saveToHistory?: boolean } = {}
  ) {
    const { saveToHistory = true } = options
    try {
      const reasoningResponse = await axios.post(getReasoningChatUrl(), reasoningRequest)
      if (reasoningResponse.status !== 200) {
        logger.error('Reasoning engine returned error:')
        logger.error(reasoningResponse.data)
        return response
          .status(500)
          .json({ error: 'Reasoning engine error', developerText: reasoningResponse.data })
      }

      const turn: Turn = reasoningResponse.data
      await applyOutreachActions(project.uuid, turn.actionExecutions)

      if (saveToHistory) {
        ProjectService.saveConversationTurn(project.conversations[0].uuid, turn)
        return response.status(reasoningResponse.status).json(turn.modelResponse)
      }

      return response.status(200).send(turn.modelResponse)
    } catch (error) {
      logger.error('Error calling reasoning engine:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to call reasoning engine', developerText: error.message })
    }
  }
}
