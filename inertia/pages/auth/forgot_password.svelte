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

<div class="min-h-screen bg-base-100 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-base-content">Forgot your password?</h2>
      <p class="mt-2 text-base-content/60">
        Enter your email and we'll send you a link to reset it.
        <a href="/login" class="text-primary hover:text-primary-focus block mt-2">Back to sign in</a>
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

      <div>
        <label for="email" class="block text-sm font-medium text-base-content">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          required
          bind:value={email}
          class="input input-bordered w-full mt-1"
          class:input-error={errors.email}
          placeholder="Enter your email"
        />
        {#if errors.email}
          <div class="text-error text-sm mt-1">{errors.email}</div>
        {/if}
      </div>

      <div>
        <button type="submit" disabled={processing} class="btn btn-primary w-full" class:loading={processing}>
          {processing ? 'Sending...' : 'Send reset link'}
        </button>
      </div>
    </form>
  </div>
</div>
