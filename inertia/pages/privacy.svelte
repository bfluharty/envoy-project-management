<script lang="ts">
  import PublicPageShell from '#components/public_page_shell.svelte';
</script>

<PublicPageShell
  pageTitle="Privacy"
  heading="Privacy"
  lead="This page describes how Envoy handles personal information for users and visitors."
>
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
</PublicPageShell>
