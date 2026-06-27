import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { getEmailSyncQueueDiagnostics } from '#services/email_sync_event_service'

export default class EmailSyncDiagnostics extends BaseCommand {
  static commandName = 'email:sync-diagnostics'
  static description = 'Report email sync SQS backlog and DLQ counts without reading message bodies'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const diagnostics = await getEmailSyncQueueDiagnostics()

    for (const queue of [diagnostics.main, diagnostics.dlq]) {
      if (!queue.configured) {
        this.logger.info(`Email sync ${queue.label} queue: not configured`)
        continue
      }

      this.logger.info(
        `Email sync ${queue.label} queue: ${queue.approximateVisible ?? 'unknown'} visible, ${queue.approximateNotVisible ?? 'unknown'} in-flight, ${queue.approximateDelayed ?? 'unknown'} delayed`
      )
    }
  }
}
