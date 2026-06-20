import vine from '@vinejs/vine'

export const getVendorsValidator = vine.compile(
  vine.object({
    limit: vine.number().min(1).optional(),
    offset: vine.number().min(0).optional(),
  })
)

export const trustedVendorMatchesValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).optional(),
    email: vine.string().email().trim().optional(),
  })
)

export const requestParamsValidator = vine.compile(
  vine.object({
    uuid: vine.string().uuid(),
  })
)

export const createVendorValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    email: vine.string().email().trim().minLength(1),
    isActive: vine.boolean().optional(),
  })
)

export const updateVendorValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).optional(),
    email: vine.string().email().trim().minLength(1).optional(),
    isActive: vine.boolean().optional(),
  })
)
