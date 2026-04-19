<svelte:head>
  <title>Envoy - Page Not Found</title>
</svelte:head>

<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
</script>

<div class="min-h-svh flex flex-col">
  <Navbar showGuestCta={true} />
  <main class="flex-1 flex items-center justify-center p-6 sm:px-8">
    <div class="w-full max-w-md text-center space-y-4 card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-6">
      <h1 class="text-2xl font-semibold">Page not found</h1>
      <p class="text-surface-600-400">This page does not exist.</p>
      <div class="flex items-center justify-center gap-2">
        <a href="/" class="btn btn-sm preset-filled-primary-500">Go Home</a>
        <a href="/dashboard" class="btn btn-sm preset-tonal">Go to Dashboard</a>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
