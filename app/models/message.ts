import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Communication from './communication.js'

export default class Message extends BaseModel {
  static table = 'envoy_schema.messages'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(message: Message) {
    if (!message.uuid) {
      message.uuid = uuidv4()
    }
  }

  @column()
  declare body: string

  @column({ columnName: 'created_by' })
  declare createdBy: string

  @column()
  declare subject: string

  @column()
  declare from: string

  @column()
  declare to: string

  @column()
  declare cc?: string

  @column()
  declare bcc?: string

  @column({ columnName: 'sent_timestamp' })
  declare sentTimestamp: DateTime

  @column({ columnName: 'communication_uuid' })
  declare communicationUuid: string

  @belongsTo(() => Communication, { foreignKey: 'communicationUuid', localKey: 'uuid' })
  declare communication: BelongsTo<typeof Communication>
}
