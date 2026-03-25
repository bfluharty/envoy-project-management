import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddUserUuidToVendorsAndEntitlementToUsers extends BaseSchema {
  protected tableVendors = { schema: 'envoy_schema', name: 'vendors' }

  public async up() {
    this.schema.withSchema(this.tableVendors.schema).alterTable(this.tableVendors.name, (table) => {
      table.string('user_uuid').index()
    })
    // Add foreign key constraint in a separate statement for compatibility
    this.schema.raw(
      `ALTER TABLE envoy_schema.vendors ADD CONSTRAINT vendors_user_uuid_foreign FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid)`
    )
  }

  public async down() {
    this.schema.raw(
      'ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_user_uuid_foreign'
    )
    this.schema.withSchema(this.tableVendors.schema).alterTable(this.tableVendors.name, (table) => {
      table.dropColumn('user_uuid')
    })
  }
}
