import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import Project from './project.js'
import ProjectInsightStatus from './project_insight_status.js'
import ProjectInsightType from './project_insight_type.js'

export default class ProjectInsight extends BaseModel {
  static table = 'envoy_schema.project_insights'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(projectInsight: ProjectInsight) {
    if (!projectInsight.uuid) {
      projectInsight.uuid = uuidv4()
    }
  }

  @column({ columnName: 'project_uuid' })
  declare projectUuid: string

  @belongsTo(() => Project, { foreignKey: 'projectUuid', localKey: 'uuid' })
  declare project: BelongsTo<typeof Project>

  @column({ columnName: 'insight_type_id' })
  declare insightTypeId: number

  @belongsTo(() => ProjectInsightType, { foreignKey: 'insightTypeId' })
  declare insightType: BelongsTo<typeof ProjectInsightType>

  @column({ columnName: 'status_id' })
  declare statusId: number

  @belongsTo(() => ProjectInsightStatus, { foreignKey: 'statusId' })
  declare status: BelongsTo<typeof ProjectInsightStatus>

  @column({ columnName: 'insight_text' })
  declare insightText: string

  @column()
  declare importance: number

  @column()
  declare confidence: number | null

  @column({ columnName: 'supersedes_insight_uuid' })
  declare supersedesInsightUuid: string | null

  @column({ columnName: 'superseded_by_insight_uuid' })
  declare supersededByInsightUuid: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime
}
