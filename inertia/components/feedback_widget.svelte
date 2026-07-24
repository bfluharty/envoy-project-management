<script lang="ts">
  import { ImageIcon, XIcon } from '@lucide/svelte'
  import { page } from '@inertiajs/svelte'
  import { onMount } from 'svelte'
  import { feedbackWidgetMetadata } from '../utils/quackback_metadata'
  import {
    mountQuackbackWidget,
    subscribeQuackbackWidgetVisibility,
    updateQuackbackMetadata,
  } from '../utils/quackback_widget'

  const SCREENSHOT_TIP_DISMISSED_KEY = 'envoy_feedback_screenshot_tip_dismissed'

  let isWidgetOpen = $state(false)
  let isScreenshotTipDismissed = $state(true)

  function dismissScreenshotTip() {
    isScreenshotTipDismissed = true
    try {
      window.localStorage.setItem(SCREENSHOT_TIP_DISMISSED_KEY, 'true')
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }

  onMount(() => {
    let release: (() => void) | null = null
    let activeBaseUrl: string | null = null
    let activeUserUuid: string | null = null

    try {
      isScreenshotTipDismissed =
        window.localStorage.getItem(SCREENSHOT_TIP_DISMISSED_KEY) === 'true'
    } catch {
      isScreenshotTipDismissed = false
    }

    const unsubscribeVisibility = subscribeQuackbackWidgetVisibility((isOpen) => {
      isWidgetOpen = isOpen
    })

    const unsubscribe = page.subscribe((currentPage) => {
      const config = currentPage.props.feedbackWidget
      const context = currentPage.props.feedbackWidgetContext
      const userUuid = currentPage.props.user?.uuid ?? null

      if (!config || !context) {
        release?.()
        release = null
        activeBaseUrl = null
        activeUserUuid = null
        return
      }

      const metadata = feedbackWidgetMetadata(context, currentPage.url)
      if (!release || activeBaseUrl !== config.baseUrl || activeUserUuid !== userUuid) {
        release?.()
        activeBaseUrl = config.baseUrl
        activeUserUuid = userUuid
        release = mountQuackbackWidget({
          baseUrl: config.baseUrl,
          metadata,
        })
      } else {
        updateQuackbackMetadata(metadata)
      }
    })

    return () => {
      unsubscribeVisibility()
      unsubscribe()
      release?.()
    }
  })
</script>

{#if isWidgetOpen && !isScreenshotTipDismissed}
  <aside
    aria-label="Screenshot tip"
    aria-live="polite"
    class="feedback-screenshot-tip fixed top-16 left-1/2 w-[min(23rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-primary-500/30 bg-surface-50-950 p-3 pr-10 shadow-xl sm:top-20 sm:left-6 sm:translate-x-0"
  >
    <div class="flex items-start gap-2.5">
      <ImageIcon class="mt-0.5 size-4 shrink-0 text-primary-500" aria-hidden="true" />
      <p class="text-sm leading-snug text-surface-700-300">
        <strong class="font-semibold text-surface-950-50">Reporting a bug?</strong>
        Paste or drag a screenshot into “Add more details…”
      </p>
    </div>
    <button
      type="button"
      aria-label="Dismiss screenshot tip"
      class="absolute right-2 top-2 rounded-md p-1 text-surface-500 transition-colors hover:bg-surface-100-900 hover:text-surface-950-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      onclick={dismissScreenshotTip}
    >
      <XIcon class="size-4" aria-hidden="true" />
    </button>
  </aside>
{/if}

<style>
  .feedback-screenshot-tip {
    z-index: 2147483647;
  }

  :global(.quackback-panel) {
    z-index: 2147483645 !important;
  }

  :global(.quackback-backdrop) {
    z-index: 2147483644 !important;
  }
</style>
