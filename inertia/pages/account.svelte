<script lang="ts">
  import Sidebar from '#components/sidebar.svelte'
  import ThemeToggle from '#components/theme_toggle.svelte'
  import UserAvatar, { type AvatarData } from '#components/user_avatar.svelte'
  import { router, page } from '@inertiajs/svelte'
  import { KeyRoundIcon, MailIcon, MonitorCogIcon, PlugZapIcon, Trash2Icon, UploadIcon } from '@lucide/svelte'

  interface Connection {
    id: number
    provider: string
    email: string
    createdAt: string | null
  }

  interface Account {
    fullName: string
    email: string
    avatar: AvatarData
    socialAccountConnected: boolean
    linkedAuthProviderLabel: string | null
    sessionLoginMethod: 'password' | 'google' | 'microsoft' | null
    passwordAuthEnabled: boolean
    canChangePasswordDirectly: boolean
    canSendPasswordSetupEmail: boolean
  }

  const { account, connections = [] }: { account: Account; connections: Connection[] } = $props()
  const flash = $derived($page.props.flash || {})
  const pageErrors = $derived(($page.props.errors || {}) as Record<string, string[]>)
  let currentPassword = $state('')
  let password = $state('')
  let passwordConfirmation = $state('')
  let passwordErrors = $state<Record<string, string[]>>({})
  let passwordProcessing = $state(false)
  let passwordSetupProcessing = $state(false)
  let avatarProcessing = $state(false)
  let avatarRemovalProcessing = $state(false)

  function disconnect(id: number) {
    if (!confirm('Disconnect this inbox? Envoy will stop listening for vendor emails from it.')) return
    router.post('/inbox/disconnect', { id }, { preserveScroll: true })
  }

  function changePassword(event: Event) {
    event.preventDefault()
    passwordProcessing = true
    passwordErrors = {}

    router.post(
      '/account/password',
      { currentPassword, password, passwordConfirmation },
      {
        preserveScroll: true,
        onFinish: () => {
          passwordProcessing = false
        },
        onError: (errors) => {
          passwordErrors = (errors || {}) as Record<string, string[]>
        },
        onSuccess: () => {
          currentPassword = ''
          password = ''
          passwordConfirmation = ''
          passwordErrors = {}
        },
      }
    )
  }

  function sendPasswordSetupEmail() {
    passwordSetupProcessing = true

    router.post(
      '/account/password/setup-email',
      {},
      {
        preserveScroll: true,
        onFinish: () => {
          passwordSetupProcessing = false
        },
      }
    )
  }

  function providerLabel(provider: string) {
    return provider === 'gmail'
      ? 'Gmail'
      : provider === 'microsoft'
        ? 'Microsoft'
        : provider
  }

  function formatConnectedAt(value: string | null) {
    if (!value) return ''
    try {
      return new Date(value).toLocaleDateString()
    } catch {
      return value
    }
  }

  function passwordSetupDescription() {
    if (account.sessionLoginMethod === 'google' || account.sessionLoginMethod === 'microsoft') {
      const provider = account.sessionLoginMethod === 'google' ? 'Google' : 'Microsoft'
      return `This session was signed in with ${provider}. To enable or update email/password sign-in, we'll send a secure link to ${account.email}.`
    }

    return `This account is linked to ${linkedProviderText()}. To enable or update email/password sign-in, we'll send a secure link to ${account.email}.`
  }

  function linkedProviderText() {
    return account.linkedAuthProviderLabel ?? 'a social provider'
  }

  function handleAvatarUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    avatarProcessing = true

    router.post(
      '/account/avatar',
      { avatar: file },
      {
        forceFormData: true,
        preserveScroll: true,
        onFinish: () => {
          avatarProcessing = false
          input.value = ''
        },
      }
    )
  }

  function removeUploadedAvatar() {
    avatarRemovalProcessing = true

    router.delete('/account/avatar', {
      preserveScroll: true,
      onFinish: () => {
        avatarRemovalProcessing = false
      },
    })
  }

</script>

<svelte:head>
  <title>Account - Envoy</title>
</svelte:head>

