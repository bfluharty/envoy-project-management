import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddOutreachDraftsAndProjectScopedThreads extends BaseSchema {
  public async up() {
    this.schema.alterTable('envoy_schema.vendor_conversations', (table) => {
      table
        .string('project_vendor_uuid')
        .nullable()
        .references('uuid')
        .inTable('envoy_schema.project_vendors')
        .onDelete('CASCADE')

      // Replace one-conversation-per-vendor behavior with project-scoped, multi-thread conversations.
      table.dropUnique(['user_id', 'vendor_uuid'])
    })

    this.schema.alterTable('envoy_schema.vendor_conversations', (table) => {
      table.index(
        ['project_vendor_uuid', 'created_timestamp'],
        'vendor_conversations_project_vendor_created_idx'
      )
    })

    this.schema.alterTable('envoy_schema.messages', (table) => {
      table.string('direction', 16).notNullable().defaultTo('outbound')
      table.index(
        ['vendor_conversation_uuid', 'sent_timestamp'],
        'messages_vendor_conversation_sent_timestamp_idx'
      )
    })

    this.schema.createTable('envoy_schema.outreach_drafts', (table) => {
      table.increments('id').primary()
      table.string('uuid').notNullable().unique()
      table
        .string('project_vendor_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.project_vendors')
        .onDelete('CASCADE')
      table
        .string('vendor_conversation_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.vendor_conversations')
        .onDelete('CASCADE')
      table.text('subject').notNullable()
      table.text('body').notNullable()
      table.string('status', 32).notNullable().defaultTo('draft')
      table.timestamp('sent_timestamp', { useTz: true }).nullable()
      table
        .string('sent_message_uuid')
        .nullable()
        .references('uuid')
        .inTable('envoy_schema.messages')
        .onDelete('SET NULL')
      table.text('last_error').nullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().defaultTo(this.now())

      // One active draft per thread, but allow multiple drafts across threads for the same contact.
      table.unique(['vendor_conversation_uuid'], 'outreach_drafts_vendor_conversation_uuid_unique')
      table.index(
        ['project_vendor_uuid', 'vendor_conversation_uuid'],
        'outreach_drafts_project_vendor_thread_idx'
      )
    })
  }

  public async down() {
    this.schema.dropTable('envoy_schema.outreach_drafts')

    this.schema.alterTable('envoy_schema.messages', (table) => {
      table.dropIndex(
        ['vendor_conversation_uuid', 'sent_timestamp'],
        'messages_vendor_conversation_sent_timestamp_idx'
      )
      table.dropColumn('direction')
    })

    this.schema.alterTable('envoy_schema.vendor_conversations', (table) => {
      table.dropIndex(
        ['project_vendor_uuid', 'created_timestamp'],
        'vendor_conversations_project_vendor_created_idx'
      )
      table.dropColumn('project_vendor_uuid')
      table.unique(['user_id', 'vendor_uuid'])
    })
  }
}
