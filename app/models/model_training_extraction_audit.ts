import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export type ModelTrainingExtractionAuditStatus = 'STARTED' | 'COMPLETED' | 'FAILED' | 'ABANDONED'

export default class ModelTrainingExtractionAudit extends BaseModel {
  static table = 'envoy_schema.model_training_extraction_audits'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  static assignUuid(audit: ModelTrainingExtractionAudit) {
    if (!audit.uuid) audit.uuid = uuidv4()
  }

  @column({ columnName: 'job_identifier' })
  declare jobIdentifier: string

  @column({ columnName: 'attempt_number' })
  declare attemptNumber: number

  @column.dateTime({ columnName: 'extracted_at' })
  declare extractedAt: DateTime

  @column({
    columnName: 'requested_categories',
    prepare: (value: string[]) => JSON.stringify(value),
  })
  declare requestedCategories: string[]

  @column({ columnName: 'eligible_user_count' })
  declare eligibleUserCount: number

  @column({ columnName: 'exclusion_policy_version' })
  declare exclusionPolicyVersion: string

  @column()
  declare status: ModelTrainingExtractionAuditStatus

  @column.dateTime({ columnName: 'finished_at' })
  declare finishedAt: DateTime | null

  @column.dateTime({ columnName: 'lease_expires_at' })
  declare leaseExpiresAt: DateTime | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime
}
