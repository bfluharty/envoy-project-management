import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, hasMany } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Vendor from './vendor.js'

export type VendorListingOriginator = 'CONSUMER' | 'SEARCH' | 'VENDOR'
export type VendorListingClaimStatus = 'UNCLAIMED' | 'PENDING_CLAIM' | 'CLAIMED' | 'CONFLICT'

export type VendorListingLocation = {
  address?: string
  locality?: string
  region?: string
  postcode?: string
  country?: string
  formatted_address?: string
}

export default class VendorListing extends BaseModel {
  static table = 'envoy_schema.vendor_listings'

  @hasMany(() => Vendor, { foreignKey: 'vendorListingUuid', localKey: 'uuid' })
  declare vendors: HasMany<typeof Vendor>

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
  declare originator: VendorListingOriginator

  @column({ columnName: 'fsq_place_id' })
  declare fsqPlaceId: string | null

  @column()
  declare categories: string[]

  @column({ columnName: 'phone_number' })
  declare phoneNumber: string | null

  @column()
  declare website: string | null

  @column.date({ columnName: 'date_refreshed' })
  declare dateRefreshed: DateTime | null

  @column()
  declare location: VendorListingLocation | null

  @column({ columnName: 'source_payload' })
  declare sourcePayload: unknown | null

  @column({ columnName: 'claimed_by_user_uuid' })
  declare claimedByUserUuid: string | null

  @column.dateTime({ columnName: 'claimed_at' })
  declare claimedAt: DateTime | null

  @column({ columnName: 'claim_status' })
  declare claimStatus: VendorListingClaimStatus

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
