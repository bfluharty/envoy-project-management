export const INBOX_PROVIDERS = ['gmail', 'microsoft'] as const

export type InboxProvider = (typeof INBOX_PROVIDERS)[number]

export interface AuthUrlInput {
  userUuid?: string
  state: string
  loginHint?: string
}

export interface ExchangeCodeInput {
  code: string
  state: string
}

export interface RefreshInput {
  refreshToken: string
}

export interface ProviderProfileInput {
  accessToken: string
}

export interface ProviderProfile {
  provider: InboxProvider
  providerUserId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
}

export interface ConnectedMailboxTokens {
  provider: InboxProvider
  providerUserId: string
  email: string
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string
}

export interface RefreshedMailboxTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes?: string
}

export interface InboxAuthProvider {
  provider: InboxProvider
  getAuthorizationUrl(input: AuthUrlInput): string
  exchangeCode(input: ExchangeCodeInput): Promise<ConnectedMailboxTokens>
  refresh(input: RefreshInput): Promise<RefreshedMailboxTokens>
  getProfile(input: ProviderProfileInput): Promise<ProviderProfile>
}

export function isInboxProvider(provider: unknown): provider is InboxProvider {
  return typeof provider === 'string' && INBOX_PROVIDERS.includes(provider as InboxProvider)
}
