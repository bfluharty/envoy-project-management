import { createHmac } from 'node:crypto'
import type User from '#models/user'
import { getQuackbackConfig } from '#config/quackback'
import type { QuackbackConfig } from '#utils/quackback_config'
import { QuackbackConfigurationError } from '#utils/quackback_config'

export const QUACKBACK_WIDGET_TOKEN_TTL_SECONDS = 5 * 60

type QuackbackIdentity = Pick<User, 'uuid' | 'email' | 'fullName' | 'isActive'>

type TokenOptions = {
  config?: QuackbackConfig
  now?: Date
}

export class QuackbackDisabledError extends Error {
  constructor() {
    super('Feedback is disabled')
    this.name = 'QuackbackDisabledError'
  }
}

export class QuackbackIneligibleUserError extends Error {
  constructor() {
    super('The authenticated account is not eligible for feedback')
    this.name = 'QuackbackIneligibleUserError'
  }
}

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

export default class QuackbackWidgetTokenService {
  public issue(identity: QuackbackIdentity, options: TokenOptions = {}): string {
    const config = options.config ?? getQuackbackConfig()
    if (!config.enabled) {
      throw new QuackbackDisabledError()
    }

    if (!identity.isActive) {
      throw new QuackbackIneligibleUserError()
    }

    const subject = identity.uuid?.trim()
    const email = identity.email?.trim().toLowerCase()
    if (!subject || !email) {
      throw new QuackbackConfigurationError(
        'The authenticated account is missing required feedback identity fields'
      )
    }

    const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000)
    const header = encodeJson({
      alg: 'HS256',
      typ: 'JWT',
    })
    const name = identity.fullName?.trim()
    const payload = encodeJson({
      sub: subject,
      email,
      ...(name ? { name } : {}),
      iat: issuedAt,
      exp: issuedAt + QUACKBACK_WIDGET_TOKEN_TTL_SECONDS,
    })
    const signingInput = `${header}.${payload}`
    const signature = createHmac('sha256', config.widgetSecret)
      .update(signingInput)
      .digest('base64url')

    return `${signingInput}.${signature}`
  }
}
