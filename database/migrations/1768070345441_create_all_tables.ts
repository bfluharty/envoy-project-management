import { BaseSchema } from '@adonisjs/lucid/schema'

export default class EnvoySchema extends BaseSchema {
  async up() {
    // Create schema if it doesn't exist
    this.schema.raw('CREATE SCHEMA IF NOT EXISTS envoy_schema')
    // Users
    this.schema.createTable('envoy_schema.users', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('full_name').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('password').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    // Currency
    this.schema.createTable('envoy_schema.currencies', (table) => {
      table.increments('id').notNullable()
      table.string('code').notNullable().unique()
      table.string('name').notNullable()
      table.string('symbol').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    // Vendor Status
    this.schema.createTable('envoy_schema.vendor_statuses', (table) => {
      table.increments('id').notNullable()
      table.string('title').notNullable().unique()
      table.string('canonical_name').notNullable().unique()
      table.string('created_by').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.string('modified_by').notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    // Projects
    this.schema.createTable('envoy_schema.projects', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('title').notNullable()
      table.text('description').nullable()
      table.jsonb('location').nullable()
      table.date('start_date').nullable()
      table.date('end_date').nullable()
      table.date('deadline').nullable()
      table.decimal('budget_amount', 15, 2).nullable()
      table
        .integer('budget_currency_id')
        .unsigned()
        .references('id')
        .inTable('envoy_schema.currencies')
        .nullable()
      table.string('goals').nullable()
      table.string('user_uuid').notNullable().references('uuid').inTable('envoy_schema.users')
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    // Vendor
    this.schema.createTable('envoy_schema.vendors', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('name').notNullable().unique()
      table.string('email').notNullable().unique()
      table.string('created_by').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.string('modified_by').notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table
        .integer('status_id')
        .unsigned()
        .references('id')
        .inTable('envoy_schema.vendor_statuses')
        .notNullable()
      table.string('project_uuid').notNullable().references('uuid').inTable('envoy_schema.projects')
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    // Conversations
    this.schema.createTable('envoy_schema.conversations', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.timestamp('timestamp', { useTz: true }).notNullable()
      table.string('project_uuid').notNullable().references('uuid').inTable('envoy_schema.projects')
    })

    // Conversation Turns
    this.schema.createTable('envoy_schema.conversation_turns', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.timestamp('timestamp', { useTz: true }).notNullable()
      table.jsonb('contents').notNullable()
      table
        .string('conversation_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.conversations')
    })

    // Vendor Conversations
    this.schema.createTable('envoy_schema.vendor_conversations', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('channel').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('envoy_schema.users')
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.string('vendor_uuid').notNullable().references('uuid').inTable('envoy_schema.vendors')
    })

    // Messages
    this.schema.createTable('envoy_schema.messages', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.text('body').notNullable()
      table.string('created_by').notNullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable()
      table.string('modified_by').notNullable()
      table.timestamp('modified_timestamp', { useTz: true }).notNullable()
      table.string('subject').notNullable()
      table.string('from').notNullable()
      table.string('to').notNullable()
      table.string('cc').nullable()
      table.string('bcc').nullable()
      table.timestamp('sent_timestamp', { useTz: true }).notNullable()
      table
        .string('vendor_conversation_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.vendor_conversations')
    })
  }

  async down() {
    this.schema.dropTable('envoy_schema.messages')
    this.schema.dropTable('envoy_schema.vendor_conversations')
    this.schema.dropTable('envoy_schema.conversation_turns')
    this.schema.dropTable('envoy_schema.conversations')
    this.schema.dropTable('envoy_schema.vendors')
    this.schema.dropTable('envoy_schema.projects')
    this.schema.dropTable('envoy_schema.vendor_statuses')
    this.schema.dropTable('envoy_schema.currencies')
    this.schema.dropTable('envoy_schema.users')
  }
}
