<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';

  const {
    pageTitle,
    heading,
    lead = '',
    children,
  }: {
    pageTitle: string;
    heading: string;
    lead?: string;
    children: () => unknown;
  } = $props();
</script>

<svelte:head>
  <title>Envoy - {pageTitle}</title>
</svelte:head>

<div class="min-h-dvh flex flex-col overflow-x-clip">
  <Navbar showGuestCta={true} />
  <main class="flex-1 min-h-0 px-6 sm:px-8 py-8 sm:py-10">
    <section class="mx-auto max-w-3xl space-y-6">
      <h1 class="text-3xl sm:text-4xl font-bold">{heading}</h1>
      {#if lead}
        <p class="text-surface-600-400">{lead}</p>
      {/if}
      {@render children()}
    </section>
  </main>
  <PublicFooter />
</div>
