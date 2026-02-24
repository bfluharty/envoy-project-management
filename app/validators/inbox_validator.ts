import vine from '@vinejs/vine'

const emailDataSchema = {
  subject: vine.string().trim().maxLength(1024),
  body: vine.string().trim().maxLength(500_000),
  from: vine.string().trim().maxLength(512),
  to: vine.array(vine.string().trim().maxLength(512)).minLength(1),
  date: vine.string().trim().maxLength(128),
  cc: vine.array(vine.string().trim().maxLength(512)).optional(),
  threadContext: vine.string().trim().maxLength(50_000).optional(),
}

export const analyzeEmailValidator = vine.compile(vine.object(emailDataSchema))

export const generateReplyValidator = vine.compile(
  vine.object({
    ...emailDataSchema,
    analysis: vine.object({}).allowUnknownProperties().optional(),
  })
)

export const generateInitialEmailValidator = vine.compile(
  vine.object({
    recipients: vine.array(vine.string().trim().email()).minLength(1).maxLength(50),
    subject: vine.string().trim().minLength(1).maxLength(1024),
    context: vine.string().trim().minLength(1).maxLength(20_000),
  })
)
