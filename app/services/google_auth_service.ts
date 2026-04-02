import { google } from 'googleapis'
import inboxConfig from '#config/inbox'
import env from '#start/env'

const REDIRECT_URI = `${(env.get('APP_URL') || 'http://localhost:8080').replace(/\/$/, '')}/auth/google/callback`

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
  ...inboxConfig.google.scopes,
]

function getOAuth2Client() {
  return new google.auth.OAuth2(
    inboxConfig.google.clientId,
    inboxConfig.google.clientSecret,
    REDIRECT_URI
  )
}

export function getGoogleAuthUrl(): string {
  if (!inboxConfig.google.clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured')
  }

  const oauth2 = getOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })
}

export async function getGoogleUser(code: string): Promise<{
  googleId: string
  email: string
  fullName: string
  picture: string | null
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string
}> {
  const oauth2 = getOAuth2Client()
  const { tokens } = await oauth2.getToken(code)
  oauth2.setCredentials(tokens)

  const oauth2Client = google.oauth2({ version: 'v2', auth: oauth2 })
  const { data: profile } = await oauth2Client.userinfo.get()

  if (!profile.email) {
    throw new Error('Could not read email from Google profile')
  }
  if (!profile.id) {
    throw new Error('Could not read Google ID from profile')
  }

  return {
    googleId: profile.id,
    email: profile.email,
    fullName: profile.name || profile.email.split('@')[0],
    picture: typeof profile.picture === 'string' ? profile.picture : null,
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: (tokens.scope as string) || SCOPES.join(' '),
  }
}
