import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddEntitlementToUsers extends BaseSchema {
  protected tableName = 'envoy_schema.users'

  public async up() {
    // Create user_entitlements table
    this.schema.createTable('envoy_schema.user_entitlements', (table) => {
      table.increments('id').notNullable()
      table.string('title').notNullable().unique()
      table.string('canonical_name').notNullable().unique()
      table.string('created_by').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.string('modified_by').notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
    })
  }

  public async down() {
    this.schema.dropTableIfExists('envoy_schema.user_entitlements')
  }
}
