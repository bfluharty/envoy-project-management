<script lang="ts">
  import { router } from '@inertiajs/svelte'
  import AuthPageShell from '#components/auth_page_shell.svelte'
  import DismissibleBanner from '#components/dismissible_banner.svelte'

  const { flashMessage = null }: { flashMessage: { type?: string; message?: string } | null } = $props()

  let email = $state('')
  let processing = $state(false)
  let errors = $state<Record<string, string[]>>({})
  let showError = $state(false)
  let errorMessage = $state('')

  function handleSubmit(event: Event) {
    event.preventDefault()
    processing = true
    errors = {}
    showError = false
    router.post('/forgot-password', { email }, {
      onFinish: () => { processing = false },
      onError: (e) => {
        processing = false
        errors = e || {}
        showError = true
        errorMessage = 'Please fix the errors below.'
      },
    })
  }

  $effect(() => {
    if (flashMessage?.type === 'error') {
      showError = true
      errorMessage = flashMessage.message ?? 'Something went wrong.'
    }
  })
</script>

<AuthPageShell pageTitle="Forgot Password" showGuestCta={true}>
      <div class="text-center">
        <h2 class="text-3xl font-bold">Forgot your password?</h2>
        <p class="mt-2 text-surface-600-400">
          Enter your email and we'll send you a link to reset it. If you originally signed in
          with Google or Microsoft, you can use this to set up password login too.
          <a href="/login" class="text-primary-500 hover:text-primary-400 block mt-2">Back to sign in</a>
        </p>
      </div>

      <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
        {#if showError}
          <DismissibleBanner variant="error" onDismiss={() => (showError = false)}>
            <p>{errorMessage}</p>
          </DismissibleBanner>
        {/if}
        {#if flashMessage?.type === 'success'}
          <DismissibleBanner variant="success">
            <p>{flashMessage.message}</p>
          </DismissibleBanner>
        {/if}

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

        <button type="submit" disabled={processing} class="btn preset-filled-primary-500 w-full">
          {processing ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
</AuthPageShell>
