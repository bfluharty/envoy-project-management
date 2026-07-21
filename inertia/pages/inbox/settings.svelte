<script lang="ts">
  import Sidebar from '#components/sidebar.svelte'
  import DismissibleBanner from '#components/dismissible_banner.svelte'
  import { router, page } from '@inertiajs/svelte'
  import { MailIcon, Trash2Icon } from '@lucide/svelte'

  interface Connection {
    id: number
    provider: string
    email: string
    createdAt: string
  }

  const { connections = [] } = $props()
  const flash = $derived($page.props.flash || {})
  let flashErrorVisible = $state(true)
  let flashSuccessVisible = $state(true)

  function disconnect(id: number) {
    if (!confirm('Disconnect this inbox? We will stop listening for emails.')) return
    router.post('/inbox/disconnect', { id }, { preserveScroll: true })
  }

  const providerLabel = (provider: string) =>
    provider === 'gmail'
      ? 'Gmail'
      : provider === 'microsoft'
        ? 'Microsoft (unsupported)'
        : provider
</script>

<svelte:head>
  <title>Inbox - Envoy</title>
</svelte:head>

<Sidebar>
  <div class="w-full max-w-2xl p-6 space-y-6">
    <header class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
          <MailIcon class="size-8" />
          Inbox
        </h1>
        <p class="text-surface-600-400 mt-1">
          Connect your inbox so we can listen for emails and respond on your behalf.
        </p>
      </div>
      <a href="/inbox/emails" class="btn preset-tonal">View emails</a>
    </header>

    {#if flash.error && flashErrorVisible}
      <DismissibleBanner variant="error" onDismiss={() => (flashErrorVisible = false)}>
        <span>{flash.error}</span>
      </DismissibleBanner>
    {/if}

    {#if flash.success && flashSuccessVisible}
      <DismissibleBanner variant="success" onDismiss={() => (flashSuccessVisible = false)}>
        <span>{flash.success}</span>
      </DismissibleBanner>
    {/if}

    <section class="card preset-outlined-surface-200-800 p-6 space-y-4">
      <h2 class="h4">Connected inboxes</h2>
      {#if connections.length === 0}
        <p class="text-surface-600-400">No inbox connected yet. Connect Gmail below.</p>
      {:else}
        <ul class="space-y-3">
          {#each connections as conn (conn.id)}
            <li
              class="flex items-center justify-between gap-4 p-3 rounded-lg bg-surface-100-900 border border-surface-200-800"
            >
              <div>
                <span class="font-medium">{providerLabel(conn.provider)}</span>
                <span class="text-surface-600-400 ml-2">{conn.email}</span>
              </div>
              <button
                type="button"
                class="btn btn-icon preset-tonal-error"
                onclick={() => disconnect(conn.id)}
                title="Disconnect"
              >
                <Trash2Icon class="size-4" />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card preset-outlined-surface-200-800 p-6 space-y-4">
      <h2 class="h4">Connect an inbox</h2>
      <p class="text-surface-600-400 text-sm">
        We'll request permission to read and send email from this account. We use these permissions solely for emails sent from contacts you select.
      </p>
      <p class="text-surface-600-400 text-sm">
        If you already signed in with Google, connecting Gmail here should reuse that same account.
      </p>
      <div class="flex flex-wrap gap-3">
        <a href="/inbox/connect?provider=gmail" class="btn preset-filled-primary-500">
          Connect Gmail
        </a>
      </div>
    </section>
  </div>
</Sidebar>
