<script lang="ts">
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
  import { AlertTriangleIcon, ClockIcon } from '@lucide/svelte';

  const {
    vendorName = null,
    vendorApprovalStatus = 'PENDING',
  }: {
    vendorName?: string | null;
    vendorApprovalStatus?: 'PENDING' | 'REJECTED';
  } = $props();

  const isRejected = $derived(vendorApprovalStatus === 'REJECTED');
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
          {#if isRejected}
            <AlertTriangleIcon class="size-10 text-warning-500" />
          {:else}
            <ClockIcon class="size-10 text-warning-500" />
          {/if}
        </div>
      </div>

      <div class="space-y-2">
        <h1 class="text-3xl font-bold">{isRejected ? 'We need more information' : "You're on the list"}</h1>
        {#if isRejected}
          <p class="text-surface-600-400">
            We could not approve{vendorName ? ` ${vendorName}` : ' your pro account'} yet. Contact us so we can help verify your business.
          </p>
        {:else if vendorName}
          <p class="text-surface-600-400">
            Thanks, <span class="font-semibold text-surface-900-100">{vendorName}</span>. Your pro account has been created and is pending approval.
          </p>
        {:else}
          <p class="text-surface-600-400">
            Your pro account has been created and is pending approval.
          </p>
        {/if}
      </div>

      {#if !isRejected}
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
      {/if}

      <p class="text-sm text-surface-600-400">
        Questions? <a href="/contact" class="text-primary-500 hover:underline">Get in touch</a>.
      </p>
    </div>
  </main>

  <PublicFooter />
</div>
