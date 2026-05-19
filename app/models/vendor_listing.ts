import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export default class VendorListing extends BaseModel {
  static table = 'envoy_schema.vendor_listings'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(listing: VendorListing) {
    if (!listing.uuid) {
      listing.uuid = uuidv4()
    }
  }

  @column()
  declare name: string

  @column()
  declare email: string

  @column()
  declare originator: 'USER' | 'GOOGLE' | 'VENDOR'

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'updated_timestamp', autoCreate: true, autoUpdate: true })
  declare updatedTimestamp: DateTime

  @column.dateTime({ columnName: 'deactivated_timestamp' })
  declare deactivatedTimestamp: DateTime | null

  @column({ columnName: 'modified_by' })
  declare modifiedBy: string | null
}
