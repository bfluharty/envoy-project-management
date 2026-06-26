import {
  isInboxProvider,
  type InboxAuthProvider,
  type InboxProvider,
} from './inbox_provider_contracts.js'

const providers = new Map<InboxProvider, InboxAuthProvider>()

export function registerInboxAuthProvider(provider: InboxAuthProvider) {
  providers.set(provider.provider, provider)
}

export function getInboxAuthProvider(provider: unknown): InboxAuthProvider {
  if (!isInboxProvider(provider)) {
    throw new Error('Unsupported inbox provider')
  }

  const registered = providers.get(provider)
  if (!registered) {
    throw new Error(`Inbox provider is not registered: ${provider}`)
  }

  return registered
}

export function listRegisteredInboxAuthProviders(): InboxProvider[] {
  return [...providers.keys()]
}
