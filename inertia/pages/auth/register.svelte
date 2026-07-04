<script lang="ts">
  import { router } from '@inertiajs/svelte'
  import AuthPageShell from '#components/auth_page_shell.svelte'
  import { onMount } from 'svelte'

  const TOKEN_KEY = 'envoy_onboarding_token';

  const {
    flashMessage = null,
    googleAuthAvailable = false,
    errors: propErrors = {},
  }: {
    flashMessage: { type?: string; message?: string } | null
    googleAuthAvailable?: boolean
    errors?: Record<string, string>
  } = $props()

  // ── Account type from query param ──────────────────────────────────────────
  function readAccountTypeParam(): 'consumer' | 'vendor' {
    if (typeof window === 'undefined') return 'consumer';
    const params = new URLSearchParams(window.location.search);
    const v = params.get('accountType');
    return v === 'vendor' ? 'vendor' : 'consumer';
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let accountType          = $state<'consumer' | 'vendor'>('consumer');
  let fullName             = $state('');
  let email                = $state('');
  let password             = $state('');
  let passwordConfirmation = $state('');
  let processing           = $state(false);
  let errors               = $state<Record<string, string>>({});
  let showError            = $state(false);
  let errorMessage         = $state('');
  let flashType            = $state<'error' | 'success' | null>(null);
  let flashText            = $state('');
  let onboardingToken      = $state<string | null>(null);

  onMount(() => {
    accountType     = readAccountTypeParam();
    onboardingToken = localStorage.getItem(TOKEN_KEY);
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(event: Event) {
    event.preventDefault();
    processing = true;
    errors     = {};
    showError  = false;

    const payload: Record<string, string> = {
      fullName,
      email,
      password,
      passwordConfirmation,
      accountType,
    };

    // Include onboarding token for consumer registrations when present
    if (accountType === 'consumer' && onboardingToken) {
      payload.onboardingToken = onboardingToken;
    }

    router.post('/register', payload, {
      onFinish: () => { processing = false; },
      onError: (responseErrors) => {
        errors       = responseErrors || {};
        showError    = true;
        errorMessage = 'Please fix the errors below.';
      },
    });
  }

  // ── Google OAuth: call registration-handoff before external redirect ───────
  async function handleGoogleSignUp() {
    if (onboardingToken) {
      try {
        await fetch('/onboarding/registration-handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: onboardingToken }),
        });
      } catch {
        // Non-fatal — proceed to OAuth even if handoff fails
      }
    }
    window.location.href = '/auth/google';
  }

  $effect(() => {
    flashType =
      flashMessage?.type === 'error' || flashMessage?.type === 'success'
        ? flashMessage.type
        : null;
    flashText = flashMessage?.message ?? '';
    if (propErrors && Object.keys(propErrors).length > 0) {
      errors = propErrors;
    }
  });
</script>

<AuthPageShell pageTitle="Register" showGuestCta={false}>
  <div class="text-center">
    <h2 class="text-3xl font-bold">Create your account</h2>
    <p class="mt-2 text-surface-600-400">
      Already have an account?
      <a href="/login" class="text-primary-500 hover:text-primary-400">Sign in</a>
    </p>
  </div>

  <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
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

    {#if showError}
      <aside class="card preset-tonal-error p-4">
        <p>{errorMessage}</p>
      </aside>
    {/if}

    <!-- Account type selection -->
    <fieldset class="space-y-2">
      <legend class="label font-medium mb-2">I am…</legend>
      <div class="grid grid-cols-2 gap-3">
        <label
          class="flex items-start gap-3 cursor-pointer rounded-xl border p-4 transition-all duration-150 {accountType === 'consumer'
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-surface-200-800 hover:bg-surface-100-900/40'}"
        >
          <input
            type="radio"
            name="accountType"
            value="consumer"
            bind:group={accountType}
            class="mt-0.5 accent-primary-500"
          />
          <div>
            <p class="font-medium text-sm leading-tight">Planning a project</p>
            <p class="text-xs text-surface-600-400 mt-0.5">Find and hire vendors</p>
          </div>
        </label>

        <label
          class="flex items-start gap-3 cursor-pointer rounded-xl border p-4 transition-all duration-150 {accountType === 'vendor'
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-surface-200-800 hover:bg-surface-100-900/40'}"
        >
          <input
            type="radio"
            name="accountType"
            value="vendor"
            bind:group={accountType}
            class="mt-0.5 accent-primary-500"
          />
          <div>
            <p class="font-medium text-sm leading-tight">A pro / vendor</p>
            <p class="text-xs text-surface-600-400 mt-0.5">Receive and respond to leads</p>
          </div>
        </label>
      </div>
      {#if errors.accountType}
        <p class="text-error-500 text-sm">{errors.accountType}</p>
      {/if}
    </fieldset>

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

  {#if googleAuthAvailable}
    <div class="space-y-3">
      <button
        type="button"
        onclick={handleGoogleSignUp}
        class="btn btn-outline w-full gap-2"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
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
        Continue with Google
      </button>
      <p class="text-sm text-surface-600-400">
        Google sign-up also asks for Gmail access so Envoy can sync your inbox from the same
        account.
      </p>
    </div>
  {:else}
    <p class="text-center text-sm text-surface-600-400">
      Google sign-in is not configured for this environment yet.
    </p>
  {/if}
</AuthPageShell>
