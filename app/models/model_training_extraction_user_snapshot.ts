import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export default class ModelTrainingExtractionUserSnapshot extends BaseModel {
  static table = 'envoy_schema.model_training_extraction_user_snapshots'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  static assignUuid(snapshot: ModelTrainingExtractionUserSnapshot) {
    if (!snapshot.uuid) snapshot.uuid = uuidv4()
  }

  @column({ columnName: 'extraction_audit_uuid' })
  declare extractionAuditUuid: string

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @column({ columnName: 'model_training_opt_in' })
  declare modelTrainingOptIn: true

  @column({ columnName: 'model_training_notice_version' })
  declare modelTrainingNoticeVersion: string

  @column.dateTime({ columnName: 'model_training_preference_updated_at' })
  declare modelTrainingPreferenceUpdatedAt: DateTime

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime
}
