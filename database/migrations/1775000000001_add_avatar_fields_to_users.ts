import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'envoy_schema.users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('google_avatar_url').nullable()
      table.string('uploaded_avatar_path').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('google_avatar_url')
      table.dropColumn('uploaded_avatar_path')
    })
  }
}
