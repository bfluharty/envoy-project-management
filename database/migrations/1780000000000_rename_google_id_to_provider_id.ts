import { BaseSchema } from '@adonisjs/lucid/schema'

export default class RenameGoogleIdToProviderId extends BaseSchema {
  protected tableName = 'envoy_schema.users'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('google_id', 'provider_id')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('provider_id', 'google_id')
    })
  }
}
