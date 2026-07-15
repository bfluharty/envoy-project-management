import vine from '@vinejs/vine'

export const completeUserConsentValidator = vine.compile(
  vine.object({
    termsAccepted: vine.boolean({ strict: true }),
    modelTrainingOptIn: vine.boolean({ strict: true }),
  })
)

export const updateDataPreferencesValidator = vine.compile(
  vine.object({
    modelTrainingOptIn: vine.boolean({ strict: true }),
  })
)
