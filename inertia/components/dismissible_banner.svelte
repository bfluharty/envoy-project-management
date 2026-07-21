<script lang="ts">
  import type { Snippet } from 'svelte'
  import { XIcon } from '@lucide/svelte'

  type BannerVariant = 'success' | 'info' | 'warning' | 'error'

  const {
    variant = 'info',
    class: className = '',
    role,
    autoDismiss,
    reserveSpace = true,
    onDismiss = () => {},
    children,
  }: {
    variant?: BannerVariant
    class?: string
    role?: 'alert' | 'status' | null
    autoDismiss?: boolean
    reserveSpace?: boolean
    onDismiss?: () => void
    children?: Snippet
  } = $props()

  let visible = $state(true)
  let bannerEl = $state<HTMLElement | null>(null)
  let reservedHeight = $state(0)

  const computedRole = $derived(role === undefined ? (variant === 'error' ? 'alert' : 'status') : role)
  const shouldAutoDismiss = $derived(autoDismiss ?? (variant === 'success' || variant === 'info'))
  const variantClass = $derived(
    variant === 'success'
      ? 'border-success-500/30 bg-success-500/10 text-success-700-300'
      : variant === 'warning'
        ? 'border-warning-500/30 bg-warning-500/10 text-warning-700-300'
        : variant === 'error'
          ? 'border-error-500/30 bg-error-500/10 text-error-500'
          : 'border-primary-500/30 bg-primary-500/10 text-primary-700-300'
  )

  function dismiss({ notify = true } = {}) {
    if (bannerEl) {
      reservedHeight = bannerEl.offsetHeight
    }
    visible = false
    if (notify) {
      onDismiss()
    }
  }

  $effect(() => {
    if (!visible || !shouldAutoDismiss) return

    const timeout = setTimeout(() => dismiss({ notify: false }), 5000)
    return () => clearTimeout(timeout)
  })

  $effect(() => {
    if (!visible || !bannerEl) return

    reservedHeight = bannerEl.offsetHeight
  })
</script>

{#if visible}
  <aside bind:this={bannerEl} class={`rounded-xl border p-4 text-sm ${variantClass} ${className}`} role={computedRole ?? undefined}>
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        {@render children?.()}
      </div>
      <button
        type="button"
        class="btn btn-icon btn-sm preset-tonal shrink-0"
        aria-label="Dismiss"
        onclick={dismiss}
      >
        <XIcon class="size-4" />
      </button>
    </div>
  </aside>
{:else if reserveSpace && reservedHeight > 0}
  <div aria-hidden="true" class={className} style={`height: ${reservedHeight}px;`}></div>
{/if}
