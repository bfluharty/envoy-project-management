<script lang="ts">
  import { router } from '@inertiajs/svelte'

  const { token = '', flashMessage = null }: { token: string; flashMessage: { type?: string; message?: string } | null } = $props()

  let password = $state('')
  let passwordConfirmation = $state('')
  let processing = $state(false)
  let errors = $state<Record<string, string[]>>({})
  let showError = $state(false)
  let errorMessage = $state('')

  function handleSubmit(event: Event) {
    event.preventDefault()
    processing = true
    errors = {}
    showError = false
    router.post('/reset-password', { token, password, passwordConfirmation }, {
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

<svelte:head>
  <title>Envoy - Reset Password</title>
</svelte:head>

<div class="min-h-screen bg-surface-50-950 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold">Set new password</h2>
      <p class="mt-2 text-surface-600-400">
        <a href="/login" class="text-primary-500 hover:text-primary-400">Back to sign in</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
      {#if showError}
        <aside class="card preset-tonal-error p-4">
          <p>{errorMessage}</p>
        </aside>
      {/if}
      {#if flashMessage?.type === 'success'}
        <aside class="card preset-tonal-success p-4">
          <p>{flashMessage.message}</p>
        </aside>
      {/if}

      <input type="hidden" name="token" value={token} />

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
          class:input-error={errors.password}
          placeholder="At least 8 characters"
        />
        {#if errors.password}
          <p class="text-error-500 text-sm">{errors.password}</p>
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
          class:input-error={errors.passwordConfirmation}
          placeholder="Confirm your password"
        />
        {#if errors.passwordConfirmation}
          <p class="text-error-500 text-sm">{errors.passwordConfirmation}</p>
        {/if}
      </label>

      <button type="submit" disabled={processing} class="btn preset-filled-primary-500 w-full">
        {processing ? 'Resetting...' : 'Reset password'}
      </button>
    </form>
  </div>
</div>
