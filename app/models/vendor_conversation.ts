import { DateTime } from 'luxon'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Vendor from './vendor.js'
import Message from './message.js'

export default class VendorConversation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(vendorConversation: VendorConversation) {
    if (!vendorConversation.uuid) {
      vendorConversation.uuid = uuidv4()
    }
  }

  @column()
  declare channel: string

  @column({ columnName: 'user_id' })
  declare userId: number

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare timestamp: DateTime

  @column({ columnName: 'vendor_uuid' })
  declare vendorUuid: string

  @belongsTo(() => Vendor, { foreignKey: 'vendorUuid', localKey: 'uuid' })
  declare vendor: BelongsTo<typeof Vendor>

  @hasMany(() => Message, { foreignKey: 'vendorConversationUuid', localKey: 'uuid' })
  declare messages: HasMany<typeof Message>
}
