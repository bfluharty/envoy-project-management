import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateProjectInsights extends BaseSchema {
  public async up() {
    this.schema.createTable('envoy_schema.project_insight_types', (table) => {
      table.increments('id').notNullable()
      table.string('code').notNullable().unique()
      table.string('name').notNullable()
      table.text('description').nullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    this.schema.createTable('envoy_schema.project_insight_statuses', (table) => {
      table.increments('id').notNullable()
      table.string('code').notNullable().unique()
      table.string('name').notNullable()
      table.text('description').nullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.boolean('is_active').notNullable().defaultTo(true)
    })

    this.schema.createTable('envoy_schema.project_insights', (table) => {
      table.increments('id').notNullable()
      table.string('uuid').notNullable().unique()
      table.string('project_uuid').notNullable().references('uuid').inTable('envoy_schema.projects')
      table
        .integer('insight_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('envoy_schema.project_insight_types')
      table
        .integer('status_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('envoy_schema.project_insight_statuses')
      table.text('insight_text').notNullable()
      table.specificType('importance', 'smallint').notNullable().defaultTo(3)
      table.decimal('confidence', 4, 3).nullable()
      table.string('supersedes_insight_uuid').nullable()
      table.string('superseded_by_insight_uuid').nullable()
      table.timestamp('created_timestamp', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('modified_timestamp', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(
        ['project_uuid', 'status_id', 'importance', 'modified_timestamp'],
        'project_insights_project_status_idx'
      )
      table.index(
        ['project_uuid', 'insight_type_id', 'status_id'],
        'project_insights_project_type_idx'
      )
      table.index(['modified_timestamp'], 'project_insights_modified_timestamp_idx')
    })

    this.schema.alterTable('envoy_schema.project_insight_types', (table) => {
      table.index(['code'], 'project_insight_types_code_idx')
    })

    this.schema.alterTable('envoy_schema.project_insight_statuses', (table) => {
      table.index(['code'], 'project_insight_statuses_code_idx')
    })

    this.schema.raw(`
      INSERT INTO envoy_schema.project_insight_types
        (code, name, description, created_timestamp, modified_timestamp, is_active)
      VALUES
        ('PROJECT_FACT', 'Project Fact', 'A factual detail about the project.', NOW(), NOW(), true),
        ('PROJECT_CONSTRAINT', 'Project Constraint', 'A hard or soft constraint that should affect future reasoning.', NOW(), NOW(), true),
        ('USER_PREFERENCE', 'User Preference', 'An explicitly stated user preference.', NOW(), NOW(), true),
        ('INFERRED_PREFERENCE', 'Inferred Preference', 'A preference inferred from user behavior or feedback.', NOW(), NOW(), true),
        ('VENDOR_DECISION', 'Vendor Decision', 'A decision related to vendor selection, rejection, or status.', NOW(), NOW(), true),
        ('OPEN_QUESTION', 'Open Question', 'An unresolved question or pending decision.', NOW(), NOW(), true),
        ('ACTION_RESULT', 'Action Result', 'A durable result from an executed action.', NOW(), NOW(), true),
        ('MODEL_RECOMMENDATION', 'Model Recommendation', 'A recommendation previously given by the model that remains relevant.', NOW(), NOW(), true),
        ('CORRECTION', 'Correction', 'A correction supplied by the user.', NOW(), NOW(), true),
        ('RISK_OR_BLOCKER', 'Risk or Blocker', 'A risk, blocker, warning, or dependency.', NOW(), NOW(), true)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        modified_timestamp = NOW(),
        is_active = true
    `)

    this.schema.raw(`
      INSERT INTO envoy_schema.project_insight_statuses
        (code, name, description, created_timestamp, modified_timestamp, is_active)
      VALUES
        ('ACTIVE', 'Active', 'Insight is currently valid and eligible for prompt injection.', NOW(), NOW(), true),
        ('SUPERSEDED', 'Superseded', 'Insight was replaced by newer information.', NOW(), NOW(), true),
        ('CONTRADICTED', 'Contradicted', 'Insight conflicts with newer information, but the correct value is uncertain.', NOW(), NOW(), true),
        ('ARCHIVED', 'Archived', 'Insight is retained but excluded from prompt injection.', NOW(), NOW(), true)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        modified_timestamp = NOW(),
        is_active = true
    `)
  }

  public async down() {
    this.schema.dropTable('envoy_schema.project_insights')
    this.schema.dropTable('envoy_schema.project_insight_statuses')
    this.schema.dropTable('envoy_schema.project_insight_types')
  }
}
