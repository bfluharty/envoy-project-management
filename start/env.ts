/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'
import { resolveQuackbackConfig } from '../app/utils/quackback_config.js'

const env = await Env.create(new URL('../', import.meta.url), {
  /* App */
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  APP_ENV: Env.schema.enum(['local', 'dev', 'prod', 'test'] as const),
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  APP_URL: Env.schema.string(),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  APP_KEY: Env.schema.string(),

  /* Database */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

  /* Internal services */
  REASONING_ENGINE_URL: Env.schema.string(),
  REASONING_ENGINE_API_KEY: Env.schema.string.optional(),
  EMAIL_SERVICE_URL: Env.schema.string.optional(),
  EMAIL_SERVICE_API_KEY: Env.schema.string.optional(),

  /* External services */
  FOURSQUARE_PLACES_API_KEY: Env.schema.string.optional(),

  /* Third party auth */
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  MICROSOFT_CLIENT_ID: Env.schema.string.optional(),
  MICROSOFT_CLIENT_SECRET: Env.schema.string.optional(),

  /* Email sync */
  EMAIL_SYNC_WORKER_ENABLED: Env.schema.boolean.optional(),
  EMAIL_SYNC_WORKER_INTERVAL_SECONDS: Env.schema.number.optional(),
  EMAIL_SYNC_QUEUE_URL: Env.schema.string.optional(),
  EMAIL_SYNC_DLQ_URL: Env.schema.string.optional(),

  /* Transactional mail */
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),
  RESEND_API_KEY: Env.schema.string.optional(),

  /* Feature flags */
  PASSWORD_AUTH_ENABLED: Env.schema.boolean.optional(),
  QUACKBACK_ENABLED: Env.schema.boolean.optional(),
  QUACKBACK_BASE_URL: Env.schema.string.optional(),
  QUACKBACK_WIDGET_SECRET: Env.schema.string.optional(),
})

// Cross-field validation belongs at startup so an enabled deployment cannot serve with an
// incomplete signing configuration. The validator never includes the secret value in errors.
resolveQuackbackConfig({
  enabled: env.get('QUACKBACK_ENABLED') ?? false,
  baseUrl: env.get('QUACKBACK_BASE_URL'),
  widgetSecret: env.get('QUACKBACK_WIDGET_SECRET'),
})

export default env
