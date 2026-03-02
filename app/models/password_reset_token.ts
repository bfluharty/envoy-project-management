import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class PasswordResetToken extends BaseModel {
  static table = 'envoy_schema.password_reset_tokens'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @column()
  declare token: string

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime

  @column.dateTime({ columnName: 'created_at' })
  declare createdAt: DateTime
}
