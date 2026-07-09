import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'

export type UserInboxConnectionStatus = 'active' | 'reauth_required' | 'disconnected'
export type UserInboxConnectionWatchStatus =
  | 'active'
  | 'renewal_required'
  | 'not_configured'
  | 'error'
export type UserInboxConnectionTokenEncryptionVersion = 'adonis_app_key_v1' | 'plaintext_legacy'

/**
 * Customer's connected inbox. We ask permission to access their inbox (OAuth),
 * store their token here, and use it to listen to their inbox and respond
 * to vendor emails on their behalf.
 */
export default class UserInboxConnection extends BaseModel {
  static table = 'envoy_schema.user_inbox_connections'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(connection: UserInboxConnection) {
    if (!connection.uuid) {
      connection.uuid = uuidv4()
    }
  }

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @column()
  declare provider: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare accessToken: string

  @column({ serializeAs: null })
  declare refreshToken: string | null

  @column.dateTime({ columnName: 'access_token_expires_at' })
  declare accessTokenExpiresAt: DateTime | null

  @column()
  declare status: UserInboxConnectionStatus

  @column({ columnName: 'is_primary' })
  declare isPrimary: boolean

  @column({ columnName: 'provider_user_id' })
  declare providerUserId: string | null

  @column()
  declare scopes: string | null

  @column({ columnName: 'token_encryption_version' })
  declare tokenEncryptionVersion: UserInboxConnectionTokenEncryptionVersion

  @column.dateTime({ columnName: 'last_sync_at' })
  declare lastSyncAt: DateTime | null

  @column({ columnName: 'last_sync_error' })
  declare lastSyncError: string | null

  @column({ columnName: 'reauth_reason' })
  declare reauthReason: string | null

  @column.dateTime({ columnName: 'reauth_required_at' })
  declare reauthRequiredAt: DateTime | null

  @column.dateTime({ columnName: 'disconnected_at' })
  declare disconnectedAt: DateTime | null

  @column({ columnName: 'provider_cursor' })
  declare providerCursor: string | null

  @column({ columnName: 'watch_status' })
  declare watchStatus: UserInboxConnectionWatchStatus

  @column.dateTime({ columnName: 'watch_expires_at' })
  declare watchExpiresAt: DateTime | null

  @column({ columnName: 'provider_subscription_id' })
  declare providerSubscriptionId: string | null

  @column({ columnName: 'subscription_client_state' })
  declare subscriptionClientState: string | null

  @column.dateTime({ columnName: 'subscription_expires_at' })
  declare subscriptionExpiresAt: DateTime | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>
}
