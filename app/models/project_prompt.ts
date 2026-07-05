import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Project from './project.js'
import User from './user.js'

export type ProjectPromptAgentType = 'PLANNING' | 'OUTREACH'

export default class ProjectPrompt extends BaseModel {
  static table = 'envoy_schema.projects_prompts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(projectPrompt: ProjectPrompt) {
    if (!projectPrompt.uuid) {
      projectPrompt.uuid = uuidv4()
    }
  }

  @column({ columnName: 'project_uuid' })
  declare projectUuid: string

  @belongsTo(() => Project, { foreignKey: 'projectUuid', localKey: 'uuid' })
  declare project: BelongsTo<typeof Project>

  @column({ columnName: 'agent_type' })
  declare agentType: ProjectPromptAgentType

  @column()
  declare data: Record<string, unknown>

  @column({ columnName: 'created_by_user_uuid' })
  declare createdByUserUuid: string | null

  @belongsTo(() => User, { foreignKey: 'createdByUserUuid', localKey: 'uuid' })
  declare createdByUser: BelongsTo<typeof User>

  @column({ columnName: 'modified_by_user_uuid' })
  declare modifiedByUserUuid: string | null

  @belongsTo(() => User, { foreignKey: 'modifiedByUserUuid', localKey: 'uuid' })
  declare modifiedByUser: BelongsTo<typeof User>

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime
}
