import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateProjectsPrompts extends BaseSchema {
  public async up() {
    this.schema.createTable('envoy_schema.projects_prompts', (table) => {
      table.increments('id').primary()
      table.uuid('uuid').notNullable().unique()
      table
        .uuid('project_uuid')
        .notNullable()
        .references('uuid')
        .inTable('envoy_schema.projects')
        .onDelete('CASCADE')
      table.string('agent_type', 32).notNullable()
      table.jsonb('data').notNullable()
      table
        .uuid('created_by_user_uuid')
        .nullable()
        .references('uuid')
        .inTable('envoy_schema.users')
        .onDelete('SET NULL')
      table
        .uuid('modified_by_user_uuid')
        .nullable()
        .references('uuid')
        .inTable('envoy_schema.users')
        .onDelete('SET NULL')
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['project_uuid'], 'projects_prompts_project_uuid_idx')
    })

    this.schema.raw(`
      ALTER TABLE envoy_schema.projects_prompts
      ADD CONSTRAINT projects_prompts_agent_type_check
      CHECK (agent_type IN ('PLANNING', 'OUTREACH'))
    `)

    this.schema.raw(`
      CREATE INDEX projects_prompts_project_agent_modified_idx
      ON envoy_schema.projects_prompts (project_uuid, agent_type, modified_timestamp DESC)
    `)
  }

  public async down() {
    this.schema.dropTable('envoy_schema.projects_prompts')
  }
}
