<script lang="ts">
  import { tick, type Snippet } from 'svelte'

  const {
    id,
    title,
    href,
    linkText,
    children,
  }: {
    id: string
    title: string
    href: string
    linkText: string
    children: Snippet
  } = $props()

  let dialogElement = $state<HTMLDialogElement>()
  let triggerElement = $state<HTMLAnchorElement>()
  let closeButton = $state<HTMLButtonElement>()

  function isPlainPrimaryClick(event: MouseEvent) {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    )
  }

  async function openDialog(event: MouseEvent) {
    if (!isPlainPrimaryClick(event) || !dialogElement) return

    event.preventDefault()
    dialogElement.showModal()
    await tick()
    closeButton?.focus()
  }

  function closeDialog() {
    dialogElement?.close()
  }

  function restoreTriggerFocus() {
    triggerElement?.focus()
  }
</script>

<a
  bind:this={triggerElement}
  {href}
  class="rounded text-primary-500 underline underline-offset-2 hover:text-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
  aria-haspopup="dialog"
  aria-controls={id}
  onclick={openDialog}
>
  {linkText}
</a>

<dialog
  bind:this={dialogElement}
  {id}
  aria-labelledby={`${id}-title`}
  onclose={restoreTriggerFocus}
  class="legal-document-dialog w-[min(52rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-surface-200-800 bg-surface-50-950 p-0 text-surface-950-50 shadow-2xl"
>
  <div class="flex max-h-[min(48rem,calc(100dvh-2rem))] min-h-0 flex-col">
    <header
      class="flex shrink-0 items-center justify-between gap-4 border-b border-surface-200-800 px-5 py-4 sm:px-6"
    >
      <h2 id={`${id}-title`} class="text-xl font-semibold sm:text-2xl">{title}</h2>
      <button
        bind:this={closeButton}
        type="button"
        class="btn btn-sm preset-tonal shrink-0"
        onclick={closeDialog}
      >
        Close
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  .legal-document-dialog::backdrop {
    background: rgb(0 0 0 / 0.68);
    backdrop-filter: blur(2px);
  }
</style>
