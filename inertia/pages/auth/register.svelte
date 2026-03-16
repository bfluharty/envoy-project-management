<script lang="ts">
  import { router } from '@inertiajs/svelte'

  let fullName = ''
  let email = ''
  let password = ''
  let passwordConfirmation = ''
  let processing = false
  
  function handleSubmit(event: Event) {
    event.preventDefault()
    processing = true
    
    router.post('/register', {
      fullName,
      email,
      password,
      passwordConfirmation
    }, {
      onFinish: () => {
        processing = false
      },
      onError: (errors) => {
        processing = false
      }
    })
  }
</script>

<svelte:head>
  <title>Envoy - Register</title>
</svelte:head>

<div class="min-h-screen bg-base-100 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-base-content">Create your account</h2>
      <p class="mt-2 text-base-content/60">
        Already have an account? <a href="/login" class="text-primary hover:text-primary-focus">Sign in</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      <div class="space-y-4">
        <div>
          <label for="fullName" class="block text-sm font-medium text-base-content">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autocomplete="name"
            required
            bind:value={fullName}
            class="input input-bordered w-full mt-1"
            placeholder="Enter your full name"
          />
        </div>

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
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-base-content">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            bind:value={password}
            class="input input-bordered w-full mt-1"
            placeholder="Create a password (min 8 characters)"
          />
        </div>

        <div>
          <label for="passwordConfirmation" class="block text-sm font-medium text-base-content">
            Confirm Password
          </label>
          <input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autocomplete="new-password"
            required
            bind:value={passwordConfirmation}
            class="input input-bordered w-full mt-1"
            placeholder="Confirm your password"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={processing}
          class="btn btn-primary w-full"
          class:loading={processing}
        >
          {processing ? 'Creating account...' : 'Create account'}
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