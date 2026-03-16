import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Store Gmail thread ID so replies can be sent in the same thread via Gmail API.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('envoy_schema.messages', (table) => {
      table
        .string('provider_thread_id', 256)
        .nullable()
        .comment('Gmail threadId for threading replies')
    })
  }

  async down() {
    this.schema.alterTable('envoy_schema.messages', (table) => {
      table.dropColumn('provider_thread_id')
    })
  }
}
