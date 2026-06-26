import encryption from '@adonisjs/core/services/encryption'
import type UserInboxConnection from '#models/user_inbox_connection'

export const OAUTH_TOKEN_ENCRYPTION_VERSION = 'adonis_app_key_v1' as const
export const PLAINTEXT_LEGACY_TOKEN_VERSION = 'plaintext_legacy' as const

export type OauthTokenEncryptionVersion =
  | typeof OAUTH_TOKEN_ENCRYPTION_VERSION
  | typeof PLAINTEXT_LEGACY_TOKEN_VERSION

const OAUTH_TOKEN_PURPOSE = 'envoy.oauth_token'

export function encryptOauthToken(token: string): string {
  return encryption.encrypt(token, undefined, OAUTH_TOKEN_PURPOSE)
}

export function decryptOauthToken(
  storedToken: string,
  version: OauthTokenEncryptionVersion | null | undefined
): string {
  if (version === PLAINTEXT_LEGACY_TOKEN_VERSION || !version) {
    return storedToken
  }

  const decrypted = encryption.decrypt<string>(storedToken, OAUTH_TOKEN_PURPOSE)
  if (typeof decrypted !== 'string') {
    throw new Error('Could not decrypt OAuth token')
  }

  return decrypted
}

export function decryptNullableOauthToken(
  storedToken: string | null,
  version: OauthTokenEncryptionVersion | null | undefined
): string | null {
  return storedToken ? decryptOauthToken(storedToken, version) : null
}

export function decryptConnectionAccessToken(connection: UserInboxConnection): string {
  return decryptOauthToken(connection.accessToken, connection.tokenEncryptionVersion)
}

export function decryptConnectionRefreshToken(connection: UserInboxConnection): string | null {
  return decryptNullableOauthToken(connection.refreshToken, connection.tokenEncryptionVersion)
}
