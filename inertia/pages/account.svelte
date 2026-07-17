<script lang="ts">
  import Sidebar from '#components/sidebar.svelte'
  import ThemeToggle from '#components/theme_toggle.svelte'
  import UserAvatar, { type AvatarData } from '#components/user_avatar.svelte'
  import { router, page } from '@inertiajs/svelte'
  import { untrack } from 'svelte'
  import {
    AlertTriangleIcon,
    CheckCircleIcon,
    KeyRoundIcon,
    MailIcon,
    MonitorCogIcon,
    PlugZapIcon,
    RefreshCwIcon,
    ShieldCheckIcon,
    Trash2Icon,
    UploadIcon,
  } from '@lucide/svelte'

  interface Connection {
    id: number
    provider: string
    email: string
    status: 'active' | 'reauth_required' | 'disconnected'
    isPrimary: boolean
    reauthReason: string | null
    reauthRequiredAt: string | null
    lastSyncAt: string | null
    lastSyncError: string | null
    watchStatus: 'active' | 'renewal_required' | 'not_configured' | 'error'
    watchExpiresAt: string | null
    subscriptionExpiresAt: string | null
    disconnectedAt: string | null
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

  interface DataPrivacy {
    modelTrainingOptIn: boolean
    modelTrainingPreferenceUpdatedAt: string | null
  }

  const {
    account,
    connections = [],
    dataPrivacy = {
      modelTrainingOptIn: false,
      modelTrainingPreferenceUpdatedAt: null,
    },
  }: {
    account: Account
    connections: Connection[]
    dataPrivacy?: DataPrivacy
  } = $props()
  const flash = $derived($page.props.flash || {})
  const pageErrors = $derived(($page.props.errors || {}) as Record<string, string[]>)
  const primaryConnection = $derived(connections.find((connection) => connection.isPrimary) ?? null)
  const activePrimaryConnection = $derived(
    connections.find((connection) => connection.isPrimary && connection.status === 'active') ?? null
  )
  const reauthConnection = $derived(
    connections.find((connection) => connection.status === 'reauth_required') ?? null
  )
  let currentPassword = $state('')
  let password = $state('')
  let passwordConfirmation = $state('')
  let passwordErrors = $state<Record<string, string[]>>({})
  let passwordProcessing = $state(false)
  let passwordSetupProcessing = $state(false)
  let avatarProcessing = $state(false)
  let avatarRemovalProcessing = $state(false)
  const initialDataPrivacy = untrack(() => dataPrivacy)
  let modelTrainingOptIn = $state(initialDataPrivacy.modelTrainingOptIn)
  let savedModelTrainingOptIn = $state(initialDataPrivacy.modelTrainingOptIn)
  let modelTrainingPreferenceUpdatedAt = $state(
    initialDataPrivacy.modelTrainingPreferenceUpdatedAt
  )
  let dataPrivacyProcessing = $state(false)
  let dataPrivacyError = $state('')
  let dataPrivacySuccess = $state('')
  const dataPrivacyChanged = $derived(modelTrainingOptIn !== savedModelTrainingOptIn)

  function disconnect(id: number) {
    if (!confirm('Disconnect this inbox? Envoy will stop listening for emails from it.')) return
    router.post('/inbox/disconnect', { id }, { preserveScroll: true })
  }

  function connectUrl(provider: string) {
    return `/inbox/connect?provider=${provider}`
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

  function formatDateTime(value: string | null) {
    if (!value) return 'Not available'
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  function statusLabel(status: Connection['status']) {
    return status === 'active'
      ? 'Active'
      : status === 'reauth_required'
        ? 'Reauthorization required'
        : 'Disconnected'
  }

  function watchStatusLabel(status: Connection['watchStatus']) {
    return status === 'active'
      ? 'Listening'
      : status === 'renewal_required'
        ? 'Renewal required'
        : status === 'not_configured'
          ? 'Not configured'
          : 'Error'
  }

  function watchExpiresAt(connection: Connection) {
    return connection.provider === 'microsoft'
      ? connection.subscriptionExpiresAt
      : connection.watchExpiresAt
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

  function saveDataPrivacy(event: SubmitEvent) {
    event.preventDefault()
    if (dataPrivacyProcessing || !dataPrivacyChanged) return

    dataPrivacyProcessing = true
    dataPrivacyError = ''
    dataPrivacySuccess = ''

    router.patch(
      '/account/data-preferences',
      { modelTrainingOptIn },
      {
        preserveScroll: true,
        onSuccess: (responsePage) => {
          const persistedPreference = responsePage.props.dataPrivacy as DataPrivacy | undefined
          const persistedOptIn = persistedPreference?.modelTrainingOptIn ?? modelTrainingOptIn

          modelTrainingOptIn = persistedOptIn
          savedModelTrainingOptIn = persistedOptIn
          modelTrainingPreferenceUpdatedAt =
            persistedPreference?.modelTrainingPreferenceUpdatedAt ??
            modelTrainingPreferenceUpdatedAt
          dataPrivacySuccess = persistedOptIn
            ? 'Model-training participation is now enabled.'
            : 'Model-training participation is now disabled.'
        },
        onError: (errors) => {
          const preferenceError = errors.modelTrainingOptIn
          dataPrivacyError = Array.isArray(preferenceError)
            ? preferenceError[0]
            : preferenceError || 'We could not save your preference. Please try again.'
        },
        onFinish: () => {
          dataPrivacyProcessing = false
        },
      }
    )
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

    {#if reauthConnection}
      <div
        class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-warning-500/30 bg-warning-500/10 p-4"
      >
        <div class="flex min-w-0 items-start gap-3">
          <AlertTriangleIcon class="mt-0.5 size-5 shrink-0 text-warning-600-400" />
          <div class="min-w-0">
            <p class="font-medium">Reconnect {providerLabel(reauthConnection.provider)}</p>
            <p class="mt-1 text-sm text-surface-700-300">
              Envoy cannot sync or send from {reauthConnection.email} until authorization is
              refreshed.
            </p>
            {#if reauthConnection.reauthReason}
              <p class="mt-1 break-words text-xs text-warning-700-300">
                {reauthConnection.reauthReason}
              </p>
            {/if}
          </div>
        </div>
        <a
          href={connectUrl(reauthConnection.provider)}
          class="btn preset-filled-primary-500 btn-sm"
        >
          <RefreshCwIcon class="size-4" />
          <span>Reconnect</span>
        </a>
      </div>
    {:else if !activePrimaryConnection}
      <div
        class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-error-500/30 bg-error-500/10 p-4"
      >
        <div class="flex min-w-0 items-start gap-3">
          <AlertTriangleIcon class="mt-0.5 size-5 shrink-0 text-error-500" />
          <div>
            <p class="font-medium">Connect an inbox to send outreach</p>
            <p class="mt-1 text-sm text-surface-700-300">
              Envoy needs one active primary inbox for email sync and approved sends.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href={connectUrl('gmail')} class="btn preset-filled-primary-500 btn-sm">
            Connect Gmail
          </a>
          <a href={connectUrl('microsoft')} class="btn preset-tonal btn-sm">
            Connect Microsoft
          </a>
        </div>
      </div>
    {/if}

    <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div class="flex h-full min-h-0 flex-col gap-6">
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

        <section
          id="email-accounts"
          class="card preset-outlined-surface-200-800 flex flex-1 flex-col space-y-4 p-6"
        >
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 class="text-xl font-semibold">Connected Email Accounts</h2>
              <p class="text-sm text-surface-600-400 mt-1">
                Envoy requires one active connected inbox for email outreach and reply sync.
              </p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <a href={connectUrl('gmail')} class="btn preset-filled-primary-500">
                {connections.length ? 'Replace with Gmail' : 'Connect Gmail'}
              </a>
              <a href={connectUrl('microsoft')} class="btn preset-tonal">
                {connections.length ? 'Replace with Microsoft' : 'Connect Microsoft'}
              </a>
            </div>
          </div>

          {#if activePrimaryConnection}
            <div
              class="rounded-xl border border-success-500/20 bg-success-500/10 p-4 text-sm"
            >
              <div class="flex items-start gap-3">
                <CheckCircleIcon class="mt-0.5 size-5 shrink-0 text-success-600-400" />
                <div class="min-w-0">
                  <p class="font-medium">
                    Primary inbox: {providerLabel(activePrimaryConnection.provider)}
                  </p>
                  <p class="mt-1 break-all text-surface-700-300">
                    {activePrimaryConnection.email}
                  </p>
                </div>
              </div>
            </div>
          {:else if primaryConnection}
            <div
              class="rounded-xl border border-warning-500/30 bg-warning-500/10 p-4 text-sm"
            >
              <div class="flex items-start gap-3">
                <AlertTriangleIcon class="mt-0.5 size-5 shrink-0 text-warning-600-400" />
                <div class="min-w-0">
                  <p class="font-medium">Primary inbox needs attention</p>
                  <p class="mt-1 break-all text-surface-700-300">{primaryConnection.email}</p>
                </div>
              </div>
            </div>
          {/if}

          {#if connections.length === 0}
            <div class="rounded-xl border border-dashed border-surface-200-800 p-5 text-sm text-surface-600-400">
              No inbox connected yet. Connect Gmail or Microsoft to send project outreach from your
              own address and sync emails back into Outreach.
            </div>
          {:else}
            <ul class="space-y-3">
              {#each connections as connection (connection.id)}
                <li class="rounded-xl border border-surface-200-800 bg-surface-100-900/40 p-4">
                  <div class="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium">{providerLabel(connection.provider)}</p>
                        {#if connection.isPrimary}
                          <span class="badge preset-tonal-primary-500 text-xs">Primary</span>
                        {/if}
                        <span
                          class="badge text-xs"
                          class:preset-tonal-success={connection.status === 'active'}
                          class:preset-tonal-warning={connection.status === 'reauth_required'}
                          class:preset-tonal-error={connection.status === 'disconnected'}
                        >
                          {statusLabel(connection.status)}
                        </span>
                      </div>
                      <p class="text-sm text-surface-600-400">{connection.email}</p>
                      <p class="text-xs text-surface-600-400 mt-1">
                        Connected {formatConnectedAt(connection.createdAt)}
                      </p>
                      {#if connection.reauthReason}
                        <p class="text-xs text-warning-600-400 mt-1">{connection.reauthReason}</p>
                      {/if}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      {#if connection.status === 'reauth_required'}
                        <a
                          href={connectUrl(connection.provider)}
                          class="btn preset-filled-primary-500 btn-sm"
                        >
                          <RefreshCwIcon class="size-4" />
                          <span>Reconnect</span>
                        </a>
                      {/if}
                      <button
                        type="button"
                        class="btn preset-tonal-error btn-sm"
                        onclick={() => disconnect(connection.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  <div class="mt-4 grid gap-3 text-xs text-surface-600-400 sm:grid-cols-2">
                    <div>
                      <p class="font-medium text-surface-700-300">Provider watch</p>
                      <p>{watchStatusLabel(connection.watchStatus)}</p>
                      <p>Expires: {formatDateTime(watchExpiresAt(connection))}</p>
                    </div>
                    <div>
                      <p class="font-medium text-surface-700-300">Last sync</p>
                      <p>{formatDateTime(connection.lastSyncAt)}</p>
                      {#if connection.lastSyncError}
                        <p class="mt-1 break-words text-error-500">{connection.lastSyncError}</p>
                      {/if}
                      {#if connection.reauthRequiredAt}
                        <p class="mt-1">
                          Reauth requested: {formatDateTime(connection.reauthRequiredAt)}
                        </p>
                      {/if}
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

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

        <section class="card preset-outlined-surface-200-800 space-y-5 p-6">
          <div class="flex items-start gap-4">
            <div
              class="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-200-800/70 text-surface-700-300"
            >
              <ShieldCheckIcon class="size-6" />
            </div>
            <div class="space-y-1">
              <h2 class="text-xl font-semibold">Data &amp; Privacy</h2>
              <p class="text-sm text-surface-600-400">
                Control whether eligible Envoy content may help improve Envoy models.
              </p>
            </div>
          </div>

          <form class="space-y-4" onsubmit={saveDataPrivacy}>
            <div class="rounded-xl border border-surface-200-800 bg-surface-100-900/40 p-4">
              <label class="flex cursor-pointer items-start gap-3" for="modelTrainingOptIn">
                <input
                  id="modelTrainingOptIn"
                  name="modelTrainingOptIn"
                  type="checkbox"
                  class="checkbox mt-1 shrink-0"
                  bind:checked={modelTrainingOptIn}
                  disabled={dataPrivacyProcessing}
                  aria-describedby="model-training-account-details"
                />
                <span class="font-medium leading-6">
                  Allow Envoy to use my eligible Envoy content to improve Envoy models.
                </span>
              </label>
              <p
                id="model-training-account-details"
                class="mt-3 text-sm leading-6 text-surface-600-400"
              >
                When enabled, eligible content from both before and after you opt in may be used.
                Connected email data, credentials, payment data, and direct identifiers are
                excluded. Turning this off stops your data from being added to new training runs
                but may not reverse training that has already completed.
              </p>
            </div>

            <div class="grid gap-3 text-sm sm:grid-cols-2">
              <div class="rounded-lg border border-surface-200-800 p-3">
                <p class="font-medium text-surface-950-50">Eligible when enabled</p>
                <p class="mt-1 text-surface-600-400">
                  Envoy-native project inputs, prompts, generated outputs, corrections, ratings,
                  feedback, and de-identified product signals.
                </p>
              </div>
              <div class="rounded-lg border border-surface-200-800 p-3">
                <p class="font-medium text-surface-950-50">Always excluded</p>
                <p class="mt-1 text-surface-600-400">
                  Connected mailbox data, credentials, payment data, direct identifiers, and
                  private third-party communications.
                </p>
              </div>
            </div>

            {#if modelTrainingPreferenceUpdatedAt}
              <p class="text-xs text-surface-600-400">
                Last changed {formatDateTime(modelTrainingPreferenceUpdatedAt)}
              </p>
            {/if}

            <p class="text-sm text-surface-600-400">
              Learn more in Envoy's
              <a
                href="/terms"
                class="rounded text-primary-500 underline underline-offset-2 hover:text-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >Terms of Service</a>
              and
              <a
                href="/privacy"
                class="rounded text-primary-500 underline underline-offset-2 hover:text-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >Privacy Policy</a>.
            </p>

            {#if dataPrivacyError}
              <p class="rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-sm" role="alert">
                {dataPrivacyError}
              </p>
            {/if}

            <p class="sr-only" role="status" aria-live="polite">{dataPrivacySuccess}</p>
            {#if dataPrivacySuccess}
              <p
                class="rounded-lg border border-success-500/20 bg-success-500/10 p-3 text-sm"
                aria-hidden="true"
              >
                {dataPrivacySuccess}
              </p>
            {/if}

            <button
              type="submit"
              class="btn preset-filled-primary-500 w-fit"
              disabled={dataPrivacyProcessing || !dataPrivacyChanged}
            >
              {dataPrivacyProcessing ? 'Saving...' : 'Save preference'}
            </button>
          </form>
        </section>

      </div>
    </section>
  </div>
</Sidebar>
