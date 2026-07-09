import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import OnboardingDraftService from '#services/onboarding_draft_service'

export default class OnboardingExpireDrafts extends BaseCommand {
  static commandName = 'onboarding:expire-drafts'
  static description = 'Mark expired anonymous onboarding drafts as EXPIRED'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const expiredCount = await OnboardingDraftService.markExpiredDrafts()
    this.logger.info(`Expired ${expiredCount} anonymous onboarding draft(s)`)
  }
}
