import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export type AnonymousOnboardingDraftStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'ABANDONED'

export default class AnonymousOnboardingDraft extends BaseModel {
  static table = 'envoy_schema.anonymous_onboarding_drafts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @beforeCreate()
  public static assignUuid(draft: AnonymousOnboardingDraft) {
    if (!draft.uuid) {
      draft.uuid = uuidv4()
    }
  }

  @column({ columnName: 'token_uuid' })
  declare tokenUuid: string

  @column({ columnName: 'project_description' })
  declare projectDescription: string

  @column({ columnName: 'postal_code' })
  declare postalCode: string

  @column({
    columnName: 'vendor_searches',
    prepare: (value: unknown[]) => JSON.stringify(value ?? []),
  })
  declare vendorSearches: unknown[]

  @column({ columnName: 'recommended_vendor_listing_uuids' })
  declare recommendedVendorListingUuids: string[]

  @column({ columnName: 'selected_vendor_listing_uuids' })
  declare selectedVendorListingUuids: string[]

  @column()
  declare status: AnonymousOnboardingDraftStatus

  @column({ columnName: 'anonymous_session_uuid' })
  declare anonymousSessionUuid: string

  @column({ columnName: 'registered_user_uuid' })
  declare registeredUserUuid: string | null

  @column({ columnName: 'consumed_by_user_uuid' })
  declare consumedByUserUuid: string | null

  @column({ columnName: 'consumed_project_uuid' })
  declare consumedProjectUuid: string | null

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'updated_timestamp', autoCreate: true, autoUpdate: true })
  declare updatedTimestamp: DateTime
}
