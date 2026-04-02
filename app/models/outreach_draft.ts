import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import ProjectVendor from './project_vendor.js'
import Message from './message.js'
import VendorConversation from './vendor_conversation.js'

export default class OutreachDraft extends BaseModel {
  static table = 'envoy_schema.outreach_drafts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(outreachDraft: OutreachDraft) {
    if (!outreachDraft.uuid) {
      outreachDraft.uuid = uuidv4()
    }
  }

  @column({ columnName: 'project_vendor_uuid' })
  declare projectVendorUuid: string

  @column({ columnName: 'vendor_conversation_uuid' })
  declare vendorConversationUuid: string

  @column()
  declare subject: string

  @column()
  declare body: string

  @column()
  declare status: string

  @column.dateTime({ columnName: 'sent_timestamp' })
  declare sentTimestamp: DateTime | null

  @column({ columnName: 'sent_message_uuid' })
  declare sentMessageUuid: string | null

  @column({ columnName: 'last_error' })
  declare lastError: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @belongsTo(() => ProjectVendor, { foreignKey: 'projectVendorUuid', localKey: 'uuid' })
  declare projectVendor: BelongsTo<typeof ProjectVendor>

  @belongsTo(() => VendorConversation, { foreignKey: 'vendorConversationUuid', localKey: 'uuid' })
  declare vendorConversation: BelongsTo<typeof VendorConversation>

  @belongsTo(() => Message, { foreignKey: 'sentMessageUuid', localKey: 'uuid' })
  declare sentMessage: BelongsTo<typeof Message>
}
