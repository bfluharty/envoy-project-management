<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
</script>

<svelte:head>
  <title>Envoy - Terms</title>
</svelte:head>

<div class="min-h-dvh bg-surface-50-950 flex flex-col overflow-x-clip">
  <Navbar showGuestCta={true} />
  <main class="flex-1 min-h-0 px-6 sm:px-8 py-8 sm:py-10">
    <section class="mx-auto max-w-3xl space-y-6">
      <h1 class="text-3xl sm:text-4xl font-bold">Terms of Use</h1>
      <p class="text-surface-600-400">
        These terms define how Envoy may be accessed and used.
      </p>

      <article class="space-y-4">
        <h2 class="text-xl font-semibold">Acceptable Use</h2>
        <p class="text-surface-600-400">
          Use the service lawfully and do not attempt to disrupt or misuse product functionality.
        </p>
      </article>

      <article class="space-y-4">
        <h2 class="text-xl font-semibold">Accounts</h2>
        <p class="text-surface-600-400">
          Users are responsible for maintaining account credentials and activities performed under their accounts.
        </p>
      </article>

      <article class="space-y-4">
        <h2 class="text-xl font-semibold">Changes</h2>
        <p class="text-surface-600-400">
          Terms may be updated over time. Continued use after updates indicates acceptance of revised terms.
        </p>
      </article>

      <a href="/" class="btn preset-tonal inline-flex">Back to Home</a>
    </section>
  </main>
  <PublicFooter />
</div>
