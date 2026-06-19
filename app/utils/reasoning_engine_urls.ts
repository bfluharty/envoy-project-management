import env from '#start/env'

function getReasoningEngineUrl() {
  return env.get('REASONING_ENGINE_URL', '')
}

export function getReasoningChatUrl() {
  return getReasoningEngineUrl() + '/reasoning/chat'
}

export function getVendorDiscoveryUrl() {
  return getReasoningEngineUrl() + '/reasoning/vendor-discovery'
}
