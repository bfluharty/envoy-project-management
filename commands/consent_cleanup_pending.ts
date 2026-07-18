import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import PendingConsentCleanupService from '#services/pending_consent_cleanup_service'

export default class ConsentCleanupPending extends BaseCommand {
  static commandName = 'consent:cleanup-pending'
  static description = 'Delete registrations that have not accepted Terms within 30 days'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const result = await PendingConsentCleanupService.cleanupWithLock()
    if (!result.lockAcquired) {
      this.logger.info('Pending consent cleanup skipped because another worker is running')
      return
    }
    this.logger.info(
      `Pending consent cleanup: ${result.checked} checked, ${result.deleted} deleted, ${result.failed} failed`
    )
  }
}
