import env from '#start/env'

function getReasoningEngineUrl() {
  switch (env.get('NODE_ENV')) {
    case 'development':
      return env.get('REASONING_ENGINE_URL_DEV')
    default:
      return env.get('REASONING_ENGINE_URL_LOCAL')
  }
}

export default getReasoningEngineUrl
