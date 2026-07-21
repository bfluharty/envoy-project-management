<script lang="ts">
  import { router } from '@inertiajs/svelte'
  import AuthPageShell from '#components/auth_page_shell.svelte'
  import DismissibleBanner from '#components/dismissible_banner.svelte'

  interface SocialAuthProvider {
    provider: 'google' | 'microsoft'
    label: string
    href: string
  }

  const {
    flashMessage = null,
    socialAuthProviders = [],
    passwordAuthEnabled = false,
  }: {
    flashMessage: { type?: string; message?: string } | null
    socialAuthProviders?: SocialAuthProvider[]
    passwordAuthEnabled?: boolean
  } = $props()

  let email = $state('')
  let password = $state('')
  let processing = $state(false)
  let errors = $state<any>({})
  let showError = $state(false)
  let errorMessage = $state('')
  let successMessage = $state('')

  function handleSubmit(event: Event) {
    event.preventDefault()
    processing = true
    errors = {}
    showError = false
    successMessage = ''

    router.post(
      '/login',
      { email, password },
      {
        onFinish: () => {
          processing = false
        },
        onError: (responseErrors) => {
          errors = responseErrors || {}
          showError = true
          errorMessage = 'Invalid email or password. Please try again.'
        },
      }
    )
  }

  $effect(() => {
    showError = flashMessage?.type === 'error'
    errorMessage = flashMessage?.type === 'error' ? flashMessage.message ?? '' : ''
    successMessage = flashMessage?.type === 'success' ? flashMessage.message ?? '' : ''
  })
</script>

<AuthPageShell pageTitle="Login" showGuestCta={false}>
  <div class="text-center">
    <h2 class="text-3xl font-bold">Sign in to your account</h2>
    {#if passwordAuthEnabled}
      <p class="mt-2 text-surface-600-400">
        Or
        <a
          href="/register"
          class="text-primary-500 hover:text-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded"
        >
          create a new account
        </a>
      </p>
      <p class="mt-1">
        <a
          href="/forgot-password"
          class="text-primary-500/80 hover:text-primary-500 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded"
        >
          Forgot password?
        </a>
      </p>
    {/if}
  </div>

  {#if passwordAuthEnabled}
    <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
      {#if successMessage}
        <DismissibleBanner variant="success">
          <p>{successMessage}</p>
        </DismissibleBanner>
      {/if}

      {#if showError}
        <DismissibleBanner variant="error" onDismiss={() => (showError = false)}>
          <p>{errorMessage}</p>
        </DismissibleBanner>
      {/if}

      <div class="space-y-4">
        <label class="label">
          <span>Email address</span>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            bind:value={email}
            class="input"
            class:input-error={errors.email}
            placeholder="Enter your email"
          />
          {#if errors.email}
            <p class="text-error-500 text-sm">{errors.email}</p>
          {/if}
        </label>

        <label class="label">
          <span>Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            bind:value={password}
            class="input"
            class:input-error={errors.password}
            placeholder="Enter your password"
          />
          {#if errors.password}
            <p class="text-error-500 text-sm">{errors.password}</p>
          {/if}
        </label>
      </div>

      <button type="submit" disabled={processing} class="btn preset-filled-primary-500 w-full">
        {processing ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  {:else}
    {#if successMessage}
      <DismissibleBanner variant="success" class="mt-8">
        <p>{successMessage}</p>
      </DismissibleBanner>
    {/if}

    {#if showError}
      <DismissibleBanner variant="error" class="mt-8" onDismiss={() => (showError = false)}>
        <p>{errorMessage}</p>
      </DismissibleBanner>
    {/if}
  {/if}

  {#if passwordAuthEnabled}
    <div class="flex w-full items-center gap-4 my-4">
      <div class="h-px flex-1 bg-base-content/20"></div>
      <span class="text-base-content/40 text-sm">OR</span>
      <div class="h-px flex-1 bg-base-content/20"></div>
    </div>
  {/if}

  {#if socialAuthProviders.length > 0}
    <div class="space-y-3">
      {#each socialAuthProviders as provider (provider.provider)}
        <a href={provider.href} class="btn btn-outline w-full gap-2">
          {#if provider.provider === 'google'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          {:else}
            <span class="grid size-5 grid-cols-2 grid-rows-2 gap-0.5" aria-hidden="true">
              <span class="bg-[#f25022]"></span>
              <span class="bg-[#7fba00]"></span>
              <span class="bg-[#00a4ef]"></span>
              <span class="bg-[#ffb900]"></span>
            </span>
          {/if}
          Continue with {provider.label}
        </a>
      {/each}
    </div>
  {:else}
    <p class="text-center text-sm text-surface-600-400">
      Social sign-in is not configured for this environment yet.
    </p>
  {/if}
</AuthPageShell>
