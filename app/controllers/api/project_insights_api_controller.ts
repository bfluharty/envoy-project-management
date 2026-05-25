import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectInsightService, {
  ProjectInsightProjectNotFoundError,
  ProjectInsightValidationError,
} from '#services/project_insight_service'
import {
  applyProjectInsightsParamsValidator,
  applyProjectInsightsValidator,
} from '#validators/project_insights_validator'
import { ProjectInsightStatusCode } from '../../../types/project_insight.js'

export default class ProjectInsightsApiController {
  async apply({ request, response }: HttpContext) {
    const { projectUuid } = await applyProjectInsightsParamsValidator.validate(request.params())

    try {
      await ProjectInsightService.ensureActiveProjectExists(projectUuid)

      const payload = await request.validateUsing(applyProjectInsightsValidator)
      const result = await ProjectInsightService.applyExtractedChanges(projectUuid, {
        newInsights: payload.new_insights?.map((insight) => ({
          insightType: insight.insight_type,
          insightText: insight.insight_text,
          importance: insight.importance,
          confidence: insight.confidence ?? null,
        })),
        updates: payload.updates?.map((update) => ({
          existingInsightUuid: update.existing_insight_uuid,
          operation: update.operation as ProjectInsightStatusCode,
          replacementInsight: update.replacement_insight
            ? {
                insightType: update.replacement_insight.insight_type,
                insightText: update.replacement_insight.insight_text,
                importance: update.replacement_insight.importance,
                confidence: update.replacement_insight.confidence ?? null,
              }
            : undefined,
        })),
      })

      return response.status(200).json(result)
    } catch (error) {
      if (error instanceof ProjectInsightProjectNotFoundError) {
        return response.status(404).json({ error: 'Project not found' })
      }

      if (error instanceof ProjectInsightValidationError) {
        return response.status(400).json({ error: error.message })
      }

      logger.error('Error applying project insight changes:')
      logger.error(error)
      return response.status(500).json({
        error: 'Failed to apply project insight changes',
        developerText: error.message,
      })
    }
  }
}
