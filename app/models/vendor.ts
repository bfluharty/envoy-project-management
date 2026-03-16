import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

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

  @column({ columnName: 'is_active' })
  declare isActive: boolean
}
