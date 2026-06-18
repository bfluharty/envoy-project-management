import { BaseSchema } from '@adonisjs/lucid/schema'

export default class ConvertUuidColumnsToUuid extends BaseSchema {
  public async up() {
    this.schema.raw(`
      DO $$
      DECLARE
        uuid_fk record;
      BEGIN
        FOR uuid_fk IN
          SELECT conrelid::regclass::text AS table_name, conname
          FROM pg_constraint
          WHERE connamespace = 'envoy_schema'::regnamespace
            AND contype = 'f'
            AND pg_get_constraintdef(oid) ILIKE '%uuid%'
        LOOP
          EXECUTE format(
            'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
            uuid_fk.table_name,
            uuid_fk.conname
          );
        END LOOP;
      END $$;

      ALTER TABLE envoy_schema.projects DROP CONSTRAINT IF EXISTS projects_user_uuid_foreign;
      ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_user_uuid_foreign;
      ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_vendor_listing_uuid_foreign;
      ALTER TABLE envoy_schema.conversations DROP CONSTRAINT IF EXISTS conversations_project_uuid_foreign;
      ALTER TABLE envoy_schema.conversation_turns DROP CONSTRAINT IF EXISTS conversation_turns_conversation_uuid_foreign;
      ALTER TABLE envoy_schema.project_vendors DROP CONSTRAINT IF EXISTS project_vendors_project_uuid_foreign;
      ALTER TABLE envoy_schema.project_vendors DROP CONSTRAINT IF EXISTS project_vendors_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.user_inbox_connections DROP CONSTRAINT IF EXISTS user_inbox_connections_user_uuid_foreign;
      ALTER TABLE envoy_schema.password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_uuid_foreign;
      ALTER TABLE envoy_schema.communications DROP CONSTRAINT IF EXISTS communications_project_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.vendor_conversations DROP CONSTRAINT IF EXISTS vendor_conversations_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.vendor_conversations DROP CONSTRAINT IF EXISTS vendor_conversations_project_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.messages DROP CONSTRAINT IF EXISTS messages_communication_uuid_foreign;
      ALTER TABLE envoy_schema.messages DROP CONSTRAINT IF EXISTS messages_vendor_conversation_uuid_foreign;
      ALTER TABLE envoy_schema.outreach_drafts DROP CONSTRAINT IF EXISTS outreach_drafts_project_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.outreach_drafts DROP CONSTRAINT IF EXISTS outreach_drafts_vendor_conversation_uuid_foreign;
      ALTER TABLE envoy_schema.outreach_drafts DROP CONSTRAINT IF EXISTS outreach_drafts_sent_message_uuid_foreign;
      ALTER TABLE envoy_schema.project_insights DROP CONSTRAINT IF EXISTS project_insights_project_uuid_foreign;

      CREATE TEMP TABLE IF NOT EXISTS invalid_vendor_conversation_uuid_map (
        old_uuid text PRIMARY KEY,
        new_uuid text NOT NULL UNIQUE
      ) ON COMMIT DROP;

      INSERT INTO invalid_vendor_conversation_uuid_map (old_uuid, new_uuid)
      SELECT
        uuid,
        concat(
          substr(md5(uuid), 1, 8),
          '-',
          substr(md5(uuid), 9, 4),
          '-',
          substr(md5(uuid), 13, 4),
          '-',
          substr(md5(uuid), 17, 4),
          '-',
          substr(md5(uuid), 21, 12)
        )
      FROM envoy_schema.vendor_conversations
      WHERE uuid IS NOT NULL
        AND uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ON CONFLICT (old_uuid) DO NOTHING;

      UPDATE envoy_schema.outreach_drafts drafts
      SET vendor_conversation_uuid = mapped.new_uuid
      FROM invalid_vendor_conversation_uuid_map mapped
      WHERE drafts.vendor_conversation_uuid = mapped.old_uuid;

      UPDATE envoy_schema.messages messages
      SET vendor_conversation_uuid = mapped.new_uuid
      FROM invalid_vendor_conversation_uuid_map mapped
      WHERE messages.vendor_conversation_uuid = mapped.old_uuid;

      UPDATE envoy_schema.vendor_conversations conversations
      SET uuid = mapped.new_uuid
      FROM invalid_vendor_conversation_uuid_map mapped
      WHERE conversations.uuid = mapped.old_uuid;

      ALTER TABLE envoy_schema.users ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.projects ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.projects ALTER COLUMN user_uuid TYPE uuid USING user_uuid::uuid;
      ALTER TABLE envoy_schema.vendors ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.vendors ALTER COLUMN user_uuid TYPE uuid USING user_uuid::uuid;
      ALTER TABLE envoy_schema.vendors ALTER COLUMN vendor_listing_uuid TYPE uuid USING vendor_listing_uuid::uuid;
      ALTER TABLE envoy_schema.conversations ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.conversations ALTER COLUMN project_uuid TYPE uuid USING project_uuid::uuid;
      ALTER TABLE envoy_schema.conversation_turns ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.conversation_turns ALTER COLUMN conversation_uuid TYPE uuid USING conversation_uuid::uuid;
      ALTER TABLE envoy_schema.project_vendors ALTER COLUMN project_uuid TYPE uuid USING project_uuid::uuid;
      ALTER TABLE envoy_schema.project_vendors ALTER COLUMN vendor_uuid TYPE uuid USING vendor_uuid::uuid;
      ALTER TABLE envoy_schema.project_vendors ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.user_inbox_connections ALTER COLUMN user_uuid TYPE uuid USING user_uuid::uuid;
      ALTER TABLE envoy_schema.password_reset_tokens ALTER COLUMN user_uuid TYPE uuid USING user_uuid::uuid;
      ALTER TABLE envoy_schema.communications ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.communications ALTER COLUMN project_vendor_uuid TYPE uuid USING project_vendor_uuid::uuid;
      ALTER TABLE envoy_schema.vendor_conversations ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.vendor_conversations ALTER COLUMN vendor_uuid TYPE uuid USING vendor_uuid::uuid;
      ALTER TABLE envoy_schema.vendor_conversations ALTER COLUMN project_vendor_uuid TYPE uuid USING project_vendor_uuid::uuid;
      ALTER TABLE envoy_schema.messages ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.messages ALTER COLUMN communication_uuid TYPE uuid USING communication_uuid::uuid;
      ALTER TABLE envoy_schema.messages ALTER COLUMN vendor_conversation_uuid TYPE uuid USING vendor_conversation_uuid::uuid;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN project_vendor_uuid TYPE uuid USING project_vendor_uuid::uuid;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN vendor_conversation_uuid TYPE uuid USING vendor_conversation_uuid::uuid;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN sent_message_uuid TYPE uuid USING sent_message_uuid::uuid;
      ALTER TABLE envoy_schema.vendor_listings ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN uuid TYPE uuid USING uuid::uuid;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN project_uuid TYPE uuid USING project_uuid::uuid;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN supersedes_insight_uuid TYPE uuid USING supersedes_insight_uuid::uuid;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN superseded_by_insight_uuid TYPE uuid USING superseded_by_insight_uuid::uuid;

      ALTER TABLE envoy_schema.projects
        ADD CONSTRAINT projects_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid);
      ALTER TABLE envoy_schema.vendors
        ADD CONSTRAINT vendors_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid);
      ALTER TABLE envoy_schema.vendors
        ADD CONSTRAINT vendors_vendor_listing_uuid_foreign
        FOREIGN KEY (vendor_listing_uuid) REFERENCES envoy_schema.vendor_listings(uuid);
      ALTER TABLE envoy_schema.conversations
        ADD CONSTRAINT conversations_project_uuid_foreign
        FOREIGN KEY (project_uuid) REFERENCES envoy_schema.projects(uuid);
      ALTER TABLE envoy_schema.conversation_turns
        ADD CONSTRAINT conversation_turns_conversation_uuid_foreign
        FOREIGN KEY (conversation_uuid) REFERENCES envoy_schema.conversations(uuid);
      ALTER TABLE envoy_schema.project_vendors
        ADD CONSTRAINT project_vendors_project_uuid_foreign
        FOREIGN KEY (project_uuid) REFERENCES envoy_schema.projects(uuid);
      ALTER TABLE envoy_schema.project_vendors
        ADD CONSTRAINT project_vendors_vendor_uuid_foreign
        FOREIGN KEY (vendor_uuid) REFERENCES envoy_schema.vendors(uuid);
      ALTER TABLE envoy_schema.user_inbox_connections
        ADD CONSTRAINT user_inbox_connections_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.password_reset_tokens
        ADD CONSTRAINT password_reset_tokens_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.communications
        ADD CONSTRAINT communications_project_vendor_uuid_foreign
        FOREIGN KEY (project_vendor_uuid) REFERENCES envoy_schema.project_vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.vendor_conversations
        ADD CONSTRAINT vendor_conversations_vendor_uuid_foreign
        FOREIGN KEY (vendor_uuid) REFERENCES envoy_schema.vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.vendor_conversations
        ADD CONSTRAINT vendor_conversations_project_vendor_uuid_foreign
        FOREIGN KEY (project_vendor_uuid) REFERENCES envoy_schema.project_vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.messages
        ADD CONSTRAINT messages_communication_uuid_foreign
        FOREIGN KEY (communication_uuid) REFERENCES envoy_schema.communications(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.messages
        ADD CONSTRAINT messages_vendor_conversation_uuid_foreign
        FOREIGN KEY (vendor_conversation_uuid) REFERENCES envoy_schema.vendor_conversations(uuid) ON DELETE SET NULL;
      ALTER TABLE envoy_schema.outreach_drafts
        ADD CONSTRAINT outreach_drafts_project_vendor_uuid_foreign
        FOREIGN KEY (project_vendor_uuid) REFERENCES envoy_schema.project_vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.outreach_drafts
        ADD CONSTRAINT outreach_drafts_vendor_conversation_uuid_foreign
        FOREIGN KEY (vendor_conversation_uuid) REFERENCES envoy_schema.vendor_conversations(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.outreach_drafts
        ADD CONSTRAINT outreach_drafts_sent_message_uuid_foreign
        FOREIGN KEY (sent_message_uuid) REFERENCES envoy_schema.messages(uuid) ON DELETE SET NULL;
      ALTER TABLE envoy_schema.project_insights
        ADD CONSTRAINT project_insights_project_uuid_foreign
        FOREIGN KEY (project_uuid) REFERENCES envoy_schema.projects(uuid);
    `)
  }

