import { BaseSchema } from '@adonisjs/lucid/schema'

export default class UpdateCommunicationsAndMessages extends BaseSchema {
  protected communicationTable = 'envoy_schema.communications'
  protected messageTable = 'envoy_schema.messages'
  protected projectVendorTable = 'envoy_schema.project_vendors'

  public async up() {
    // Add UUID field to project vendor table
    this.schema.alterTable(this.projectVendorTable, (table) => {
      table.string('uuid').unique()
    })

    // Create communications table (renamed from vendor_conversations)
    this.schema.createTable(this.communicationTable, (table) => {
      table.increments('id').primary()
      table.string('uuid').notNullable().unique()
      table.string('channel').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table
        .string('project_vendor_uuid')
        .notNullable()
        .references('uuid')
        .inTable(this.projectVendorTable)
        .onDelete('CASCADE')
    })

    this.schema.dropTable(this.messageTable)
    this.schema.dropTable('envoy_schema.vendor_conversations')

    // Recreate vendor_conversations table (for inbox email threading per vendor/user)
    this.schema.createTable('envoy_schema.vendor_conversations', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('channel').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('envoy_schema.users')
        .onDelete('CASCADE')
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table
        .string('vendor_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.vendors')
        .onDelete('CASCADE')
      table.unique(['user_id', 'vendor_uuid'])
    })

    // Recreate messages table
    this.schema.createTable(this.messageTable, (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.text('body').notNullable()
      table.string('created_by').notNullable()
      table.string('subject').notNullable()
      table.string('from').notNullable()
      table.string('to').notNullable()
      table.string('cc').nullable()
      table.string('bcc').nullable()
      table.timestamp('sent_timestamp', { useTz: true }).notNullable()
      table
        .string('communication_uuid')
        .notNullable()
        .references('uuid')
        .inTable(this.communicationTable)
        .onDelete('CASCADE')
      table
        .string('provider_message_id', 256)
        .nullable()
        .unique()
        .comment('Gmail/Graph message id for idempotent sync')
      table.string('message_id_header', 512).nullable().comment('RFC Message-ID for In-Reply-To')
      table.text('references_header').nullable().comment('RFC References for threading')
      table
        .string('provider_thread_id', 256)
        .nullable()
        .comment('Gmail threadId for threading replies')
      table
        .string('vendor_conversation_uuid')
        .nullable()
        .references('uuid')
        .inTable('envoy_schema.vendor_conversations')
        .onDelete('SET NULL')
    })
  }

  public async down() {
    // Recreate vendor_conversations table
    this.schema.createTable('envoy_schema.vendor_conversations', (table) => {
      table.increments('id').primary()
      table.string('uuid').notNullable().unique()
      table.string('channel').notNullable()
      table.integer('user_id').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table
        .string('vendor_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.vendors')
        .onDelete('CASCADE')
    })

    // Drop communications table
    this.schema.dropTable(this.communicationTable)

    // Revert messages table
    this.schema.alterTable(this.messageTable, (table) => {
      table.string('created_by').notNullable()
      table.string('modified_by').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table
        .string('vendor_conversation_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.vendor_conversations')
        .onDelete('CASCADE')
      table.dropColumn('communication_uuid')
    })

    // Remove UUID field from project vendor table
    this.schema.alterTable(this.projectVendorTable, (table) => {
      table.dropColumn('uuid')
    })
  }
}
