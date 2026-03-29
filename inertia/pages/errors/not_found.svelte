<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
</script>

<div class="min-h-dvh bg-surface-50-950 flex flex-col">
  <Navbar showGuestCta={true} />
  <main class="flex-1 flex items-center justify-center px-6 sm:px-8">
    <div class="container text-center space-y-2">
      <div class="title">Page not found</div>
      <span>This page does not exist.</span>
    </div>
  </main>
  <PublicFooter />
</div>
