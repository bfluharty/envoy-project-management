<script lang="ts">
  import { router } from '@inertiajs/svelte'
  import { untrack } from 'svelte'
  import AuthPageShell from '#components/auth_page_shell.svelte'

  interface SocialAuthProvider {
    provider: 'google' | 'microsoft'
    label: string
    href: string
  }

  const {
    flashMessage = null,
    socialAuthProviders = [],
    passwordAuthEnabled = false,
    accountType = 'consumer',
    errors: propErrors = {},
  }: {
    flashMessage: { type?: string; message?: string } | null
    socialAuthProviders?: SocialAuthProvider[]
    passwordAuthEnabled?: boolean
    accountType?: 'consumer' | 'vendor'
    errors?: Record<string, string>
  } = $props()

  let fullName = $state('')
  let email = $state('')
  let password = $state('')
  let passwordConfirmation = $state('')
  let selectedAccountType = $state<'consumer' | 'vendor'>(untrack(() => accountType))
  let mailboxAuthorizationAccepted = $state(false)
  let processing = $state(false)
  let socialProcessing = $state<string | null>(null)
  let errors = $state<Record<string, string>>({})
  let showError = $state(false)
  let errorMessage = $state('')
  let flashType = $state<'error' | 'success' | null>(null)
  let flashText = $state('')

  const alternateRegistration = $derived(
    accountType === 'vendor'
      ? { label: 'Register as a Consumer', href: '/register?accountType=consumer' }
      : { label: 'Register as a Pro', href: '/register?accountType=vendor' }
  )

  const TOKEN_KEY = 'envoy_onboarding_token'
  const SEEN_KEY = 'envoy_seen'

  function getOnboardingToken(): string | undefined {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return undefined

    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (uuidV4Pattern.test(token)) return token

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SEEN_KEY)
    return undefined
  }

  function socialHref(provider: SocialAuthProvider): string {
    const url = new URL(provider.href, 'http://envoy.local')
    url.searchParams.set('accountType', selectedAccountType)
    if (mailboxAuthorizationAccepted) {
      url.searchParams.set('emailTermsAccepted', '1')
    } else {
      url.searchParams.delete('emailTermsAccepted')
    }
    return `${url.pathname}${url.search}`
  }

  function handleSubmit(event: Event) {
    event.preventDefault()
    processing = true
    errors = {}
    showError = false

    const onboardingToken =
      selectedAccountType === 'consumer' ? getOnboardingToken() : undefined

    router.post(
      '/register',
      {
        fullName,
        email,
        password,
        passwordConfirmation,
        accountType: selectedAccountType,
        ...(onboardingToken ? { onboardingToken } : {}),
      },
      {
        onFinish: () => {
          processing = false
        },
        onError: (responseErrors) => {
          errors = responseErrors || {}
          showError = true
          errorMessage = 'Please fix the errors below.'
        },
      }
    )
  }

  async function handleSocialAuth(event: MouseEvent, provider: SocialAuthProvider) {
    event.preventDefault()
    if (socialProcessing) return
    if (!mailboxAuthorizationAccepted) {
      errorMessage = 'Please authorize mailbox access before continuing with Google or Microsoft.'
      showError = true
      return
    }
    showError = false
    socialProcessing = provider.provider

    try {
      const onboardingToken =
        selectedAccountType === 'consumer' ? getOnboardingToken() : undefined

      if (onboardingToken) {
        const response = await fetch('/onboarding/registration-handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboardingToken }),
        })

        if (!response.ok) {
          if (response.status === 404 || response.status === 410 || response.status === 422) {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(SEEN_KEY)
            errorMessage = 'Your vendor search is no longer available. Start a new search to continue with those vendors.'
          } else {
            errorMessage = 'We could not preserve your vendor selections. Please try again.'
          }
          showError = true
          return
        }
      }

      window.location.assign(socialHref(provider))
    } catch {
      errorMessage = 'We could not preserve your vendor selections. Check your connection and try again.'
      showError = true
    } finally {
      socialProcessing = null
    }
  }

  $effect(() => {
    flashType =
      flashMessage?.type === 'error' || flashMessage?.type === 'success' ? flashMessage.type : null
    flashText = flashMessage?.message ?? ''
    if (propErrors && Object.keys(propErrors).length > 0) {
      errors = propErrors
    }
  })
</script>

