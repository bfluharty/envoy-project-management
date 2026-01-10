import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  protected tableName = 'envoy_schema.currencies'

  async up() {
    this.defer(async () => {
      await db.table(this.tableName).insert([
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
        { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
        { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
        { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
        { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
        { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
        { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
        { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
        { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
        { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
        { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
        { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
        { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
        { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
      ])
    })
  }

  async down() {
    this.defer(async () => {
      await db
        .from(this.tableName)
        .whereIn('code', [
          'USD',
          'EUR',
          'GBP',
          'JPY',
          'AUD',
          'CAD',
          'CHF',
          'CNY',
          'SEK',
          'NZD',
          'MXN',
          'SGD',
          'HKD',
          'NOK',
          'KRW',
          'TRY',
          'RUB',
          'INR',
          'BRL',
          'ZAR',
        ])
        .delete()
    })
  }
}
