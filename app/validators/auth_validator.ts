import vine, { SimpleMessagesProvider } from '@vinejs/vine'
const PASSWORD_ERROR_MESSAGE =
  'The password confirmation field and password field must match each other.'
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
    accountType: vine.enum(['consumer', 'vendor']).optional(),
    onboardingToken: vine
      .string()
      .uuid({ version: [4] })
      .optional(),
  })
)
registerValidator.messagesProvider = new SimpleMessagesProvider({
  'passwordConfirmation.confirmed': PASSWORD_ERROR_MESSAGE,
})

export const forgotPasswordValidator = vine.compile(vine.object({ email: vine.string().email() }))

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().minLength(1),
    password: vine.string().minLength(8).maxLength(255),
    passwordConfirmation: vine.string().confirmed({ confirmationField: 'password' }),
  })
)
resetPasswordValidator.messagesProvider = new SimpleMessagesProvider({
  'passwordConfirmation.confirmed': PASSWORD_ERROR_MESSAGE,
})

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string().minLength(1),
    password: vine.string().minLength(8).maxLength(255),
    passwordConfirmation: vine.string().confirmed({ confirmationField: 'password' }),
  })
)
changePasswordValidator.messagesProvider = new SimpleMessagesProvider({
  'passwordConfirmation.confirmed': PASSWORD_ERROR_MESSAGE,
})
