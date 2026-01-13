<script lang="ts">
  import Logo from "#components/logo.svelte";
  import Navbar from "#components/navbar.svelte";

  import { page } from '@inertiajs/svelte';
</script>

<svelte:head>
  <title>Welcome - Envoy Project API</title>
</svelte:head>


<div class="min-h-screen bg-base-100 flex flex-col">
  <Navbar />
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="max-w-4xl w-full text-center space-y-8">
      <div class="space-y-4">
        <div class="flex justify-center">
          <div class="w-24 h-24 bg-primary rounded-full flex items-center justify-center">
            <Logo class="w-24 h-24 text-primary-400 animate-pulse duration-1000" />
          </div>
        </div>
        <h1 class="text-5xl font-bold text-base-content">Welcome to Envoy</h1>
        <p class="text-xl text-base-content/70 max-w-2xl mx-auto">
          Your intelligent project management companion. Organize, collaborate, and bring your ideas to life with AI-powered assistance.
        </p>
      </div>

      {#if !$page.props.user}

      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a href="/login" class="btn btn-primary btn-lg">
          Sign In
        </a>
        <a href="/register" class="btn btn-outline btn-lg">
          Create Account
        </a>
      </div>
      {/if}
    </div>
  </div>
</div>