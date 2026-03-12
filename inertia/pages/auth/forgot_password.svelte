<script lang="ts">
  import { router } from '@inertiajs/svelte'

  export let flashMessage: { type?: string; message?: string } | null = null

  let email = ''
  let processing = false
  let errors: Record<string, string[]> = {}
  let showError = false
  let errorMessage = ''

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

  $: if (flashMessage?.type === 'error') {
    showError = true
    errorMessage = flashMessage.message ?? 'Something went wrong.'
  }
</script>

<svelte:head>
  <title>Envoy - Forgot Password</title>
</svelte:head>

<div class="min-h-screen bg-surface-50-950 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold">Forgot your password?</h2>
      <p class="mt-2 text-surface-600-400">
        Enter your email and we'll send you a link to reset it.
        <a href="/login" class="text-primary-500 hover:text-primary-400 block mt-2">Back to sign in</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
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
  </div>
</div>
