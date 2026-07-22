import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true,
      name: 'Envoy Project Management',
      level: env.get('LOG_LEVEL'),
      ...(app.inProduction
        ? {
            formatters: {
              level: (label: string) => ({ level: label }),
            },
          }
        : {
            transport: {
              targets: targets().push(targets.pretty()).toArray(),
            },
          }),
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
