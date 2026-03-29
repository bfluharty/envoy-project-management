<script lang="ts">
  import PublicPageShell from '#components/public_page_shell.svelte';
</script>

<PublicPageShell
  pageTitle="Contact"
  heading="Contact"
  lead="Reach out for support, partnership requests, or product questions."
>
  <article class="space-y-3">
    <p class="text-surface-600-400">
      General: <a href="mailto:hello@envoy.local" class="text-primary-500 hover:text-primary-400">hello@envoy.local</a>
    </p>
    <p class="text-surface-600-400">
      Support: <a href="mailto:support@envoy.local" class="text-primary-500 hover:text-primary-400">support@envoy.local</a>
    </p>
  </article>

  <a href="/" class="btn preset-tonal inline-flex">Back to Home</a>
</PublicPageShell>
