import { DateTime } from 'luxon'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import VendorStatus from './vendor_status.js'
import VendorConversation from './vendor_conversation.js'
import Project from './project.js'

export default class Vendor extends BaseModel {
  static table = 'envoy_schema.vendors'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(vendor: Vendor) {
    if (!vendor.uuid) {
      vendor.uuid = uuidv4()
    }
  }

  @column()
  declare name: string

  @column()
  declare email: string

  @column({ columnName: 'created_by' })
  declare createdBy: string

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column({ columnName: 'modified_by' })
  declare modifiedBy: string

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @column({ columnName: 'status' })
  declare statusId: number

  @belongsTo(() => VendorStatus, { foreignKey: 'statusId' })
  declare status: BelongsTo<typeof VendorStatus>

  @column({ columnName: 'project_uuid' })
  declare projectUuid: string

  @belongsTo(() => Project, { foreignKey: 'projectUuid', localKey: 'uuid' })
  declare project: BelongsTo<typeof Project>

  @hasMany(() => VendorConversation, { foreignKey: 'vendorUuid', localKey: 'uuid' })
  declare vendorConversations: HasMany<typeof VendorConversation>

  @column({ columnName: 'is_active' })
  declare isActive: boolean
}
