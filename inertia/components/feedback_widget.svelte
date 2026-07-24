<script lang="ts">
  import { page } from '@inertiajs/svelte'
  import { onMount } from 'svelte'
  import { feedbackWidgetMetadata } from '../utils/quackback_metadata'
  import {
    mountQuackbackWidget,
    updateQuackbackMetadata,
  } from '../utils/quackback_widget'

  onMount(() => {
    let release: (() => void) | null = null
    let activeBaseUrl: string | null = null
    let activeUserUuid: string | null = null

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
      unsubscribe()
      release?.()
    }
  })
</script>
