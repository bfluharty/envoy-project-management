import vine from '@vinejs/vine'

const replacementInsightValidator = vine.object({
  insight_type: vine.string().trim().minLength(1),
  insight_text: vine.string().trim().minLength(1).maxLength(500),
  importance: vine.number().withoutDecimals().range([1, 5]).optional(),
  confidence: vine.number().range([0, 1]).optional(),
})

export const applyProjectInsightsParamsValidator = vine.compile(
  vine.object({
    projectUuid: vine.string().uuid(),
  })
)

export const applyProjectInsightsValidator = vine.compile(
  vine.object({
    new_insights: vine
      .array(
        vine.object({
          insight_type: vine.string().trim().minLength(1),
          insight_text: vine.string().trim().minLength(1).maxLength(500),
          importance: vine.number().withoutDecimals().range([1, 5]).optional(),
          confidence: vine.number().range([0, 1]).optional(),
        })
      )
      .optional(),
    updates: vine
      .array(
        vine.object({
          existing_insight_uuid: vine.string().uuid(),
          operation: vine
            .string()
            .trim()
            .toLowerCase()
            .in(['superseded', 'contradicted', 'archived']),
          replacement_insight: replacementInsightValidator.optional(),
        })
      )
      .optional(),
  })
)
