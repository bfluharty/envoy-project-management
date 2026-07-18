import { BaseSchema } from '@adonisjs/lucid/schema'

export default class EnforceConsentEventAppendOnly extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE OR REPLACE FUNCTION envoy_schema.prevent_direct_consent_event_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        -- Foreign-key actions run from a parent-table trigger and therefore have depth > 1.
        -- Permit those so deleting a user can still cascade events and null an actor reference.
        IF pg_trigger_depth() > 1 THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Consent events are append-only and cannot be % directly.', TG_OP
          USING ERRCODE = '55000';
      END
      $$;

      CREATE TRIGGER user_consent_events_append_only
      BEFORE UPDATE OR DELETE ON envoy_schema.user_consent_events
      FOR EACH ROW
      EXECUTE FUNCTION envoy_schema.prevent_direct_consent_event_mutation();
    `)
  }

  async down() {
    this.schema.raw(`
      DROP TRIGGER IF EXISTS user_consent_events_append_only
        ON envoy_schema.user_consent_events;
      DROP FUNCTION IF EXISTS envoy_schema.prevent_direct_consent_event_mutation();
    `)
  }
}
