<script lang="ts">
  import { SunIcon, MonitorIcon, MoonIcon } from '@lucide/svelte'
  import { colorMode, type ColorMode } from '../stores/ui'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'

  onMount(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (get(colorMode) === 'system') colorMode.applyMode('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  })

  const options: { value: ColorMode; Icon: typeof SunIcon; label: string }[] = [
    { value: 'light',  Icon: SunIcon,     label: 'Light' },
    { value: 'system', Icon: MonitorIcon, label: 'System' },
    { value: 'dark',   Icon: MoonIcon,    label: 'Dark' },
  ]
</script>

<div role="group" aria-label="Color theme" class="flex items-center rounded-lg border border-surface-200-800 p-0.5 gap-0.5">
  {#each options as { value, Icon, label }}
    <button
      onclick={() => colorMode.set(value)}
      aria-label="{label} mode"
      aria-pressed={$colorMode === value}
      class="btn btn-sm p-2 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 {$colorMode === value ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
    >
      <Icon class="size-4" />
    </button>
  {/each}
</div>
