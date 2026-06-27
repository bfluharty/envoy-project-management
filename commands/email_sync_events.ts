import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { processEmailSyncQueue } from '#services/email_sync_event_service'

export default class EmailSyncEvents extends BaseCommand {
  static commandName = 'email:sync-events'
  static description = 'Process queued email provider sync events from SQS'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const result = await processEmailSyncQueue()
    this.logger.info(
      `Email sync events: ${result.received} received, ${result.deleted} deleted, ${result.failed} failed, ${result.invalid} invalid, ${result.processed} processed, ${result.created} created`
    )
  }
}
