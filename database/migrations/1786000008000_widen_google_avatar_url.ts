import { BaseSchema } from '@adonisjs/lucid/schema'

export default class WidenGoogleAvatarUrl extends BaseSchema {
  protected tableName = 'envoy_schema.users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('google_avatar_url').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('google_avatar_url').nullable().alter()
    })
  }
}