  public async down() {
    this.schema.raw(`
      DO $$
      DECLARE
        uuid_fk record;
      BEGIN
        FOR uuid_fk IN
          SELECT conrelid::regclass::text AS table_name, conname
          FROM pg_constraint
          WHERE connamespace = 'envoy_schema'::regnamespace
            AND contype = 'f'
            AND pg_get_constraintdef(oid) ILIKE '%uuid%'
        LOOP
          EXECUTE format(
            'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
            uuid_fk.table_name,
            uuid_fk.conname
          );
        END LOOP;
      END $$;

      ALTER TABLE envoy_schema.projects DROP CONSTRAINT IF EXISTS projects_user_uuid_foreign;
      ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_user_uuid_foreign;
      ALTER TABLE envoy_schema.vendors DROP CONSTRAINT IF EXISTS vendors_vendor_listing_uuid_foreign;
      ALTER TABLE envoy_schema.conversations DROP CONSTRAINT IF EXISTS conversations_project_uuid_foreign;
      ALTER TABLE envoy_schema.conversation_turns DROP CONSTRAINT IF EXISTS conversation_turns_conversation_uuid_foreign;
      ALTER TABLE envoy_schema.project_vendors DROP CONSTRAINT IF EXISTS project_vendors_project_uuid_foreign;
      ALTER TABLE envoy_schema.project_vendors DROP CONSTRAINT IF EXISTS project_vendors_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.user_inbox_connections DROP CONSTRAINT IF EXISTS user_inbox_connections_user_uuid_foreign;
      ALTER TABLE envoy_schema.password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_uuid_foreign;
      ALTER TABLE envoy_schema.communications DROP CONSTRAINT IF EXISTS communications_project_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.vendor_conversations DROP CONSTRAINT IF EXISTS vendor_conversations_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.vendor_conversations DROP CONSTRAINT IF EXISTS vendor_conversations_project_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.messages DROP CONSTRAINT IF EXISTS messages_communication_uuid_foreign;
      ALTER TABLE envoy_schema.messages DROP CONSTRAINT IF EXISTS messages_vendor_conversation_uuid_foreign;
      ALTER TABLE envoy_schema.outreach_drafts DROP CONSTRAINT IF EXISTS outreach_drafts_project_vendor_uuid_foreign;
      ALTER TABLE envoy_schema.outreach_drafts DROP CONSTRAINT IF EXISTS outreach_drafts_vendor_conversation_uuid_foreign;
      ALTER TABLE envoy_schema.outreach_drafts DROP CONSTRAINT IF EXISTS outreach_drafts_sent_message_uuid_foreign;
      ALTER TABLE envoy_schema.project_insights DROP CONSTRAINT IF EXISTS project_insights_project_uuid_foreign;

      ALTER TABLE envoy_schema.users ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.projects ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.projects ALTER COLUMN user_uuid TYPE varchar(255) USING user_uuid::text;
      ALTER TABLE envoy_schema.vendors ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.vendors ALTER COLUMN user_uuid TYPE varchar(255) USING user_uuid::text;
      ALTER TABLE envoy_schema.vendors ALTER COLUMN vendor_listing_uuid TYPE varchar(255) USING vendor_listing_uuid::text;
      ALTER TABLE envoy_schema.conversations ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.conversations ALTER COLUMN project_uuid TYPE varchar(255) USING project_uuid::text;
      ALTER TABLE envoy_schema.conversation_turns ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.conversation_turns ALTER COLUMN conversation_uuid TYPE varchar(255) USING conversation_uuid::text;
      ALTER TABLE envoy_schema.project_vendors ALTER COLUMN project_uuid TYPE varchar(255) USING project_uuid::text;
      ALTER TABLE envoy_schema.project_vendors ALTER COLUMN vendor_uuid TYPE varchar(255) USING vendor_uuid::text;
      ALTER TABLE envoy_schema.project_vendors ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.user_inbox_connections ALTER COLUMN user_uuid TYPE varchar(255) USING user_uuid::text;
      ALTER TABLE envoy_schema.password_reset_tokens ALTER COLUMN user_uuid TYPE varchar(255) USING user_uuid::text;
      ALTER TABLE envoy_schema.communications ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.communications ALTER COLUMN project_vendor_uuid TYPE varchar(255) USING project_vendor_uuid::text;
      ALTER TABLE envoy_schema.vendor_conversations ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.vendor_conversations ALTER COLUMN vendor_uuid TYPE varchar(255) USING vendor_uuid::text;
      ALTER TABLE envoy_schema.vendor_conversations ALTER COLUMN project_vendor_uuid TYPE varchar(255) USING project_vendor_uuid::text;
      ALTER TABLE envoy_schema.messages ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.messages ALTER COLUMN communication_uuid TYPE varchar(255) USING communication_uuid::text;
      ALTER TABLE envoy_schema.messages ALTER COLUMN vendor_conversation_uuid TYPE varchar(255) USING vendor_conversation_uuid::text;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN project_vendor_uuid TYPE varchar(255) USING project_vendor_uuid::text;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN vendor_conversation_uuid TYPE varchar(255) USING vendor_conversation_uuid::text;
      ALTER TABLE envoy_schema.outreach_drafts ALTER COLUMN sent_message_uuid TYPE varchar(255) USING sent_message_uuid::text;
      ALTER TABLE envoy_schema.vendor_listings ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN uuid TYPE varchar(255) USING uuid::text;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN project_uuid TYPE varchar(255) USING project_uuid::text;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN supersedes_insight_uuid TYPE varchar(255) USING supersedes_insight_uuid::text;
      ALTER TABLE envoy_schema.project_insights ALTER COLUMN superseded_by_insight_uuid TYPE varchar(255) USING superseded_by_insight_uuid::text;

      ALTER TABLE envoy_schema.projects
        ADD CONSTRAINT projects_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid);
      ALTER TABLE envoy_schema.vendors
        ADD CONSTRAINT vendors_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid);
      ALTER TABLE envoy_schema.vendors
        ADD CONSTRAINT vendors_vendor_listing_uuid_foreign
        FOREIGN KEY (vendor_listing_uuid) REFERENCES envoy_schema.vendor_listings(uuid);
      ALTER TABLE envoy_schema.conversations
        ADD CONSTRAINT conversations_project_uuid_foreign
        FOREIGN KEY (project_uuid) REFERENCES envoy_schema.projects(uuid);
      ALTER TABLE envoy_schema.conversation_turns
        ADD CONSTRAINT conversation_turns_conversation_uuid_foreign
        FOREIGN KEY (conversation_uuid) REFERENCES envoy_schema.conversations(uuid);
      ALTER TABLE envoy_schema.project_vendors
        ADD CONSTRAINT project_vendors_project_uuid_foreign
        FOREIGN KEY (project_uuid) REFERENCES envoy_schema.projects(uuid);
      ALTER TABLE envoy_schema.project_vendors
        ADD CONSTRAINT project_vendors_vendor_uuid_foreign
        FOREIGN KEY (vendor_uuid) REFERENCES envoy_schema.vendors(uuid);
      ALTER TABLE envoy_schema.user_inbox_connections
        ADD CONSTRAINT user_inbox_connections_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.password_reset_tokens
        ADD CONSTRAINT password_reset_tokens_user_uuid_foreign
        FOREIGN KEY (user_uuid) REFERENCES envoy_schema.users(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.communications
        ADD CONSTRAINT communications_project_vendor_uuid_foreign
        FOREIGN KEY (project_vendor_uuid) REFERENCES envoy_schema.project_vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.vendor_conversations
        ADD CONSTRAINT vendor_conversations_vendor_uuid_foreign
        FOREIGN KEY (vendor_uuid) REFERENCES envoy_schema.vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.vendor_conversations
        ADD CONSTRAINT vendor_conversations_project_vendor_uuid_foreign
        FOREIGN KEY (project_vendor_uuid) REFERENCES envoy_schema.project_vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.messages
        ADD CONSTRAINT messages_communication_uuid_foreign
        FOREIGN KEY (communication_uuid) REFERENCES envoy_schema.communications(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.messages
        ADD CONSTRAINT messages_vendor_conversation_uuid_foreign
        FOREIGN KEY (vendor_conversation_uuid) REFERENCES envoy_schema.vendor_conversations(uuid) ON DELETE SET NULL;
      ALTER TABLE envoy_schema.outreach_drafts
        ADD CONSTRAINT outreach_drafts_project_vendor_uuid_foreign
        FOREIGN KEY (project_vendor_uuid) REFERENCES envoy_schema.project_vendors(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.outreach_drafts
        ADD CONSTRAINT outreach_drafts_vendor_conversation_uuid_foreign
        FOREIGN KEY (vendor_conversation_uuid) REFERENCES envoy_schema.vendor_conversations(uuid) ON DELETE CASCADE;
      ALTER TABLE envoy_schema.outreach_drafts
        ADD CONSTRAINT outreach_drafts_sent_message_uuid_foreign
        FOREIGN KEY (sent_message_uuid) REFERENCES envoy_schema.messages(uuid) ON DELETE SET NULL;
      ALTER TABLE envoy_schema.project_insights
        ADD CONSTRAINT project_insights_project_uuid_foreign
        FOREIGN KEY (project_uuid) REFERENCES envoy_schema.projects(uuid);
    `)
  }
}
