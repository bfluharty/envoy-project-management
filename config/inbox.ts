import env from '#start/env'

/**
 * Inbox OAuth and provider config. Customer grants access; we listen and reply on their behalf.
 */
export default {
  appUrl: env.get('APP_URL') || 'http://localhost:8080',
  redirectPath: '/inbox/callback',

  google: {
    clientId: env.get('GOOGLE_CLIENT_ID') || '',
    clientSecret: env.get('GOOGLE_CLIENT_SECRET') || '',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  },

  microsoft: {
    clientId: env.get('MICROSOFT_CLIENT_ID') || '',
    clientSecret: env.get('MICROSOFT_CLIENT_SECRET') || '',
    scopes: [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
      'openid',
    ],
  },
}
