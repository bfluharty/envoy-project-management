import { BaseSchema } from '@adonisjs/lucid/schema'

export default class ProjectVendorsMapping extends BaseSchema {
  async up() {
    this.schema.createTable('envoy_schema.project_vendors', (table) => {
      table.increments('id').notNullable()
      table.string('project_uuid').notNullable().references('uuid').inTable('envoy_schema.projects')
      table.string('vendor_uuid').notNullable().references('uuid').inTable('envoy_schema.vendors')
      table.unique(['project_uuid', 'vendor_uuid'])
    })
    // Remove project_uuid from vendors table
    this.schema.table('envoy_schema.vendors', (table) => {
      table.dropColumn('project_uuid')
    })
  }

  async down() {
    // Add project_uuid back to vendors table
    this.schema.table('envoy_schema.vendors', (table) => {
      table.string('project_uuid').notNullable().references('uuid').inTable('envoy_schema.projects')
    })
    this.schema.dropTable('envoy_schema.project_vendors')
  }
}
