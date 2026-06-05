<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';

  const { error }: { error?: { message?: string } } = $props()
</script>

<svelte:head>
  <title>Envoy - Server Error</title>
</svelte:head>

<div class="min-h-svh flex flex-col">
  <Navbar showGuestCta={true} />
  <main class="flex-1 flex items-center justify-center p-6 sm:px-8">
    <div class="w-full max-w-md text-center space-y-4 card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-6">
      <div class="flex justify-center">
        <div class="p-3 rounded-full bg-error-500/10 border border-error-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-error-500">
            <path d="M6 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
            <path d="M6 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2"/>
            <path d="M6 6h.01"/>
            <path d="M6 18h.01"/>
            <path d="m13 6-4 6h6l-4 6"/>
          </svg>
        </div>
      </div>
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold">Something went wrong</h1>
        <p class="text-surface-600-400">An unexpected error occurred. Please return to Home.</p>
      </div>
      <a href="/" class="btn preset-filled-primary-500 w-full">Return to Home</a>
    </div>
  </main>
  <PublicFooter />
</div>
