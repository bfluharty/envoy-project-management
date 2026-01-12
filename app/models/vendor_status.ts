import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class VendorStatus extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column({ columnName: 'canonical_name' })
  declare canonicalName: string

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
