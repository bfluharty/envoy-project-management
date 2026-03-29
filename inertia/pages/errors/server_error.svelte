<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
  const { error } = $props<{ error: { message?: string } }>();
</script>

<div class="min-h-dvh bg-surface-50-950 flex flex-col">
  <Navbar showGuestCta={true} />
  <main class="flex-1 flex items-center justify-center px-6 sm:px-8">
    <div class="container text-center space-y-2">
      <div class="title">Server Error</div>
      <span>{error?.message ?? 'An unexpected error occurred.'}</span>
    </div>
  </main>
  <PublicFooter />
</div>
