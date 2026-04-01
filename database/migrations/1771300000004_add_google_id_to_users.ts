import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddGoogleIdToUsers extends BaseSchema {
  protected tableName = 'envoy_schema.users'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('google_id').nullable().unique()
      table.string('password', 255).nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('google_id')
      table.string('password', 255).notNullable().alter()
    })
  }
}
