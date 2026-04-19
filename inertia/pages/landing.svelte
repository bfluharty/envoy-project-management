<script lang="ts">
  import Logo from "#components/logo.svelte";
  import PublicFooter from "#components/public_footer.svelte";

  import { page } from '@inertiajs/svelte';
</script>

<svelte:head>
  <title>Envoy - Welcome</title>
</svelte:head>


<div class="min-h-dvh flex flex-col overflow-x-clip">
  <div class="flex-1 flex items-start sm:items-center justify-center px-6 sm:px-8 pt-12 sm:pt-6 pb-10 sm:pb-12">
    <div class="max-w-4xl w-full text-center space-y-8">
      <div class="space-y-4">
        <div class="flex justify-center">
          <div class="w-24 h-24 flex items-center justify-center">
            <Logo class="w-24 h-24 text-primary-200 motion-safe:animate-pulse duration-1000" />
          </div>
        </div>
        <h1 class="text-4xl sm:text-5xl font-bold">Welcome to Envoy</h1>
        <p class="text-lg sm:text-xl text-surface-600-400 max-w-2xl mx-auto">
          Your intelligent project management companion. Organize, collaborate, and bring your ideas to life with AI-powered assistance.
        </p>
      </div>

      {#if $page.props.user}
      <div class="flex flex-col items-center gap-3 w-full max-w-md mx-auto px-6 sm:px-0">
        <p class="text-surface-600-400 text-sm">Welcome back, <span class="font-semibold text-surface-900-100">{$page.props.user.fullName || $page.props.user.email}</span></p>
        <a href="/dashboard" class="btn preset-filled-primary-500">
          Go to Dashboard
        </a>
      </div>
      {:else}
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a href="/login" class="btn preset-filled-primary-500">
          Sign In
        </a>
        <a href="/register" class="btn preset-outlined-primary-500">
          Create Account
        </a>
      </div>
      {/if}
    </div>
  </div>

  <PublicFooter />
</div>
