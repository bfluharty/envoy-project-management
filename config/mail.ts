import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const RESEND_DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev'
const RESEND_DEFAULT_FROM_NAME = 'Envoy'
const RESEND_API_BASE_URL = 'https://api.resend.com'

/**
 * Transactional email via Resend.
 * Set RESEND_API_KEY, MAIL_FROM_ADDRESS, MAIL_FROM_NAME, APP_URL in .env.
 */
export default defineConfig({
  default: 'resend',

  from: {
    address: env.get('MAIL_FROM_ADDRESS') ?? RESEND_DEFAULT_FROM_ADDRESS,
    name: env.get('MAIL_FROM_NAME') ?? RESEND_DEFAULT_FROM_NAME,
  },

  mailers: {
    resend: transports.resend({
      key: env.get('RESEND_API_KEY') ?? '',
      baseUrl: RESEND_API_BASE_URL,
    }),
  },
})
