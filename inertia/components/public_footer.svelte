<script lang="ts">
  import Logo from '#components/logo.svelte';

  const currentYear = new Date().getFullYear();
</script>

<footer class="bg-surface-50-950/85 backdrop-blur-md border-t border-surface-200-800 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
  <div class="mx-auto max-w-5xl w-full min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 md:items-start">
    <div class="min-w-0 flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-surface-500 inline-flex items-center gap-1">
          <a href="/" class="inline-flex items-center gap-1.5 leading-none hover:text-surface-900-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded">
            <Logo class="size-4" />
            <span>Envoy</span>
          </a>
          <span aria-hidden="true">-</span>
          <span>{currentYear}</span>
        </p>
      </div>
    </div>

    <div class="self-start justify-self-end md:self-start min-w-0">
      <nav class="flex flex-col items-end justify-start gap-1 md:flex-row md:items-center md:gap-4 text-sm text-surface-500" aria-label="Footer links">
        <a href="/privacy" class="hover:text-surface-900-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded">Privacy</a>
        <a href="/terms" class="hover:text-surface-900-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded">Terms</a>
        <a href="/contact" class="hover:text-surface-900-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded">Contact</a>
      </nav>
    </div>
  </div>
</footer>
