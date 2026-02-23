import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

/**
 * Transactional email via Resend.
 * Set RESEND_API_KEY, MAIL_FROM_ADDRESS, MAIL_FROM_NAME, APP_URL in .env.
 */
export default defineConfig({
  default: 'resend',
  from: {
    address: env.get('MAIL_FROM_ADDRESS') ?? 'onboarding@resend.dev',
    name: env.get('MAIL_FROM_NAME') ?? 'Envoy',
  },
  mailers: {
    resend: transports.resend({
      key: env.get('RESEND_API_KEY') ?? '',
      baseUrl: 'https://api.resend.com',
    }),
  },
})
