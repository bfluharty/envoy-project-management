import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserRoleService from '#services/user_role_service'

export default class ConsumerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    if (!user.isActive || !(await UserRoleService.isConsumer(user))) {
      return ctx.response.status(403).send({ error: 'Consumer account required' })
    }

    return next()
  }
}
