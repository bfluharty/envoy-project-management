import type { HttpContext } from '@adonisjs/core/http'

export default class InternalController {
  async forgotPasswordEmail({ response }: HttpContext) {
    return response.status(410).send({
      error: 'Password reset emails are sent directly by the web app in this build.',
    })
  }
}
