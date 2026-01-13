import { DateTime } from 'luxon'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Conversation from './conversation.js'
import Vendor from './vendor.js'
import Currency from './currency.js'
import User from './user.js'

export default class Project extends BaseModel {
  static table = 'envoy_schema.projects'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'uuid' })
  declare uuid: string

  @beforeCreate()
  public static assignUuid(project: Project) {
    if (!project.uuid) {
      project.uuid = uuidv4()
    }
  }

  @column()
  declare title: string

  @column()
  declare description?: string

  @column()
  declare location?: object

  @column.date({ columnName: 'start_date' })
  declare startDate?: DateTime

  @column.date({ columnName: 'end_date' })
  declare endDate?: DateTime

  @column.date({ columnName: 'deadline' })
  declare deadline?: DateTime

  @column({ columnName: 'budget_amount' })
  declare budgetAmount?: number

  @column({ columnName: 'budget_currency_id' })
  declare budgetCurrencyId?: number

  @belongsTo(() => Currency, { foreignKey: 'budgetCurrencyId' })
  declare budgetCurrency?: BelongsTo<typeof Currency>

  @column()
  declare goals?: string

  @column({ columnName: 'user_uuid' })
  declare userUuid: string

  @belongsTo(() => User, { foreignKey: 'userUuid', localKey: 'uuid' })
  declare user: BelongsTo<typeof User>

  @column.dateTime({ columnName: 'created_timestamp', autoCreate: true })
  declare createdTimestamp: DateTime

  @column.dateTime({ columnName: 'modified_timestamp', autoCreate: true, autoUpdate: true })
  declare modifiedTimestamp: DateTime

  @hasMany(() => Conversation, { foreignKey: 'projectUuid' })
  declare conversations: HasMany<typeof Conversation>

  @hasMany(() => Vendor, { foreignKey: 'projectUuid' })
  declare vendors: HasMany<typeof Vendor>

  @column({ columnName: 'is_active' })
  declare isActive: boolean
}
