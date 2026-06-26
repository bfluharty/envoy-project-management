import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, beforeCreate, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { v4 as uuidv4 } from 'uuid'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import UserEntitlement from './user_entitlement.js'
import Vendor from './vendor.js'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  static table = 'envoy_schema.users'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(user: User) {
    if (!user.uuid) {
      user.uuid = uuidv4()
    }
  }

  @column()
  declare fullName: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column({ columnName: 'provider_id' })
  declare providerId: string | null

  @column({ columnName: 'google_avatar_url' })
  declare googleAvatarUrl: string | null

  @column({ columnName: 'uploaded_avatar_path' })
  declare uploadedAvatarPath: string | null

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @hasMany(() => Project, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare projects: HasMany<typeof Project>

  @hasMany(() => Vendor, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare vendors: HasMany<typeof Vendor>

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column({ columnName: 'entitlement' })
  declare entitlementId: number

  @belongsTo(() => UserEntitlement, { foreignKey: 'entitlementId' })
  declare entitlement: BelongsTo<typeof UserEntitlement>
}
