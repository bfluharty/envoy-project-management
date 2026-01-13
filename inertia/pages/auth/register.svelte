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
  <title>Register - Envoy Project API</title>
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
  </div>
</div>