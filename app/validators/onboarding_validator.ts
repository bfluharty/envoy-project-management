import vine from '@vinejs/vine'

const onboardingToken = () => vine.string().uuid({ version: [4] })

export const restoreOnboardingDraftValidator = vine.compile(
  vine.object({
    onboardingToken: onboardingToken(),
  })
)

export const vendorSelectionValidator = vine.compile(
  vine.object({
    onboardingToken: onboardingToken(),
    selectedCandidateIds: vine.array(vine.string().trim().minLength(1)).minLength(1).maxLength(8),
  })
)

export const registrationHandoffValidator = vine.compile(
  vine.object({
    onboardingToken: onboardingToken(),
  })
)
