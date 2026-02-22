import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Currency extends BaseModel {
  static table = 'envoy_schema.currencies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare symbol?: string

  @column({ columnName: 'is_active' })
  declare isActive: boolean
}
