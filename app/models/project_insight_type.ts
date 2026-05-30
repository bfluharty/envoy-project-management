import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ProjectInsight from './project_insight.js'

export default class ProjectInsightType extends BaseModel {
  static table = 'envoy_schema.project_insight_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @hasMany(() => ProjectInsight, { foreignKey: 'insightTypeId' })
  declare projectInsights: HasMany<typeof ProjectInsight>
}
