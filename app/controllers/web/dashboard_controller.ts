import type { HttpContext } from '@adonisjs/core/http'
import Currency from '#models/currency'

export default class DashboardController {
  async show({ inertia, auth }: HttpContext) {
    const user = auth.user
    const currencies = await Currency.query().where('is_active', true).orderBy('code', 'asc')

    return inertia.render('home', {
      user,
      currencies: currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
      })),
    })
  }
}
