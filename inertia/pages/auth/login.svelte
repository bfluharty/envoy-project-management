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

    <div class="flex w-full items-center gap-4 my-4">
      <div class="h-px flex-1 bg-base-content/20"></div>
      <span class="text-base-content/40 text-sm">OR</span>
      <div class="h-px flex-1 bg-base-content/20"></div>
    </div>

    <a href="/auth/google" class="btn btn-outline w-full gap-2">
      <svg class="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </a>
  </div>
</div>