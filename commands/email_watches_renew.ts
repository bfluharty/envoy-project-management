import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { renewDueEmailWatches } from '#services/email_watch_service'

export default class EmailWatchesRenew extends BaseCommand {
  static commandName = 'email:watches:renew'
  static description = 'Renew due email provider watches and subscriptions'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const result = await renewDueEmailWatches()
    this.logger.info(
      `Email watch renewal: ${result.checked} due, ${result.renewed} renewed, ${result.failed} failed`
    )
  }
}
