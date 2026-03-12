<script lang="ts">
  import { router } from '@inertiajs/svelte'

  export let flashMessage: any = null

  let email = ''
  let password = ''
  let processing = false
  let errors: any = {}
  let showError = false
  let errorMessage = ''

  function handleSubmit(event: Event) {
    event.preventDefault()
    processing = true
    errors = {}
    showError = false

    router.post('/login', {
      email,
      password
    }, {
      onFinish: () => {
        processing = false
      },
      onError: (responseErrors) => {
        processing = false
        errors = responseErrors || {}
        showError = true
        errorMessage = 'Invalid email or password. Please try again.'
      }
    })
  }

  // Handle flash messages
  $: if (flashMessage) {
    if (flashMessage.type === 'error') {
      showError = true
      errorMessage = flashMessage.message
    }
  }
</script>

<svelte:head>
  <title>Envoy - Login</title>
</svelte:head>

<div class="min-h-screen bg-surface-50-950 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold">Sign in to your account</h2>
      <p class="mt-2 text-surface-600-400">
        Or <a href="/register" class="text-primary-500 hover:text-primary-400">create a new account</a>
      </p>
      <p class="mt-1">
        <a href="/forgot-password" class="text-primary-500/80 hover:text-primary-500 text-sm">Forgot password?</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      {#if showError}
        <aside class="card preset-tonal-error p-4">
          <p>{errorMessage}</p>
        </aside>
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

      <button
        type="submit"
        disabled={processing}
        class="btn preset-filled-primary-500 w-full"
      >
        {processing ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  </div>
</div>
