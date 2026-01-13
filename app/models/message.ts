import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import VendorConversation from './vendor_conversation.js'

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

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column({ columnName: 'modified_by' })
  declare modifiedBy: string

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

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

  @column({ columnName: 'vendor_conversation_uuid' })
  declare vendorConversationUuid: string

  @belongsTo(() => VendorConversation, { foreignKey: 'vendorConversationUuid', localKey: 'uuid' })
  declare vendorConversation: BelongsTo<typeof VendorConversation>
}
