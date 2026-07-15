import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'

export type UserConsentEventType =
  | 'TERMS_ACCEPTED'
  | 'PRIVACY_POLICY_ACKNOWLEDGED'
  | 'MODEL_TRAINING_OPTED_IN'
  | 'MODEL_TRAINING_OPTED_OUT'

export type UserConsentEventSource = 'ONBOARDING' | 'ACCOUNT' | 'PRIVACY_REACK' | 'ADMIN'

export default class UserConsentEvent extends BaseModel {
  static table = 'envoy_schema.user_consent_events'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(event: UserConsentEvent) {
    if (!event.uuid) {
      event.uuid = uuidv4()
    }
  }

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @column({ columnName: 'event_type' })
  declare eventType: UserConsentEventType

  @column({ columnName: 'terms_version' })
  declare termsVersion: string | null

  @column({ columnName: 'privacy_policy_version' })
  declare privacyPolicyVersion: string | null

  @column({ columnName: 'model_training_opt_in' })
  declare modelTrainingOptIn: boolean | null

  @column({ columnName: 'model_training_notice_version' })
  declare modelTrainingNoticeVersion: string | null

  @column({ columnName: 'disclosure_text' })
  declare disclosureText: string

  @column({ columnName: 'actor_user_uuid' })
  declare actorUserUuid: string | null

  @column()
  declare source: UserConsentEventSource

  @column({ columnName: 'ip_address' })
  declare ipAddress: string | null

  @column({ columnName: 'user_agent' })
  declare userAgent: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'actorUserUuid', localKey: 'uuid' })
  declare actorUser: BelongsTo<typeof User>
}