<AuthPageShell pageTitle="Register" showGuestCta={false} guestAction={alternateRegistration}>
  <div class="text-center">
    <h2 class="text-3xl font-bold">
      Create your {accountType === 'vendor' ? 'Pro' : ''} account
    </h2>
    <p class="mt-2 text-surface-600-400">
      Already have an account?
      <a href="/login" class="text-primary-500 hover:text-primary-400">Sign in</a>
    </p>
  </div>

  {#if showError}
    <aside class="card preset-tonal-error mt-4 p-4" role="alert">
      <p>{errorMessage}</p>
    </aside>
  {/if}

  {#if passwordAuthEnabled}
    <form class="mt-6 space-y-6" onsubmit={handleSubmit}>
      {#if flashType === 'success'}
        <aside
          class="card border border-success-500/20 bg-success-500/10 p-4 text-surface-950 dark:border-surface-200-800 dark:bg-surface-100-900/40 dark:text-surface-50"
        >
          <p>{flashText}</p>
        </aside>
      {/if}

      {#if flashType === 'error' && !showError}
        <aside class="card preset-tonal-error p-4">
          <p>{flashText}</p>
        </aside>
      {/if}

      <div class="space-y-4">
        <label class="label">
          <span>Full Name</span>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autocomplete="name"
            required
            bind:value={fullName}
            class="input"
            class:input-error={errors.fullName}
            aria-invalid={errors.fullName ? 'true' : undefined}
            aria-describedby={errors.fullName ? 'err-full-name' : undefined}
            placeholder="Enter your full name"
          />
          {#if errors.fullName}
            <p id="err-full-name" class="text-error-500 text-sm">{errors.fullName}</p>
          {/if}
        </label>

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
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'err-email' : undefined}
            placeholder="Enter your email"
          />
          {#if errors.email}
            <p id="err-email" class="text-error-500 text-sm">{errors.email}</p>
          {/if}
        </label>

        <label class="label">
          <span>Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            bind:value={password}
            class="input"
            class:input-error={errors.password}
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={errors.password ? 'err-password' : undefined}
            placeholder="Create a password (min 8 characters)"
          />
          {#if errors.password}
            <p id="err-password" class="text-error-500 text-sm">{errors.password}</p>
          {/if}
        </label>

        <label class="label">
          <span>Confirm Password</span>
          <input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autocomplete="new-password"
            required
            bind:value={passwordConfirmation}
            class="input"
            class:input-error={errors.passwordConfirmation}
            aria-invalid={errors.passwordConfirmation ? 'true' : undefined}
            aria-describedby={errors.passwordConfirmation ? 'err-password-confirmation' : undefined}
            placeholder="Confirm your password"
          />
          {#if errors.passwordConfirmation}
            <p id="err-password-confirmation" class="text-error-500 text-sm">
              {errors.passwordConfirmation}
            </p>
          {/if}
        </label>
      </div>

      <button type="submit" disabled={processing} class="btn preset-filled-primary-500 w-full">
        {processing ? 'Creating account...' : 'Create account'}
      </button>
    </form>

    <div class="flex w-full items-center gap-4 my-4">
      <div class="h-px flex-1 bg-base-content/20"></div>
      <span class="text-base-content/40 text-sm">OR</span>
      <div class="h-px flex-1 bg-base-content/20"></div>
    </div>
  {:else}
    {#if flashType === 'success'}
      <aside
        class="card mt-8 border border-success-500/20 bg-success-500/10 p-4 text-surface-950 dark:border-surface-200-800 dark:bg-surface-100-900/40 dark:text-surface-50"
      >
        <p>{flashText}</p>
      </aside>
    {/if}

    {#if flashType === 'error'}
      <aside class="card preset-tonal-error mt-8 p-4">
        <p>{flashText}</p>
      </aside>
    {/if}
  {/if}

  {#if socialAuthProviders.length > 0}
    <div class="space-y-4">
      <div class="rounded-xl border border-surface-200-800 bg-surface-100-900/30 p-4">
        <label class="flex cursor-pointer items-start gap-3" for="mailboxAuthorizationAccepted">
          <input
            id="mailboxAuthorizationAccepted"
            name="mailboxAuthorizationAccepted"
            type="checkbox"
            class="checkbox mt-1 shrink-0"
            bind:checked={mailboxAuthorizationAccepted}
            disabled={socialProcessing !== null}
          />
          <span class="text-sm leading-6 text-surface-700-300">
            I authorize Envoy to view my email, prepare local drafts, and send approved messages
            from my connected account.
          </span>
        </label>
        <p class="mt-2 pl-9 text-xs leading-5 text-surface-600-400">
          Envoy will only view emails sent and received by contacts that you select. You can disconnect your inbox at any time in Account Settings.
        </p>
      </div>

      {#each socialAuthProviders as provider (provider.provider)}
        <a
          href={socialHref(provider)}
          class="btn btn-outline w-full gap-2 {socialProcessing || !mailboxAuthorizationAccepted ? 'pointer-events-none opacity-50' : ''}"
          data-account-type={selectedAccountType}
          aria-disabled={socialProcessing || !mailboxAuthorizationAccepted ? 'true' : undefined}
          tabindex={socialProcessing || !mailboxAuthorizationAccepted ? -1 : undefined}
          onclick={(event) => handleSocialAuth(event, provider)}
        >
          {#if provider.provider === 'google'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.10z"
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
          {socialProcessing === provider.provider
            ? `Connecting to ${provider.label}...`
            : `Continue with ${provider.label}`}
        </a>
      {/each}
    </div>
  {:else}
    <p class="text-center text-sm text-surface-600-400">
      Social sign-in is not configured for this environment yet.
    </p>
  {/if}
</AuthPageShell>
