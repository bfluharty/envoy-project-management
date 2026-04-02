<script lang="ts">
  export interface AvatarData {
    url: string | null
    source: 'upload' | 'google' | 'generated'
    initials: string
    displayName: string
  }

  const {
    avatar,
    size = 'md',
    decorative = false,
    testId,
    class: className = '',
  }: {
    avatar: AvatarData
    size?: 'sm' | 'md' | 'lg' | 'xl'
    decorative?: boolean
    testId?: string
    class?: string
  } = $props()

  const sizeClasses = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
    xl: 'size-14 text-lg',
  }

  let imageFailed = $state(false)

  $effect(() => {
    avatar.url
    imageFailed = false
  })
</script>

<div
  class={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-500/15 font-semibold tracking-wide text-primary-600 ${sizeClasses[size]} ${className}`}
  data-avatar-source={avatar.source}
  data-testid={testId}
  aria-hidden={decorative}
  aria-label={decorative ? undefined : `${avatar.displayName} avatar`}
>
  {#if avatar.url && !imageFailed}
    <img
      src={avatar.url}
      alt={decorative ? '' : `${avatar.displayName} avatar`}
      class="size-full object-cover"
      loading="eager"
      referrerpolicy="no-referrer"
      onerror={() => {
        imageFailed = true
      }}
    />
  {:else}
    <span aria-hidden="true">{avatar.initials}</span>
  {/if}
</div>
