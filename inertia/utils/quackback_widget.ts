import { safeFeedbackWidgetMetadata, type FeedbackWidgetMetadata } from './quackback_metadata'

type QuackbackCommand = ((...args: unknown[]) => unknown) & {
  q?: unknown[][]
  __envoyQueue?: boolean
}

type IdentifyPayload = {
  success?: boolean
}

type WidgetVisibilitySubscriber = (isOpen: boolean) => void

declare global {
  interface Window {
    Quackback?: QuackbackCommand
  }
}

const SDK_ELEMENT_ID = 'envoy-quackback-widget-sdk'
const TOKEN_ENDPOINT = '/api/feedback/widget-token'

let mountCount = 0
let activeBaseUrl: string | null = null
let latestMetadata: FeedbackWidgetMetadata | null = null
let activationPromise: Promise<void> | null = null
let tokenRequestController: AbortController | null = null
let identifyHandler: ((payload: IdentifyPayload) => void) | null = null
let openHandler: (() => void) | null = null
let closeHandler: (() => void) | null = null
let cleanupTimer: ReturnType<typeof setTimeout> | null = null
let runtimeGeneration = 0
let activationFailed = false
let isWidgetOpen = false
const visibilitySubscribers = new Set<WidgetVisibilitySubscriber>()

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function developmentDiagnostic(message: string) {
  if (import.meta.env.DEV) {
    console.debug(`[feedback-widget] ${message}`)
  }
}

function command(...args: unknown[]): unknown {
  if (!isBrowser()) return undefined
  return window.Quackback?.(...args)
}

function ensureCommandQueue(): QuackbackCommand {
  if (window.Quackback) return window.Quackback

  const queuedCommand = ((...args: unknown[]) => {
    queuedCommand.q = queuedCommand.q ?? []
    queuedCommand.q.push(args)
  }) as QuackbackCommand
  queuedCommand.q = []
  queuedCommand.__envoyQueue = true
  window.Quackback = queuedCommand
  return queuedCommand
}

function removeSdkElement() {
  document.getElementById(SDK_ELEMENT_ID)?.remove()
}

function updateWidgetVisibility(isOpen: boolean) {
  if (isWidgetOpen === isOpen) return

  isWidgetOpen = isOpen
  for (const subscriber of visibilitySubscribers) {
    subscriber(isOpen)
  }
}

function teardownRuntime(options: { logout: boolean; preserveFailure?: boolean }) {
  if (!isBrowser()) return

  runtimeGeneration += 1
  tokenRequestController?.abort()
  tokenRequestController = null

  if (identifyHandler) {
    command('off', 'identify', identifyHandler)
  }
  if (openHandler) {
    command('off', 'open', openHandler)
  }
  if (closeHandler) {
    command('off', 'close', closeHandler)
  }
  if (options.logout) {
    command('logout')
  }
  command('destroy')

  removeSdkElement()
  identifyHandler = null
  openHandler = null
  closeHandler = null
  activationPromise = null
  activeBaseUrl = null
  latestMetadata = null
  updateWidgetVisibility(false)

  if (window.Quackback) {
    delete window.Quackback
  }
  if (!options.preserveFailure) {
    activationFailed = false
  }
}

function handleIdentify(payload: IdentifyPayload) {
  if (payload?.success === true) return

  activationFailed = true
  developmentDiagnostic('verified identity was rejected')
  teardownRuntime({ logout: true, preserveFailure: true })
}

function appendSdk(baseUrl: string, generation: number) {
  if (document.getElementById(SDK_ELEMENT_ID)) return

  const script = document.createElement('script')
  script.id = SDK_ELEMENT_ID
  script.async = true
  script.src = `${baseUrl}/api/widget/sdk.js`
  script.referrerPolicy = 'strict-origin-when-cross-origin'
  script.addEventListener(
    'error',
    () => {
      if (generation !== runtimeGeneration) return
      activationFailed = true
      developmentDiagnostic('SDK could not be loaded')
      teardownRuntime({ logout: false, preserveFailure: true })
    },
    { once: true }
  )
  document.head.appendChild(script)
}

async function initialize(baseUrl: string, generation: number) {
  const controller = new AbortController()
  tokenRequestController = controller

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      developmentDiagnostic('identity token was unavailable')
      return
    }

    const body = (await response.json()) as { ssoToken?: unknown }
    if (typeof body.ssoToken !== 'string' || !body.ssoToken) {
      developmentDiagnostic('identity token response was invalid')
      return
    }

    if (
      controller.signal.aborted ||
      generation !== runtimeGeneration ||
      mountCount === 0 ||
      activeBaseUrl !== baseUrl
    ) {
      return
    }

    ensureCommandQueue()
    identifyHandler = handleIdentify
    openHandler = () => updateWidgetVisibility(true)
    closeHandler = () => updateWidgetVisibility(false)
    command('on', 'identify', identifyHandler)
    command('on', 'open', openHandler)
    command('on', 'close', closeHandler)
    command('init', {
      placement: 'right',
      identity: { ssoToken: body.ssoToken },
    })
    if (latestMetadata) {
      command('metadata', latestMetadata)
    }
    appendSdk(baseUrl, generation)
  } catch {
    if (!controller.signal.aborted) {
      developmentDiagnostic('identity token request failed')
    }
  } finally {
    if (tokenRequestController === controller) {
      tokenRequestController = null
    }
  }
}

export function updateQuackbackMetadata(metadata: FeedbackWidgetMetadata) {
  latestMetadata = safeFeedbackWidgetMetadata(metadata)
  if (isBrowser() && window.Quackback) {
    command('metadata', latestMetadata)
  }
}

export function subscribeQuackbackWidgetVisibility(
  subscriber: WidgetVisibilitySubscriber
): () => void {
  visibilitySubscribers.add(subscriber)
  subscriber(isWidgetOpen)

  return () => {
    visibilitySubscribers.delete(subscriber)
  }
}

export function mountQuackbackWidget(options: {
  baseUrl: string
  metadata: FeedbackWidgetMetadata
}): () => void {
  if (!isBrowser()) return () => {}

  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
  }

  mountCount += 1
  if (activeBaseUrl && activeBaseUrl !== options.baseUrl) {
    teardownRuntime({ logout: true })
  }
  activeBaseUrl = options.baseUrl
  updateQuackbackMetadata(options.metadata)

  if (!activationPromise && !window.Quackback && !activationFailed) {
    const generation = runtimeGeneration
    activationPromise = initialize(options.baseUrl, generation).finally(() => {
      if (generation === runtimeGeneration) {
        activationPromise = null
      }
    })
  }

  let released = false
  return () => {
    if (released) return
    released = true
    mountCount = Math.max(0, mountCount - 1)

    if (mountCount === 0) {
      cleanupTimer = setTimeout(() => {
        cleanupTimer = null
        if (mountCount === 0) {
          teardownRuntime({ logout: true })
        }
      }, 0)
    }
  }
}

export function destroyQuackbackWidget() {
  if (!isBrowser()) return

  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
  }
  mountCount = 0
  teardownRuntime({ logout: true })
}
