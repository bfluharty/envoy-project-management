import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

/**
 * Customer's connected inbox. We ask permission to access their inbox (OAuth),
 * store their token here, and use it to listen to their inbox and respond
 * to vendor emails on their behalf.
 */
export default class UserInboxConnection extends BaseModel {
  static table = 'envoy_schema.user_inbox_connections'

  @column({ isPrimary: true })
  declare id: number

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
  declare scopes: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>
}
