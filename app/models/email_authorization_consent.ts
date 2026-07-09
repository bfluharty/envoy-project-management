import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'

export default class EmailAuthorizationConsent extends BaseModel {
  static table = 'envoy_schema.email_authorization_consents'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(consent: EmailAuthorizationConsent) {
    if (!consent.uuid) {
      consent.uuid = uuidv4()
    }
  }

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @column()
  declare provider: string

  @column()
  declare email: string

  @column({ columnName: 'provider_user_id' })
  declare providerUserId: string | null

  @column()
  declare scopes: string | null

  @column({ columnName: 'terms_version' })
  declare termsVersion: string

  @column({ columnName: 'consent_text' })
  declare consentText: string

  @column({ columnName: 'ip_address' })
  declare ipAddress: string | null

  @column({ columnName: 'user_agent' })
  declare userAgent: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>
}
