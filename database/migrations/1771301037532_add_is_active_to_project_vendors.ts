import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddIsActiveToProjectVendors extends BaseSchema {
  async up() {
    this.schema.alterTable('envoy_schema.project_vendors', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable('envoy_schema.project_vendors', (table) => {
      table.dropColumn('is_active')
    })
  }
}
