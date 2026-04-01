import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Stores the customer's inbox connection: we ask permission to access their
 * inbox (OAuth), store their token here, and use it to listen to their inbox
 * and respond to vendor emails on their behalf.
 */
export default class extends BaseSchema {
  protected tableName = 'envoy_schema.user_inbox_connections'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .string('user_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.users')
        .onDelete('CASCADE')
      table.string('provider', 32).notNullable().comment('e.g. gmail, microsoft')
      table.string('email', 254).notNullable().comment('inbox address')
      table.text('access_token').notNullable()
      table.text('refresh_token').nullable()
      table.timestamp('access_token_expires_at', { useTz: true }).nullable()
      table.string('scopes', 512).nullable().comment('granted OAuth scopes')
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table.unique(['user_uuid', 'provider', 'email'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
