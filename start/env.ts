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

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  APP_ENV: Env.schema.enum(['local', 'dev', 'prod', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  PASSWORD_AUTH_ENABLED: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | Variable for reasoning engine paths
  |----------------------------------------------------------
  */
  REASONING_ENGINE_URL: Env.schema.string(),

  /* Mail (transactional via Resend — https://resend.com) */
  APP_URL: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),
  RESEND_API_KEY: Env.schema.string.optional(),
  FOURSQUARE_PLACES_API_KEY: Env.schema.string.optional(),

  /* Email service (inbox list/message, send-on-behalf) — base URL, no trailing slash */
  EMAIL_SERVICE_URL: Env.schema.string.optional(),
  EMAIL_SERVICE_API_KEY: Env.schema.string.optional(),
  EMAIL_SYNC_QUEUE_URL: Env.schema.string.optional(),
  EMAIL_TERMS_VERSION: Env.schema.string.optional(),

  /* Inbox OAuth (customer grants access; we listen and reply on their behalf) */
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  MICROSOFT_CLIENT_ID: Env.schema.string.optional(),
  MICROSOFT_CLIENT_SECRET: Env.schema.string.optional(),
})
