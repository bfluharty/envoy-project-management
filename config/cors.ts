import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

function getAppOrigin() {
  const appUrl = env.get('APP_URL')

  if (!appUrl) {
    return false
  }

  try {
    return new URL(appUrl).origin
  } catch {
    return false
  }
}

const appOrigin = getAppOrigin()

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: appOrigin ? [appOrigin] : false,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
