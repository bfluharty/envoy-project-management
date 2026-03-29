<script lang="ts">
  import Logo from '#components/logo.svelte';
  import ThemeToggle from '#components/theme_toggle.svelte';

  const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-surface-200-800 px-4 py-6">
  <div class="mx-auto max-w-5xl w-full min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 md:items-start">
    <div class="min-w-0 flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
      <a href="/" class="hidden md:inline-flex text-surface-500 hover:text-surface-900-100 transition-colors" aria-label="Envoy home">
        <Logo class="size-5" />
      </a>
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-surface-500">
          <a href="/" class="hover:text-surface-900-100 transition-colors">Envoy</a> • {currentYear}
        </p>
        <div class="w-fit">
          <ThemeToggle />
        </div>
      </div>
    </div>

    <div class="self-start justify-self-end md:self-start min-w-0">
      <nav class="flex flex-col items-end justify-start gap-1 md:flex-row md:items-center md:gap-4 text-sm text-surface-500" aria-label="Footer links">
        <a href="/privacy" class="hover:text-surface-900-100 transition-colors">Privacy</a>
        <a href="/terms" class="hover:text-surface-900-100 transition-colors">Terms</a>
        <a href="/contact" class="hover:text-surface-900-100 transition-colors">Contact</a>
      </nav>
    </div>
  </div>
</footer>
