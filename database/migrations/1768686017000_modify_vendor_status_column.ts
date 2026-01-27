import { BaseSchema } from '@adonisjs/lucid/schema'

export default class ModifyVendorStatusColumn extends BaseSchema {
  protected tableName = 'envoy_schema.vendors'
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('status_id', 'status')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('status', 'status_id')
    })
  }
}
