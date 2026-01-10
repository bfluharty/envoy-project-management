import { DateTime } from 'luxon'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Project from './project.js'
import ConversationTurn from './conversation_turn.js'

export default class Conversation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(conversation: Conversation) {
    if (!conversation.uuid) {
      conversation.uuid = uuidv4()
    }
  }

  @column.dateTime({ columnName: 'timestamp', autoCreate: true })
  declare timestamp: DateTime

  @column({ columnName: 'project_uuid' })
  declare projectUuid: string

  @belongsTo(() => Project, { foreignKey: 'projectUuid', localKey: 'uuid' })
  declare project: BelongsTo<typeof Project>

  @hasMany(() => ConversationTurn, { foreignKey: 'conversationUuid', localKey: 'uuid' })
  declare conversationTurns: HasMany<typeof ConversationTurn>
}
