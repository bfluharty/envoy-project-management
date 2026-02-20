import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MoveVendorStatusToProjectVendor extends BaseSchema {
  protected tableVendor = 'envoy_schema.vendors'
  protected tableProjectVendor = 'envoy_schema.project_vendors'

  public async up() {
    this.schema.alterTable(this.tableProjectVendor, (table) => {
      table
        .integer('status')
        .unsigned()
        .references('id')
        .inTable('envoy_schema.vendor_statuses')
        .notNullable()
        .defaultTo(1)
    })
    this.schema.alterTable(this.tableVendor, (table) => {
      table.dropColumn('status')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableVendor, (table) => {
      table
        .integer('status')
        .unsigned()
        .references('id')
        .inTable('envoy_schema.vendor_statuses')
        .notNullable()
        .defaultTo(1)
    })
    this.schema.alterTable(this.tableProjectVendor, (table) => {
      table.dropColumn('status')
    })
  }
}
