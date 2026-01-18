import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(1),
  })
)

export const registerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(255),
    email: vine.string().email(),
    password: vine.string().minLength(8).maxLength(255),
    passwordConfirmation: vine.string().confirmed({ confirmationField: 'password' }),
  })
)
