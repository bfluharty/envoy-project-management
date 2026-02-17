import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Project from './project.js'
import Vendor from './vendor.js'

export default class ProjectVendor extends BaseModel {
  static table = 'envoy_schema.project_vendors'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'project_uuid' })
  declare projectUuid: string

  @column({ columnName: 'vendor_uuid' })
  declare vendorUuid: string

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @belongsTo(() => Project, { foreignKey: 'projectUuid', localKey: 'uuid' })
  declare project: BelongsTo<typeof Project>

  @belongsTo(() => Vendor, { foreignKey: 'vendorUuid', localKey: 'uuid' })
  declare vendor: BelongsTo<typeof Vendor>
}
