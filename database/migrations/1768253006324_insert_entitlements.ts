import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddEntitlementToUsers extends BaseSchema {
  protected tableName = 'envoy_schema.users'

  public async up() {
    // Insert USER and ADMIN entitlements
    this.defer(async () => {
      await this.db.table('envoy_schema.user_entitlements').insert([
        {
          title: 'User',
          canonical_name: 'USER',
          created_by: 'system',
          created_timestamp: new Date(),
          modified_by: 'system',
          modified_timestamp: new Date(),
          is_active: true,
        },
        {
          title: 'Admin',
          canonical_name: 'ADMIN',
          created_by: 'system',
          created_timestamp: new Date(),
          modified_by: 'system',
          modified_timestamp: new Date(),
          is_active: true,
        },
      ])
    })

    // Add entitlement_id column to users table
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('entitlement')
        .unsigned()
        .notNullable()
        .defaultTo(1)
        .references('id')
        .inTable('envoy_schema.user_entitlements')
        .onDelete('RESTRICT')
    })
  }

  public async down() {
    this.defer(async () => {
      await this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('entitlement')
      })

      await this.db
        .from('envoy_schema.user_entitlements')
        .whereIn('canonical_name', ['USER', 'ADMIN'])
        .delete()
    })
  }
}
