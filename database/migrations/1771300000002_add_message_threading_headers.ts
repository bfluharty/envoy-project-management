import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Store RFC Message-ID and References for reply threading (In-Reply-To, References).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('envoy_schema.messages', (table) => {
      table.string('message_id_header', 512).nullable().comment('RFC Message-ID for In-Reply-To')
      table.text('references_header').nullable().comment('RFC References for threading')
    })
  }

  async down() {
    this.schema.alterTable('envoy_schema.messages', (table) => {
      table.dropColumn('message_id_header')
      table.dropColumn('references_header')
    })
  }
}
