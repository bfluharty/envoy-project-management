<script lang="ts">
  import { router } from '@inertiajs/svelte'

  export let token: string = ''
  export let flashMessage: { type?: string; message?: string } | null = null

  let password = ''
  let passwordConfirmation = ''
  let processing = false
  let errors: Record<string, string[]> = {}
  let showError = false
  let errorMessage = ''

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

  $: if (flashMessage?.type === 'error') {
    showError = true
    errorMessage = flashMessage.message ?? 'Something went wrong.'
  }
</script>

<svelte:head>
  <title>Envoy - Reset Password</title>
</svelte:head>

<div class="min-h-screen bg-base-100 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-base-content">Set new password</h2>
      <p class="mt-2 text-base-content/60">
        <a href="/login" class="text-primary hover:text-primary-focus">Back to sign in</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      {#if showError}
        <div class="alert alert-error">
          <span>{errorMessage}</span>
        </div>
      {/if}
      {#if flashMessage?.type === 'success'}
        <div class="alert alert-success">
          <span>{flashMessage.message}</span>
        </div>
      {/if}

      <input type="hidden" name="token" value={token} />

      <div>
        <label for="password" class="block text-sm font-medium text-base-content">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="new-password"
          required
          bind:value={password}
          class="input input-bordered w-full mt-1"
          class:input-error={errors.password}
          placeholder="At least 8 characters"
        />
        {#if errors.password}
          <div class="text-error text-sm mt-1">{errors.password}</div>
        {/if}
      </div>

      <div>
        <label for="passwordConfirmation" class="block text-sm font-medium text-base-content">Confirm new password</label>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autocomplete="new-password"
          required
          bind:value={passwordConfirmation}
          class="input input-bordered w-full mt-1"
          class:input-error={errors.passwordConfirmation}
          placeholder="Confirm your password"
        />
        {#if errors.passwordConfirmation}
          <div class="text-error text-sm mt-1">{errors.passwordConfirmation}</div>
        {/if}
      </div>

      <div>
        <button type="submit" disabled={processing} class="btn btn-primary w-full" class:loading={processing}>
          {processing ? 'Resetting...' : 'Reset password'}
        </button>
      </div>
    </form>
  </div>
</div>
