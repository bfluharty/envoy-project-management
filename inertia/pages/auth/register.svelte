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
      onError: () => {
        processing = false
      }
    })
  }
</script>

<svelte:head>
  <title>Envoy - Register</title>
</svelte:head>

<div class="min-h-screen bg-surface-50-950 flex items-center justify-center px-4">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold">Create your account</h2>
      <p class="mt-2 text-surface-600-400">
        Already have an account? <a href="/login" class="text-primary-500 hover:text-primary-400">Sign in</a>
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      <div class="space-y-4">
        <label class="label">
          <span>Full Name</span>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autocomplete="name"
            required
            bind:value={fullName}
            class="input"
            placeholder="Enter your full name"
          />
        </label>

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
            placeholder="Enter your email"
          />
        </label>

        <label class="label">
          <span>Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            bind:value={password}
            class="input"
            placeholder="Create a password (min 8 characters)"
          />
        </label>

        <label class="label">
          <span>Confirm Password</span>
          <input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autocomplete="new-password"
            required
            bind:value={passwordConfirmation}
            class="input"
            placeholder="Confirm your password"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={processing}
        class="btn preset-filled-primary-500 w-full"
      >
        {processing ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  </div>
</div>
