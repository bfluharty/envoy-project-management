<script lang="ts">
  import Sidebar from '#components/sidebar.svelte'
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

  function disconnect(id: number) {
    if (!confirm('Disconnect this inbox? We will stop listening for vendor emails.')) return
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
          Connect your inbox so we can listen for vendor emails and respond on your behalf.
        </p>
      </div>
      <a href="/inbox/emails" class="btn preset-tonal">View vendor emails</a>
    </header>

    {#if flash.error}
      <div class="alert preset-tonal-error p-4 rounded-lg">
        <span>{flash.error}</span>
      </div>
    {/if}

    {#if flash.success}
      <div
        class="alert rounded-lg border border-success-500/20 bg-success-500/10 p-4 text-surface-950 dark:border-surface-200-800 dark:bg-surface-100-900/40 dark:text-surface-50"
      >
        <span>{flash.success}</span>
      </div>
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
        We'll request permission to read and send email from this account. We use it only to listen
        for vendor emails and send replies on your behalf.
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
