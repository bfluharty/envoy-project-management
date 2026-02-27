import { DateTime } from 'luxon'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

import ProjectVendor from './project_vendor.js'
import Message from './message.js'

export default class Communication extends BaseModel {
  static table = 'envoy_schema.communications'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(communication: Communication) {
    if (!communication.uuid) {
      communication.uuid = uuidv4()
    }
  }

  @column()
  declare channel: string

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare timestamp: DateTime

  @column({ columnName: 'project_vendor_uuid' })
  declare projectVendorUuid: string

  @belongsTo(() => ProjectVendor, { foreignKey: 'projectVendorUuid', localKey: 'uuid' })
  declare projectVendor: BelongsTo<typeof ProjectVendor>

  @hasMany(() => Message, { foreignKey: 'communicationUuid', localKey: 'uuid' })
  declare messages: HasMany<typeof Message>
}
