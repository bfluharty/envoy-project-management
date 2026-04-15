<script lang="ts">
  import PublicPageShell from '#components/public_page_shell.svelte';
</script>

<PublicPageShell
  pageTitle="Terms"
  heading="Terms of Use"
  lead="These terms define how Envoy may be accessed and used."
>
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
</PublicPageShell>
