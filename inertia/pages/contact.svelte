<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
</script>

<svelte:head>
  <title>Envoy - Contact</title>
</svelte:head>

<div class="min-h-dvh flex flex-col overflow-x-clip">
  <Navbar showGuestCta={true} />
  <main class="flex-1 min-h-0 px-6 sm:px-8 py-8 sm:py-10">
    <section class="mx-auto max-w-3xl space-y-6">
      <h1 class="text-3xl sm:text-4xl font-bold">Contact</h1>
      <p class="text-surface-600-400">
        Reach out for support, partnership requests, or product questions.
      </p>

      <article class="space-y-3">
        <p class="text-surface-600-400">
          General: <a href="mailto:hello@envoy.local" class="text-primary-500 hover:text-primary-400">hello@envoy.local</a>
        </p>
        <p class="text-surface-600-400">
          Support: <a href="mailto:support@envoy.local" class="text-primary-500 hover:text-primary-400">support@envoy.local</a>
        </p>
      </article>

      <a href="/" class="btn preset-tonal inline-flex">Back to Home</a>
    </section>
  </main>
  <PublicFooter />
</div>
