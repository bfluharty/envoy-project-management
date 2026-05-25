import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import VendorListing from './vendor_listing.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

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

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>

  @column({ columnName: 'vendor_listing_uuid' })
  declare vendorListingUuid: string

  @belongsTo(() => VendorListing, { foreignKey: 'vendorListingUuid', localKey: 'uuid' })
  declare vendorListing: BelongsTo<typeof VendorListing>

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column({ columnName: 'modified_by' })
  declare modifiedBy: string

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @column({ columnName: 'is_active' })
  declare isActive: boolean
}
