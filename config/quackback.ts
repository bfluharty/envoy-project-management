import env from '#start/env'
import { resolveQuackbackConfig } from '#utils/quackback_config'

export function getQuackbackConfig() {
  return resolveQuackbackConfig({
    enabled: env.get('QUACKBACK_ENABLED') ?? false,
    baseUrl: env.get('QUACKBACK_BASE_URL'),
    widgetSecret: env.get('QUACKBACK_WIDGET_SECRET'),
  })
}
