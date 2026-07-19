import { BaseSchema } from '@adonisjs/lucid/schema'

export default class WidenUserIdentityColumns extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.users
        ALTER COLUMN full_name TYPE text,
        ALTER COLUMN email TYPE text,
        ALTER COLUMN password TYPE text,
        ALTER COLUMN provider_id TYPE text;
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.users
        ALTER COLUMN full_name TYPE varchar(255),
        ALTER COLUMN email TYPE varchar(254),
        ALTER COLUMN password TYPE varchar(255),
        ALTER COLUMN provider_id TYPE varchar(255);
    `)
  }
}
