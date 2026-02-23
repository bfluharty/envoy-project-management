<script lang="ts">
  import { router } from '@inertiajs/svelte'
  import { page } from '@inertiajs/svelte'

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

<div class="min-h-screen bg-base-100 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-base-content">Sign in to your account</h2>
      <p class="mt-2 text-base-content/60">
        Or <a href="/register" class="text-primary hover:text-primary-focus">create a new account</a>
      </p>
      <p class="mt-1">
        <a href="/forgot-password" class="text-primary/80 hover:text-primary text-sm">Forgot password?</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      <!-- Error message display -->
      {#if showError}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      {/if}

      <div class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-base-content">
            Email address
          </label>
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
          <label for="password" class="block text-sm font-medium text-base-content">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            bind:value={password}
            class="input input-bordered w-full mt-1"
            class:input-error={errors.password}
            placeholder="Enter your password"
          />
          {#if errors.password}
            <div class="text-error text-sm mt-1">{errors.password}</div>
          {/if}
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={processing}
          class="btn btn-primary w-full"
          class:loading={processing}
        >
          {processing ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </form>
  </div>
</div>