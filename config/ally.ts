import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'
import type { InferSocialProviders } from '@adonisjs/ally/types'
import { microsoft } from '@tpointurier/ally-microsoft'

const appUrl = (env.get('APP_URL') || 'http://localhost:8080').replace(/\/$/, '')
const callbackUrl = (provider: 'google' | 'microsoft') => `${appUrl}/auth/${provider}/callback`

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID', ''),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: callbackUrl('google'),
    scopes: ['userinfo.email', 'userinfo.profile', 'openid'],
    prompt: 'select_account',
    accessType: 'offline',
    display: 'page',
  }),
  microsoft: microsoft({
    clientId: env.get('MICROSOFT_CLIENT_ID', ''),
    clientSecret: env.get('MICROSOFT_CLIENT_SECRET', ''),
    callbackUrl: callbackUrl('microsoft'),
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    tenantId: 'common',
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
