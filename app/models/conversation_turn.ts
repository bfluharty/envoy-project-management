import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Conversation from './conversation.js'
import * as turn from '../../types/turn.js'

export default class ConversationTurn extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(cTurn: ConversationTurn) {
    if (!cTurn.uuid) {
      cTurn.uuid = uuidv4()
    }
  }

  @column.dateTime({ columnName: 'timestamp', autoCreate: true })
  declare timestamp: DateTime

  @column({ columnName: 'contents' })
  declare contents: turn.Turn

  @column({ columnName: 'conversation_uuid' })
  declare conversationUuid: string

  @belongsTo(() => Conversation, { foreignKey: 'conversationUuid', localKey: 'uuid' })
  declare conversation: BelongsTo<typeof Conversation>
}
