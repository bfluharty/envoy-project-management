import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import EmailAuthorizationConsent from '#models/email_authorization_consent'
import EntitlementService from '#services/entitlement_service'
import {
  encryptOauthToken,
  OAUTH_TOKEN_ENCRYPTION_VERSION,
} from '#services/oauth_token_encryption_service'
import {
  buildEmailAuthorizationConsentText,
  type EmailAuthorizationAccountType,
  type EmailAuthorizationFlow,
  type EmailAuthorizationProvider,
} from '#services/email_authorization_state_service'

export type InboxProviderForAuth = 'gmail' | 'microsoft'

export interface NormalizedEmailAuthorizationProfile {
  provider: EmailAuthorizationProvider
  providerUserId: string
  email: string
  fullName: string
  avatarUrl: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
}

export interface NormalizedEmailAuthorizationTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string
}

export interface CompleteEmailAuthorizationInput {
  profile: NormalizedEmailAuthorizationProfile
  tokens: NormalizedEmailAuthorizationTokens
  flow: EmailAuthorizationFlow
  accountType: EmailAuthorizationAccountType
  termsAccepted: boolean
  termsVersion: string
  ipAddress: string | null
  userAgent: string | null
}

export interface CompleteEmailAuthorizationResult {
  user: User
  connection: UserInboxConnection
  createdUser: boolean
  replacedConnectionIds: number[]
}

export class EmailAuthorizationCompletionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailAuthorizationCompletionError'
  }
}

export function socialProviderToInboxProvider(
  provider: EmailAuthorizationProvider
): InboxProviderForAuth {
  return provider === 'google' ? 'gmail' : 'microsoft'
}

function canonicalEmail(email: string) {
  return email.trim().toLowerCase()
}

function expiresAtToDateTime(expiresAt: Date | null) {
  return expiresAt ? DateTime.fromJSDate(expiresAt) : null
}

async function findUserForProfile(
  profile: NormalizedEmailAuthorizationProfile,
  trx: TransactionClientContract
) {
  const userByProviderId = await User.query()
    .useTransaction(trx)
    .where('provider_id', profile.providerUserId)
    .first()

  if (userByProviderId) {
    return userByProviderId
  }

  return User.query().useTransaction(trx).where('email', profile.email).first()
}

async function createUserForProfile(
  profile: NormalizedEmailAuthorizationProfile,
  accountType: EmailAuthorizationAccountType,
  trx: TransactionClientContract
) {
  const entitlementId = await EntitlementService.getIdByCanonicalName(
    accountType === 'vendor' ? 'VENDOR' : 'CONSUMER'
  )

  return User.create(
    {
      fullName: profile.fullName,
      email: profile.email,
      password: randomBytes(32).toString('hex'),
      providerId: profile.providerUserId,
      googleAvatarUrl: profile.provider === 'google' ? profile.avatarUrl : null,
      entitlementId,
      vendorApprovalStatus: accountType === 'vendor' ? 'PENDING' : null,
      isActive: true,
    },
    { client: trx }
  )
}

async function createOrUpdateUser(
  profile: NormalizedEmailAuthorizationProfile,
  flow: EmailAuthorizationFlow,
  accountType: EmailAuthorizationAccountType,
  trx: TransactionClientContract
) {
  const user = await findUserForProfile(profile, trx)

  if (!user) {
    if (flow !== 'registration') {
      throw new EmailAuthorizationCompletionError(
        'No account exists for that email. Create an account first.'
      )
    }

    return { user: await createUserForProfile(profile, accountType, trx), createdUser: true }
  }

  if (canonicalEmail(user.email) !== canonicalEmail(profile.email)) {
    throw new EmailAuthorizationCompletionError(
      'The authorized mailbox does not match this account.'
    )
  }

  if (profile.provider === 'google') {
    user.googleAvatarUrl = profile.avatarUrl
  }

  if (!user.providerId) {
    user.providerId = profile.providerUserId
  }

  user.isActive = true
  user.useTransaction(trx)
  await user.save()

  return { user, createdUser: false }
}

