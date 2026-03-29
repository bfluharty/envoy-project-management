<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
  const { error } = $props<{ error: { message?: string } }>();
</script>

<svelte:head>
  <title>Envoy - Server Error</title>
</svelte:head>

<div class="min-h-dvh flex flex-col">
  <Navbar showGuestCta={true} />
  <main class="flex-1 flex items-center justify-center px-6 sm:px-8">
    <div class="w-full max-w-md text-center space-y-4 card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-6">
      <h1 class="text-2xl font-semibold">Server Error</h1>
      <p class="text-surface-600-400">{error?.message ?? 'An unexpected error occurred.'}</p>
      <div class="flex items-center justify-center gap-2">
        <a href="/" class="btn btn-sm preset-filled-primary-500">Go Home</a>
        <button type="button" class="btn btn-sm preset-tonal" onclick={() => window.history.back()}>Go Back</button>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
