<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
  import { ClockIcon } from '@lucide/svelte';

  const {
    vendorName = null,
  }: {
    vendorName?: string | null;
  } = $props();
</script>

<svelte:head>
  <title>Envoy — Account Pending</title>
</svelte:head>

<div class="min-h-dvh flex flex-col overflow-x-clip">
  <Navbar showGuestCta={false} />

  <main class="flex-1 flex items-center justify-center px-6 sm:px-8 py-12">
    <div class="max-w-md w-full text-center space-y-6">
      <div class="flex justify-center">
        <div class="p-4 rounded-full bg-warning-500/10">
          <ClockIcon class="size-10 text-warning-500" />
        </div>
      </div>

      <div class="space-y-2">
        <h1 class="text-3xl font-bold">You're on the list</h1>
        {#if vendorName}
          <p class="text-surface-600-400">
            Thanks, <span class="font-semibold text-surface-900-100">{vendorName}</span>. Your vendor account has been created and is pending approval.
          </p>
        {:else}
          <p class="text-surface-600-400">
            Your vendor account has been created and is pending approval.
          </p>
        {/if}
      </div>

      <div class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 p-5 text-left space-y-3 text-sm text-surface-600-400">
        <p class="font-medium text-surface-900-100">What happens next?</p>
        <ul class="space-y-2 list-none">
          <li class="flex items-start gap-2">
            <span class="text-primary-500 font-bold mt-px">1.</span>
            Our team reviews your profile to confirm you're a legitimate professional or business.
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary-500 font-bold mt-px">2.</span>
            Once approved, you'll receive an email with next steps to complete your profile.
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary-500 font-bold mt-px">3.</span>
            After that, Envoy can start routing project inquiries your way.
          </li>
        </ul>
      </div>

      <p class="text-sm text-surface-600-400">
        Questions? <a href="/contact" class="text-primary-500 hover:underline">Get in touch</a>.
      </p>
    </div>
  </main>

  <PublicFooter />
</div>
