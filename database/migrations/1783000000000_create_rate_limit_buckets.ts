import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateRateLimitBuckets extends BaseSchema {
  public async up() {
    await this.schema.raw(`
      CREATE TABLE IF NOT EXISTS envoy_schema.rate_limit_buckets (
        id bigserial PRIMARY KEY,
        bucket_key text NOT NULL,
        window_start timestamptz NOT NULL,
        window_seconds integer NOT NULL,
        request_count integer NOT NULL DEFAULT 0,
        created_timestamp timestamptz NOT NULL DEFAULT NOW(),
        updated_timestamp timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT rate_limit_buckets_unique
          UNIQUE (bucket_key, window_start, window_seconds)
      );

      CREATE INDEX IF NOT EXISTS rate_limit_buckets_updated_timestamp_idx
        ON envoy_schema.rate_limit_buckets (updated_timestamp);
    `)
  }

  public async down() {
    await this.schema.raw(`
      DROP TABLE IF EXISTS envoy_schema.rate_limit_buckets;
    `)
  }
}
