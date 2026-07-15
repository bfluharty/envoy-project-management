import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'

export default class UserConsentPreference extends BaseModel {
  static table = 'envoy_schema.user_consent_preferences'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(preference: UserConsentPreference) {
    if (!preference.uuid) {
      preference.uuid = uuidv4()
    }
  }

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @column({ columnName: 'terms_accepted' })
  declare termsAccepted: boolean

  @column({ columnName: 'terms_version' })
  declare termsVersion: string | null

  @column.dateTime({ columnName: 'terms_accepted_at' })
  declare termsAcceptedAt: DateTime | null

  @column({ columnName: 'privacy_policy_version' })
  declare privacyPolicyVersion: string | null

  @column.dateTime({ columnName: 'privacy_policy_acknowledged_at' })
  declare privacyPolicyAcknowledgedAt: DateTime | null

  @column({ columnName: 'model_training_opt_in' })
  declare modelTrainingOptIn: boolean

  @column({ columnName: 'model_training_notice_version' })
  declare modelTrainingNoticeVersion: string | null

  @column.dateTime({ columnName: 'model_training_preference_updated_at' })
  declare modelTrainingPreferenceUpdatedAt: DateTime | null

  @column({ columnName: 'created_by_user_uuid' })
  declare createdByUserUuid: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column({ columnName: 'modified_by_user_uuid' })
  declare modifiedByUserUuid: string | null

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'createdByUserUuid', localKey: 'uuid' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'modifiedByUserUuid', localKey: 'uuid' })
  declare modifiedByUser: BelongsTo<typeof User>
}
