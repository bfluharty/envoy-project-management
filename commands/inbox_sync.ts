import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { syncAllConnections } from '#services/inbox_sync_service'

export default class InboxSyncCommand extends BaseCommand {
  static commandName = 'inbox:sync'
  static description =
    'Sync all connected inboxes: fetch new vendor emails and create Message records'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const { connections, totalCreated } = await syncAllConnections()
    this.logger.info(`Inbox sync: ${connections} connection(s), ${totalCreated} new message(s)`)
  }
}