async function createOrUpdatePrimaryConnection(
  user: User,
  profile: NormalizedEmailAuthorizationProfile,
  tokens: NormalizedEmailAuthorizationTokens,
  trx: TransactionClientContract
) {
  const provider = socialProviderToInboxProvider(profile.provider)
  const existing = await UserInboxConnection.query()
    .useTransaction(trx)
    .where('user_uuid', user.uuid)
    .where('provider', provider)
    .where('email', profile.email)
    .first()

  if (!tokens.refreshToken && !existing?.refreshToken) {
    throw new EmailAuthorizationCompletionError(
      'The email provider did not return offline access. Please try again and approve mailbox access.'
    )
  }

  const now = DateTime.utc()
  let otherPrimaryQuery = UserInboxConnection.query()
    .useTransaction(trx)
    .where('user_uuid', user.uuid)
    .where('is_primary', true)
    .whereIn('status', ['active', 'reauth_required'])

  if (existing) {
    otherPrimaryQuery = otherPrimaryQuery.whereNot('id', existing.id)
  }

  const replacedConnections = await otherPrimaryQuery.clone().select('id')
  const replacedConnectionIds = replacedConnections.map((connection) => connection.id)

  await otherPrimaryQuery.update({
    is_primary: false,
    status: 'disconnected',
    disconnected_at: now.toSQL(),
  })

  const connectionValues = {
    userUuid: user.uuid,
    provider,
    email: profile.email,
    accessToken: encryptOauthToken(tokens.accessToken),
    refreshToken: tokens.refreshToken
      ? encryptOauthToken(tokens.refreshToken)
      : existing!.refreshToken,
    accessTokenExpiresAt: expiresAtToDateTime(tokens.expiresAt),
    scopes: tokens.scopes,
    status: 'active' as const,
    isPrimary: true,
    providerUserId: profile.providerUserId,
    tokenEncryptionVersion: OAUTH_TOKEN_ENCRYPTION_VERSION,
    reauthReason: null,
    reauthRequiredAt: null,
    disconnectedAt: null,
    watchStatus: existing?.watchStatus ?? ('not_configured' as const),
  }

  if (existing) {
    existing.useTransaction(trx)
    existing.merge(connectionValues)
    await existing.save()
    return { connection: existing, replacedConnectionIds }
  }

  return {
    connection: await UserInboxConnection.create(connectionValues, { client: trx }),
    replacedConnectionIds,
  }
}

async function recordConsent(
  user: User,
  profile: NormalizedEmailAuthorizationProfile,
  tokens: NormalizedEmailAuthorizationTokens,
  input: CompleteEmailAuthorizationInput,
  trx: TransactionClientContract
) {
  if (!input.termsAccepted) {
    return
  }

  await EmailAuthorizationConsent.create(
    {
      userUuid: user.uuid,
      provider: socialProviderToInboxProvider(profile.provider),
      email: profile.email,
      providerUserId: profile.providerUserId,
      scopes: tokens.scopes,
      termsVersion: input.termsVersion,
      consentText: buildEmailAuthorizationConsentText(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
    { client: trx }
  )
}

export async function completeEmailAuthorization(
  input: CompleteEmailAuthorizationInput
): Promise<CompleteEmailAuthorizationResult> {
  if (input.flow === 'registration' && !input.termsAccepted) {
    throw new EmailAuthorizationCompletionError('Email authorization terms must be accepted.')
  }

  return db.transaction(async (trx) => {
    const { user, createdUser } = await createOrUpdateUser(
      input.profile,
      input.flow,
      input.accountType,
      trx
    )

    const { connection, replacedConnectionIds } = await createOrUpdatePrimaryConnection(
      user,
      input.profile,
      input.tokens,
      trx
    )
    await recordConsent(user, input.profile, input.tokens, input, trx)

    return { user, connection, createdUser, replacedConnectionIds }
  })
}
