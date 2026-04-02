import vine from '@vinejs/vine'

export const outreachDraftParamsValidator = vine.compile(
  vine.object({
    draftUuid: vine.string().uuid(),
  })
)

export const outreachThreadParamsValidator = vine.compile(
  vine.object({
    threadUuid: vine.string().uuid(),
  })
)

export const reviseOutreachDraftValidator = vine.compile(
  vine.object({
    instructions: vine.string().trim().minLength(1),
    subject: vine.string().trim().optional(),
    body: vine.string().trim().optional(),
  })
)

export const createOutreachDraftValidator = vine.compile(
  vine.object({
    projectVendorUuid: vine.string().uuid().optional(),
    vendorUuid: vine.string().uuid().optional(),
  })
)

export const sendOutreachDraftValidator = vine.compile(
  vine.object({
    subject: vine.string().trim().optional(),
    body: vine.string().trim().optional(),
  })
)

export const replyToThreadValidator = vine.compile(
  vine.object({
    subject: vine.string().trim().minLength(1),
    body: vine.string().trim().minLength(1),
    inReplyTo: vine.string().optional(),
    references: vine.string().optional(),
    threadId: vine.string().optional(),
  })
)

export const reviseReplyToThreadValidator = vine.compile(
  vine.object({
    instructions: vine.string().trim().minLength(1),
    body: vine.string().trim().optional(),
  })
)
