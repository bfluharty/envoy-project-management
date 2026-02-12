import axios from 'axios'
import logger from '@adonisjs/core/services/logger'
import getReasoningEngineUrl from '#config/environment'
import ProjectService from '#services/project_service'
import { Turn } from '../../types/turn.js'
import { ReasoningRequest } from '../../types/request.js'
import Project from '#models/project'
import { HttpContext } from '@adonisjs/core/http'

export default class ReasoningEngineService {
  public static async handleReasoningChat(
    reasoningRequest: ReasoningRequest,
    project: Project,
    response: HttpContext['response']
  ) {
    try {
      const reasoningResponse = await axios.post(getReasoningEngineUrl(), reasoningRequest)
      if (reasoningResponse.status !== 200) {
        logger.error('Reasoning engine returned error:')
        logger.error(reasoningResponse.data)
        return response
          .status(500)
          .json({ error: 'Reasoning engine error', developerText: reasoningResponse.data })
      }

      const turn: Turn = reasoningResponse.data
      ProjectService.saveConversationTurn(project.conversations[0].uuid, turn)

      return response.status(reasoningResponse.status).json(turn.modelResponse)
    } catch (error) {
      logger.error('Error calling reasoning engine:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to call reasoning engine', developerText: error.message })
    }
  }
}
