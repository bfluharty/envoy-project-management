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

export const authenticatedVendorSearchValidator = vine.compile(
  vine.object({
    projectDescription: vine.string().trim().minLength(5).maxLength(2000),
    postalCode: vine.string().trim().minLength(1).maxLength(64),
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
