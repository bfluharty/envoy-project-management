import env from '#start/env'

function getReasoningEngineUrl() {
  switch (env.get('APP_ENV')) {
    case 'prod':
      return env.get('REASONING_ENGINE_URL_PROD')
    case 'dev':
      return env.get('REASONING_ENGINE_URL_DEV')
    default:
      return env.get('REASONING_ENGINE_URL_LOCAL')
  }
}

export default getReasoningEngineUrl
