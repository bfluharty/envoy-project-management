<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
</script>

<svelte:head>
  <title>Envoy - Privacy</title>
</svelte:head>

<div class="min-h-dvh flex flex-col overflow-x-clip">
  <Navbar showGuestCta={true} />
  <main class="flex-1 min-h-0 px-6 sm:px-8 py-8 sm:py-10">
    <section class="mx-auto max-w-3xl space-y-6">
      <h1 class="text-3xl sm:text-4xl font-bold">Privacy</h1>
      <p class="text-surface-600-400">
        This page describes how Envoy handles personal information for users and visitors.
      </p>

      <article class="space-y-4">
        <h2 class="text-xl font-semibold">Data We Collect</h2>
        <p class="text-surface-600-400">
          Account details, project data, and usage information needed to operate and improve the product.
        </p>
      </article>

      <article class="space-y-4">
        <h2 class="text-xl font-semibold">How We Use Data</h2>
        <p class="text-surface-600-400">
          Data is used to provide core features, secure accounts, support collaboration workflows, and maintain service reliability.
        </p>
      </article>

      <article class="space-y-4">
        <h2 class="text-xl font-semibold">Contact</h2>
        <p class="text-surface-600-400">
          For privacy questions, email <a href="mailto:privacy@envoy.local" class="text-primary-500 hover:text-primary-400">privacy@envoy.local</a>.
        </p>
      </article>

      <a href="/" class="btn preset-tonal inline-flex">Back to Home</a>
    </section>
  </main>
  <PublicFooter />
</div>
