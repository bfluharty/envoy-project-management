import { BaseSchema } from '@adonisjs/lucid/schema'

export default class HardenModelTrainingExtractionBoundary extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE envoy_schema.user_consent_preferences
        DROP CONSTRAINT IF EXISTS user_consent_preferences_training_metadata_check;

      ALTER TABLE envoy_schema.user_consent_preferences
        ADD CONSTRAINT user_consent_preferences_training_metadata_check
        CHECK (
          (terms_accepted = false
            AND model_training_opt_in = false
            AND model_training_notice_version IS NULL
            AND model_training_preference_updated_at IS NULL)
          OR
          (terms_accepted = true
            AND model_training_notice_version IS NOT NULL
            AND model_training_preference_updated_at IS NOT NULL)
        );

      CREATE VIEW envoy_schema.model_training_project_inputs
      WITH (security_barrier = true) AS
      SELECT
        'PROJECT_INPUTS'::text AS category,
        'PROJECT'::text AS source_type,
        projects.uuid AS record_uuid,
        projects.user_uuid AS owner_user_uuid,
        projects.created_timestamp AS occurred_at,
        jsonb_strip_nulls(jsonb_build_object(
          'title', projects.title,
          'description', projects.description,
          'startDate', projects.start_date,
          'endDate', projects.end_date,
          'deadline', projects.deadline,
          'budgetAmount', projects.budget_amount,
          'budgetCurrencyId', projects.budget_currency_id,
          'goals', projects.goals
        )) AS content
      FROM envoy_schema.projects AS projects
      JOIN envoy_schema.model_training_eligible_users AS eligible
        ON eligible.user_uuid = projects.user_uuid;

      CREATE VIEW envoy_schema.model_training_prompts_and_chats
      WITH (security_barrier = true) AS
      SELECT
        'ENVOY_PROMPTS_AND_CHATS'::text AS category,
        'CONVERSATION_USER_PROMPT'::text AS source_type,
        turns.uuid AS record_uuid,
        projects.user_uuid AS owner_user_uuid,
        turns.timestamp AS occurred_at,
        jsonb_build_object(
          'text', turns.contents ->> 'userPrompt',
          'agentId', turns.contents ->> 'agentId'
        ) AS content
      FROM envoy_schema.conversation_turns AS turns
      JOIN envoy_schema.conversations AS conversations
        ON conversations.uuid = turns.conversation_uuid
      JOIN envoy_schema.projects AS projects
        ON projects.uuid = conversations.project_uuid
      JOIN envoy_schema.model_training_eligible_users AS eligible
        ON eligible.user_uuid = projects.user_uuid
      WHERE NULLIF(trim(turns.contents ->> 'userPrompt'), '') IS NOT NULL;

      CREATE VIEW envoy_schema.model_training_generated_outputs
      WITH (security_barrier = true) AS
      SELECT
        'ENVOY_GENERATED_OUTPUTS'::text AS category,
        'CONVERSATION_MODEL_RESPONSE'::text AS source_type,
        turns.uuid AS record_uuid,
        projects.user_uuid AS owner_user_uuid,
        turns.timestamp AS occurred_at,
        jsonb_build_object(
          'text', turns.contents ->> 'modelResponse',
          'agentId', turns.contents ->> 'agentId'
        ) AS content
      FROM envoy_schema.conversation_turns AS turns
      JOIN envoy_schema.conversations AS conversations
        ON conversations.uuid = turns.conversation_uuid
      JOIN envoy_schema.projects AS projects
        ON projects.uuid = conversations.project_uuid
      JOIN envoy_schema.model_training_eligible_users AS eligible
        ON eligible.user_uuid = projects.user_uuid
      WHERE NULLIF(trim(turns.contents ->> 'modelResponse'), '') IS NOT NULL

      UNION ALL

      SELECT
        'ENVOY_GENERATED_OUTPUTS'::text AS category,
        'PROJECT_PROMPT_OUTPUT'::text AS source_type,
        prompts.uuid AS record_uuid,
        projects.user_uuid AS owner_user_uuid,
        prompts.created_timestamp AS occurred_at,
        jsonb_build_object(
          'agentType', prompts.agent_type,
          'data', prompts.data
        ) AS content
      FROM envoy_schema.projects_prompts AS prompts
      JOIN envoy_schema.projects AS projects
        ON projects.uuid = prompts.project_uuid
      JOIN envoy_schema.model_training_eligible_users AS eligible
        ON eligible.user_uuid = projects.user_uuid

      UNION ALL

      SELECT
        'ENVOY_GENERATED_OUTPUTS'::text AS category,
        'PROJECT_INSIGHT'::text AS source_type,
        insights.uuid AS record_uuid,
        projects.user_uuid AS owner_user_uuid,
        insights.created_timestamp AS occurred_at,
        jsonb_strip_nulls(jsonb_build_object(
          'text', insights.insight_text,
          'importance', insights.importance,
          'confidence', insights.confidence
        )) AS content
      FROM envoy_schema.project_insights AS insights
      JOIN envoy_schema.projects AS projects
        ON projects.uuid = insights.project_uuid
      JOIN envoy_schema.model_training_eligible_users AS eligible
        ON eligible.user_uuid = projects.user_uuid;

      CREATE VIEW envoy_schema.model_training_product_feedback
      WITH (security_barrier = true) AS
      SELECT
        'PRODUCT_FEEDBACK'::text AS category,
        NULL::text AS source_type,
        NULL::uuid AS record_uuid,
        NULL::uuid AS owner_user_uuid,
        NULL::timestamptz AS occurred_at,
        NULL::jsonb AS content
      WHERE false;

      CREATE VIEW envoy_schema.model_training_deidentified_product_signals
      WITH (security_barrier = true) AS
      SELECT
        'DEIDENTIFIED_PRODUCT_SIGNALS'::text AS category,
        NULL::text AS source_type,
        NULL::uuid AS record_uuid,
        NULL::uuid AS owner_user_uuid,
        NULL::timestamptz AS occurred_at,
        NULL::jsonb AS content
      WHERE false;
    `)
  }

  async down() {
    this.schema.raw(`
      DROP VIEW IF EXISTS envoy_schema.model_training_deidentified_product_signals;
      DROP VIEW IF EXISTS envoy_schema.model_training_product_feedback;
      DROP VIEW IF EXISTS envoy_schema.model_training_generated_outputs;
      DROP VIEW IF EXISTS envoy_schema.model_training_prompts_and_chats;
      DROP VIEW IF EXISTS envoy_schema.model_training_project_inputs;

      ALTER TABLE envoy_schema.user_consent_preferences
        DROP CONSTRAINT IF EXISTS user_consent_preferences_training_metadata_check;

      ALTER TABLE envoy_schema.user_consent_preferences
        ADD CONSTRAINT user_consent_preferences_training_metadata_check
        CHECK (
          (terms_accepted = false
            AND model_training_opt_in = false
            AND model_training_notice_version IS NULL
            AND model_training_preference_updated_at IS NULL)
          OR
          (terms_accepted = true
            AND model_training_notice_version IS NOT NULL
            AND model_training_preference_updated_at IS NOT NULL)
        );
    `)
  }
}
