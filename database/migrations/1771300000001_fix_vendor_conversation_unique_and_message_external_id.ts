import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Allow one vendor conversation per (user, vendor) and track provider message id for idempotent sync.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('envoy_schema.vendor_conversations', (table) => {
      table.dropUnique(['user_id'])
      table.unique(['user_id', 'vendor_uuid'])
    })

    this.schema.alterTable('envoy_schema.messages', (table) => {
      table
        .string('provider_message_id', 256)
        .nullable()
        .unique()
        .comment('Gmail/Graph message id for idempotent sync')
    })
  }

  async down() {
    this.schema.alterTable('envoy_schema.messages', (table) => {
      table.dropColumn('provider_message_id')
    })

    this.schema.alterTable('envoy_schema.vendor_conversations', (table) => {
      table.dropUnique(['user_id', 'vendor_uuid'])
      table.unique(['user_id'])
    })
  }
}
