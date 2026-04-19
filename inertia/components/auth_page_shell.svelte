<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';

  const {
    pageTitle,
    showGuestCta = false,
    children,
  }: {
    pageTitle: string;
    showGuestCta?: boolean;
    children: () => unknown;
  } = $props();
</script>

<svelte:head>
  <title>Envoy - {pageTitle}</title>
</svelte:head>

<div class="min-h-svh flex flex-col">
  <Navbar {showGuestCta} />
  <main class="flex-1 flex items-center justify-center p-6 sm:px-8">
    <div class="max-w-md w-full space-y-8 rounded-xl border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-6 sm:p-8">
      {@render children()}
    </div>
  </main>
  <PublicFooter />
</div>
