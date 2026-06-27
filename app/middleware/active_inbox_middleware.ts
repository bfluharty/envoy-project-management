import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserInboxConnection from '#models/user_inbox_connection'

export default class ActiveInboxMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const hasActivePrimaryInbox = await UserInboxConnection.query()
      .where('user_uuid', user.uuid)
      .where('is_primary', true)
      .where('status', 'active')
      .first()

    if (hasActivePrimaryInbox) {
      return next()
    }

    if (ctx.request.method() === 'GET') {
      ctx.session.put('auth.intended_url', ctx.request.url())
    }

    if (ctx.request.url().startsWith('/api/')) {
      return ctx.response.status(409).send({
        error: 'Envoy requires an active connected email account.',
        reconnectUrl: '/account#email-accounts',
      })
    }

    ctx.session.flash('error', 'Connect your email account before continuing.')
    return ctx.response.redirect('/account#email-accounts')
  }
}
