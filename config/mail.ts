import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: 'resend',

  from: {
    address: env.get('MAIL_FROM_ADDRESS') ?? 'noreply@localhost',
    name: env.get('MAIL_FROM_NAME') ?? 'Envoy',
  },

  mailers: {
    resend: transports.resend({
      key: env.get('RESEND_API_KEY') ?? '',
      baseUrl: 'https://api.resend.com',
    }),
  },
})

export default mailConfig
