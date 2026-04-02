import { BaseModel, column, belongsTo, hasMany, hasOne, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Communication from './communication.js'
import { v4 as uuidv4 } from 'uuid'

import Project from './project.js'
import Vendor from './vendor.js'
import VendorStatus from './vendor_status.js'
import OutreachDraft from './outreach_draft.js'
import VendorConversation from './vendor_conversation.js'

export default class ProjectVendor extends BaseModel {
  static table = 'envoy_schema.project_vendors'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(projectVendor: ProjectVendor) {
    if (!projectVendor.uuid) {
      projectVendor.uuid = uuidv4()
    }
  }

  @column({ columnName: 'project_uuid' })
  declare projectUuid: string

  @column({ columnName: 'vendor_uuid' })
  declare vendorUuid: string

  @column({ columnName: 'status' })
  declare statusId: number

  @belongsTo(() => VendorStatus, { foreignKey: 'statusId' })
  declare status: BelongsTo<typeof VendorStatus>

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @belongsTo(() => Project, { foreignKey: 'projectUuid', localKey: 'uuid' })
  declare project: BelongsTo<typeof Project>

  @belongsTo(() => Vendor, { foreignKey: 'vendorUuid', localKey: 'uuid' })
  declare vendor: BelongsTo<typeof Vendor>

  @hasMany(() => Communication, { foreignKey: 'projectVendorUuid', localKey: 'uuid' })
  declare communications: HasMany<typeof Communication>

  @hasOne(() => OutreachDraft, { foreignKey: 'projectVendorUuid', localKey: 'uuid' })
  declare outreachDraft: HasOne<typeof OutreachDraft>

  @hasOne(() => VendorConversation, { foreignKey: 'projectVendorUuid', localKey: 'uuid' })
  declare vendorConversation: HasOne<typeof VendorConversation>
}
