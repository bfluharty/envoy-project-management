import { google } from 'googleapis'
import type UserInboxConnection from '#models/user_inbox_connection'
import inboxConfig from '#config/inbox'
import logger from '@adonisjs/core/services/logger'

export type InboxProvider = 'gmail' | 'microsoft'

const REDIRECT_URI = `${inboxConfig.appUrl.replace(/\/$/, '')}${inboxConfig.redirectPath}`

function encodeState(payload: { userUuid: string; provider: InboxProvider }): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeState(state: string): { userUuid: string; provider: InboxProvider } | null {
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as { userUuid: string; provider: InboxProvider }
    if (parsed.userUuid && (parsed.provider === 'gmail' || parsed.provider === 'microsoft')) {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Returns the OAuth URL to send the user to for connecting their inbox.
 */
export function getAuthUrl(provider: InboxProvider, userUuid: string): string {
  const state = encodeState({ userUuid, provider })

  if (provider === 'gmail') {
    if (!inboxConfig.google.clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured')
    }
    const oauth2 = new google.auth.OAuth2(
      inboxConfig.google.clientId,
      inboxConfig.google.clientSecret,
      REDIRECT_URI
    )
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: inboxConfig.google.scopes,
      state,
    })
  }

  if (provider === 'microsoft') {
    if (!inboxConfig.microsoft.clientId) {
      throw new Error('MICROSOFT_CLIENT_ID is not configured')
    }
    const scope = inboxConfig.microsoft.scopes.join(' ')
    const params = new URLSearchParams({
      client_id: inboxConfig.microsoft.clientId,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope,
      state,
      response_mode: 'query',
    })
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  }

  throw new Error(`Unknown provider: ${provider}`)
}

/**
 * Exchange authorization code for tokens and return profile email. Caller should persist the connection.
 */
export async function exchangeCode(
  provider: InboxProvider,
  code: string,
  state: string
): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  email: string
  scopes: string
}> {
  const decoded = decodeState(state)
  if (!decoded) {
    throw new Error('Invalid state')
  }

  if (provider === 'gmail') {
    const oauth2 = new google.auth.OAuth2(
      inboxConfig.google.clientId,
      inboxConfig.google.clientSecret,
      REDIRECT_URI
    )
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    const oauth2Client = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: profile } = await oauth2Client.userinfo.get()
    const email = profile.email || ''
    if (!email) {
      throw new Error('Could not read email from Google profile')
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
      email,
      scopes: (tokens.scope as string) || inboxConfig.google.scopes.join(' '),
    }
  }

  if (provider === 'microsoft') {
    const body = new URLSearchParams({
      client_id: inboxConfig.microsoft.clientId,
      client_secret: inboxConfig.microsoft.clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    })
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const errText = await res.text()
      logger.error({ status: res.status, body: errText }, 'Microsoft token exchange failed')
      throw new Error(`Microsoft token exchange failed: ${res.status}`)
    }
    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }
    const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null

    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (!userRes.ok) {
      throw new Error('Could not fetch Microsoft user profile')
    }
    const userData = (await userRes.json()) as { mail?: string; userPrincipalName?: string }
    const email = userData.mail || userData.userPrincipalName || ''
    if (!email) {
      throw new Error('Could not read email from Microsoft profile')
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt,
      email,
      scopes: data.scope || inboxConfig.microsoft.scopes.join(' '),
    }
  }

  throw new Error(`Unknown provider: ${provider}`)
}

/**
 * Refresh access token for a connection. Updates the connection in place and persists if saveConnection is true.
 */
export async function refreshConnectionTokens(
  connection: UserInboxConnection
): Promise<UserInboxConnection> {
  if (connection.provider === 'gmail') {
    const oauth2 = new google.auth.OAuth2(
      inboxConfig.google.clientId,
      inboxConfig.google.clientSecret,
      REDIRECT_URI
    )
    oauth2.setCredentials({
      refresh_token: connection.refreshToken || undefined,
    })
    const tokenResponse = await oauth2.refreshAccessToken()
    const { credentials } = tokenResponse
    connection.accessToken = credentials.access_token!
    if (credentials.refresh_token) connection.refreshToken = credentials.refresh_token
    const { DateTime } = await import('luxon')
    connection.accessTokenExpiresAt = credentials.expiry_date
      ? DateTime.fromJSDate(new Date(credentials.expiry_date))
      : null
    await connection.save()
    return connection
  }

  if (connection.provider === 'microsoft') {
    if (!connection.refreshToken) {
      throw new Error('Microsoft connection has no refresh token')
    }
    const body = new URLSearchParams({
      client_id: inboxConfig.microsoft.clientId,
      client_secret: inboxConfig.microsoft.clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    })
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const errText = await res.text()
      logger.error({ status: res.status, body: errText }, 'Microsoft token refresh failed')
      throw new Error(`Microsoft token refresh failed: ${res.status}`)
    }
    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }
    const { DateTime } = await import('luxon')
    connection.accessToken = data.access_token
    if (data.refresh_token) connection.refreshToken = data.refresh_token
    connection.accessTokenExpiresAt = data.expires_in
      ? DateTime.now().plus({ seconds: data.expires_in })
      : null
    await connection.save()
    return connection
  }

  throw new Error(`Unknown provider: ${connection.provider}`)
}

/**
 * Ensure the connection has a valid access token (refresh if needed).
 */
export async function ensureValidToken(
  connection: UserInboxConnection
): Promise<UserInboxConnection> {
  const expiresAt = connection.accessTokenExpiresAt
  const bufferMinutes = 5
  if (expiresAt && expiresAt.diffNow('minutes').minutes > bufferMinutes) {
    return connection
  }
  return refreshConnectionTokens(connection)
}
