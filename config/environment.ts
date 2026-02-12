import env from '#start/env'

function getReasoningEngineUrl() {
  switch (env.get('NODE_ENV')) {
    case 'production':
      return env.get('REASONING_ENGINE_URL_PROD')
    default:
      return env.get('REASONING_ENGINE_URL_DEV')
  }
}

export default getReasoningEngineUrl