<Sidebar>
  <div class="w-full p-6 space-y-6">
    <header class="space-y-2">
      <h1 class="text-3xl font-bold">Account</h1>
      <p class="text-surface-600-400">
        Manage the connected inboxes Envoy uses for outreach and replies.
      </p>
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

    <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div class="space-y-6">
        <div class="card preset-outlined-surface-200-800 p-6 space-y-4">
          <div class="flex items-center gap-4">
            <UserAvatar avatar={account.avatar} size="xl" testId="account-avatar" />
            <div class="min-w-0">
              <h2 class="text-xl font-semibold">{account.fullName}</h2>
              <p class="break-all text-surface-600-400">{account.email}</p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <label class="btn preset-tonal cursor-pointer w-fit">
              <UploadIcon class="size-4" />
              <span>{avatarProcessing ? 'Uploading...' : 'Upload photo'}</span>
              <input
                aria-label="Upload profile image"
                class="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={avatarProcessing}
                onchange={handleAvatarUpload}
              />
            </label>

            {#if account.avatar.source === 'upload'}
              <button
                type="button"
                class="btn preset-tonal-error w-fit"
                disabled={avatarRemovalProcessing}
                onclick={removeUploadedAvatar}
              >
                <Trash2Icon class="size-4" />
                <span>{avatarRemovalProcessing ? 'Removing...' : 'Remove uploaded photo'}</span>
              </button>
            {/if}
          </div>

          <div class="space-y-2 text-sm">
            <p class="flex items-center gap-2">
              <MailIcon class="size-4 text-surface-600-400" />
              <span>Primary email: {account.email}</span>
            </p>
            <p class="flex items-center gap-2">
              <PlugZapIcon class="size-4 text-surface-600-400" />
              <span>
                {account.socialAccountConnected
                  ? `${linkedProviderText()} account linked`
                  : 'No social account linked'}
              </span>
            </p>
          </div>
        </div>

        {#if account.passwordAuthEnabled}
          <section class="card preset-outlined-surface-200-800 p-6 space-y-4">
            <div class="flex items-start gap-4">
              <div
                class="flex size-12 items-center justify-center rounded-full bg-surface-200-800/70 text-surface-700-300"
              >
                <KeyRoundIcon class="size-6" />
              </div>
              <div class="space-y-1">
                <h2 class="text-xl font-semibold">Password</h2>
                <p class="text-sm text-surface-600-400">
                  Manage the password you use to sign in with email.
                </p>
              </div>
            </div>

            {#if account.canChangePasswordDirectly}
              <form class="space-y-4" onsubmit={changePassword}>
                <label class="label">
                  <span>Current password</span>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autocomplete="current-password"
                    required
                    bind:value={currentPassword}
                    class="input"
                    class:input-error={passwordErrors.currentPassword || pageErrors.currentPassword}
                    placeholder="Enter your current password"
                  />
                  {#if passwordErrors.currentPassword || pageErrors.currentPassword}
                    <p class="text-error-500 text-sm">
                      {(passwordErrors.currentPassword || pageErrors.currentPassword)?.[0]}
                    </p>
                  {/if}
                </label>

                <label class="label">
                  <span>New password</span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="new-password"
                    required
                    bind:value={password}
                    class="input"
                    class:input-error={passwordErrors.password || pageErrors.password}
                    placeholder="At least 8 characters"
                  />
                  {#if passwordErrors.password || pageErrors.password}
                    <p class="text-error-500 text-sm">
                      {(passwordErrors.password || pageErrors.password)?.[0]}
                    </p>
                  {/if}
                </label>

                <label class="label">
                  <span>Confirm new password</span>
                  <input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type="password"
                    autocomplete="new-password"
                    required
                    bind:value={passwordConfirmation}
                    class="input"
                    class:input-error={passwordErrors.passwordConfirmation || pageErrors.passwordConfirmation}
                    placeholder="Confirm your new password"
                  />
                  {#if passwordErrors.passwordConfirmation || pageErrors.passwordConfirmation}
                    <p class="text-error-500 text-sm">
                      {(passwordErrors.passwordConfirmation || pageErrors.passwordConfirmation)?.[0]}
                    </p>
                  {/if}
                </label>

                <button
                  type="submit"
                  disabled={passwordProcessing}
                  class="btn preset-filled-primary-500 w-fit"
                >
                  {passwordProcessing ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            {:else if account.canSendPasswordSetupEmail}
              <div
                class="space-y-4 rounded-xl border border-surface-200-800 bg-surface-100-900/40 p-4"
              >
                <p class="text-sm text-surface-600-400">
                  {passwordSetupDescription()}
                </p>
                <button
                  type="button"
                  class="btn preset-filled-primary-500 w-fit"
                  disabled={passwordSetupProcessing}
                  onclick={sendPasswordSetupEmail}
                >
                  {passwordSetupProcessing
                    ? 'Sending setup link...'
                    : 'Email me a password setup link'}
                </button>
              </div>
            {/if}
          </section>
        {/if}
      </div>

      <div class="space-y-6">
        <section class="card preset-outlined-surface-200-800 p-6 space-y-4">
          <div class="flex items-start gap-4">
            <div
              class="flex size-12 items-center justify-center rounded-full bg-surface-200-800/70 text-surface-700-300"
            >
              <MonitorCogIcon class="size-6" />
            </div>
            <div class="space-y-1">
              <h2 class="text-xl font-semibold">Appearance</h2>
              <p class="text-sm text-surface-600-400">
                Choose how Envoy looks on this device.
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-sm font-medium text-surface-700-300">Color theme</p>
            <ThemeToggle />
          </div>
        </section>

        <section id="email-accounts" class="card preset-outlined-surface-200-800 p-6 space-y-4">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 class="text-xl font-semibold">Connected Email Accounts</h2>
              <p class="text-sm text-surface-600-400 mt-1">
                Envoy sends outreach from your connected inbox when available. Otherwise it falls back
                to the Envoy system mailbox.
              </p>
            </div>
            {#if connections.length === 0}
              <div class="flex gap-2 flex-wrap">
                <a href="/inbox/connect?provider=gmail" class="btn preset-filled-primary-500">
                  Connect Gmail
                </a>
              </div>
            {/if}
          </div>

          {#if connections.length === 0}
            <div class="rounded-xl border border-dashed border-surface-200-800 p-5 text-sm text-surface-600-400">
              No inbox connected yet. Connect Gmail to send project outreach from your own address
              and sync vendor replies back into Outreach.
            </div>
          {:else}
            <ul class="space-y-3">
              {#each connections as connection (connection.id)}
                <li class="rounded-xl border border-surface-200-800 bg-surface-100-900/40 p-4">
                  <div class="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p class="font-medium">{providerLabel(connection.provider)}</p>
                      <p class="text-sm text-surface-600-400">{connection.email}</p>
                      <p class="text-xs text-surface-600-400 mt-1">
                        Connected {formatConnectedAt(connection.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn preset-tonal-error btn-sm"
                      onclick={() => disconnect(connection.id)}
                    >
                      Disconnect
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>
    </section>
  </div>
</Sidebar>
