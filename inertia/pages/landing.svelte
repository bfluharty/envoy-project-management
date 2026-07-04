<script lang="ts">
  import Logo from '#components/logo.svelte';
  import Navbar from '#components/navbar.svelte';
  import PublicFooter from '#components/public_footer.svelte';
  import { page } from '@inertiajs/svelte';
  import { onMount } from 'svelte';
  import { CheckCircleIcon, AlertTriangleIcon, ShieldAlertIcon, MailIcon, MapPinIcon } from '@lucide/svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface VendorListing {
    uuid: string;
    name: string;
    location: string | null;
    categories: string[];
    hasEmail: boolean;
    onboardedToEnvoy: boolean;
    consumerOwned: boolean;
  }

  interface DraftRestoreResponse {
    token: string;
    projectBlurb: string | null;
    postalCode: string | null;
    recommendations: VendorListing[];
    selectedVendorListingUuids: string[];
  }

  // ── localStorage keys ──────────────────────────────────────────────────────
  const TOKEN_KEY = 'envoy_onboarding_token';
  const SEEN_KEY  = 'envoy_seen';

  // ── State ──────────────────────────────────────────────────────────────────
  let blurb         = $state('');
  let postalCode    = $state('');
  let blurbError    = $state('');
  let postalError   = $state('');
  let searching     = $state(false);
  let searchError   = $state('');

  let token         = $state<string | null>(null);
  let recommendations = $state<VendorListing[]>([]);
  let selected      = $state<Set<string>>(new Set());
  let selectionError = $state('');
  let persistingSelection = $state(false);

  // Derived: has the anonymous user seen results?
  let seen          = $state(false);
  let restoring     = $state(false);

  // ── Restore on mount ───────────────────────────────────────────────────────
  onMount(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) return;

    restoring = true;
    try {
      const res = await fetch('/onboarding/draft/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: storedToken }),
      });

      if (!res.ok) {
        // Draft missing, expired, consumed, or abandoned — clear state without login redirect
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SEEN_KEY);
        token = null;
        seen = false;
        return;
      }

      const data: DraftRestoreResponse = await res.json();
      token = data.token;
      blurb = data.projectBlurb ?? '';
      postalCode = data.postalCode ?? '';
      recommendations = data.recommendations ?? [];
      selected = new Set(data.selectedVendorListingUuids ?? []);
      seen = localStorage.getItem(SEEN_KEY) === 'true' && recommendations.length > 0;
    } catch {
      // Network failure — silently clear stale state
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SEEN_KEY);
    } finally {
      restoring = false;
    }
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateInputs(): boolean {
    blurbError = '';
    postalError = '';
    let valid = true;

    const trimmedBlurb = blurb.trim();
    if (trimmedBlurb.length < 5) {
      blurbError = 'Please describe your project (at least 5 characters).';
      valid = false;
    } else if (trimmedBlurb.length > 2000) {
      blurbError = 'Description must be 2,000 characters or fewer.';
      valid = false;
    }

    if (!postalCode.trim()) {
      postalError = 'ZIP or postal code is required.';
      valid = false;
    }

    return valid;
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!validateInputs()) return;

    searching = true;
    searchError = '';
    selected = new Set();

    try {
      const res = await fetch('/onboarding/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectBlurb: blurb.trim(),
          postalCode: postalCode.trim(),
          ...(token ? { token } : {}),
        }),
      });

      if (!res.ok) {
        searchError = 'Something went wrong. Please try again.';
        return;
      }

      const data: { token: string; recommendations: VendorListing[] } = await res.json();
      token = data.token;
      recommendations = (data.recommendations ?? []).slice(0, 8);

      // Persist token and mark seen
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(SEEN_KEY, 'true');
      seen = true;
    } catch {
      searchError = 'Network error. Please check your connection and try again.';
    } finally {
      searching = false;
    }
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  async function toggleSelection(uuid: string) {
    const next = new Set(selected);
    if (next.has(uuid)) {
      next.delete(uuid);
    } else {
      if (next.size >= 8) {
        selectionError = 'You can select up to 8 vendors.';
        return;
      }
      next.add(uuid);
    }
    selectionError = '';
    selected = next;

    if (!token) return;

    persistingSelection = true;
    try {
      await fetch('/onboarding/vendor-selection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          selectedVendorListingUuids: [...selected],
        }),
      });
    } catch {
      // Non-fatal — selection is still shown in UI
    } finally {
      persistingSelection = false;
    }
  }

  // ── Continue to registration ───────────────────────────────────────────────
  async function handleContinue() {
    if (selected.size === 0) {
      selectionError = 'Please select at least one vendor to continue.';
      return;
    }

    // If a server-side handoff is needed before navigating away
    if (token) {
      try {
        await fetch('/onboarding/registration-handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch {
        // Proceed anyway — handoff is best-effort
      }
    }

    // Navigate to registration without token in URL
    window.location.href = '/register?accountType=consumer';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const examplePrompts = [
    'Outdoor wedding for 150 guests in fall',
    'Renovate a 1920s kitchen',
    'Company offsite for 40 people',
  ];

  function applyPrompt(prompt: string) {
    blurb = prompt;
    blurbError = '';
  }
</script>

<svelte:head>
  <title>Envoy — Find vendors for your project</title>
</svelte:head>

<div class="min-h-dvh flex flex-col overflow-x-clip">
  <Navbar showGuestCta={true} />

  <main class="flex-1 flex flex-col items-center justify-start px-4 sm:px-8 pt-10 sm:pt-16 pb-10">

    {#if $page.props.user}
      <!-- Authenticated: redirect nudge -->
      <div class="max-w-md w-full text-center space-y-4 mt-16">
        <Logo class="w-16 h-16 mx-auto text-primary-500" />
        <h1 class="text-3xl font-bold">Welcome back{$page.props.user.fullName ? `, ${$page.props.user.fullName.split(' ')[0]}` : ''}</h1>
        <p class="text-surface-600-400">Head to your dashboard to manage projects and vendors.</p>
        <a href="/dashboard" class="btn preset-filled-primary-500">Go to Dashboard</a>
      </div>

    {:else}
      <!-- Anonymous intake -->
      <div class="max-w-2xl w-full space-y-8">

        <!-- Hero -->
        <div class="text-center space-y-3">
          <Logo class="w-12 h-12 mx-auto text-primary-500" />
          <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">Plan any project.<br />We line up the vendors.</h1>
          <p class="text-surface-600-400 text-lg">Describe what you need and where, and Envoy surfaces the right pros.</p>
        </div>

        <!-- Intake form -->
        <div class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-5 sm:p-7 space-y-5">

          <div class="space-y-1.5">
            <label class="label font-medium" for="blurb">What are you planning?</label>
            <textarea
              id="blurb"
              class="textarea resize-none"
              class:input-error={!!blurbError}
              rows="3"
              placeholder="e.g. Outdoor wedding for 150 guests in fall…"
              bind:value={blurb}
              maxlength={2000}
              aria-describedby={blurbError ? 'err-blurb' : undefined}
              aria-invalid={blurbError ? 'true' : undefined}
            ></textarea>
            {#if blurbError}
              <p id="err-blurb" class="text-error-500 text-sm">{blurbError}</p>
            {:else}
              <p class="text-xs text-surface-500">{blurb.length}/2000 characters</p>
            {/if}
          </div>

          <!-- Example prompts -->
          {#if !seen}
            <div class="flex flex-wrap gap-2">
              {#each examplePrompts as prompt}
                <button
                  type="button"
                  onclick={() => applyPrompt(prompt)}
                  class="btn btn-sm preset-tonal text-xs"
                >
                  {prompt}
                </button>
              {/each}
            </div>
          {/if}

          <div class="space-y-1.5">
            <label class="label font-medium" for="postalCode">
              <span class="flex items-center gap-1.5"><MapPinIcon class="size-4" /> ZIP or postal code</span>
            </label>
            <input
              id="postalCode"
              type="text"
              class="input"
              class:input-error={!!postalError}
              placeholder="e.g. 10001 or M5H 2N2"
              bind:value={postalCode}
              aria-describedby={postalError ? 'err-postal' : undefined}
              aria-invalid={postalError ? 'true' : undefined}
            />
            {#if postalError}
              <p id="err-postal" class="text-error-500 text-sm">{postalError}</p>
            {/if}
          </div>

          {#if searchError}
            <aside class="card preset-tonal-error p-3 text-sm">{searchError}</aside>
          {/if}

          <button
            type="button"
            class="btn preset-filled-primary-500 w-full"
            onclick={handleSearch}
            disabled={searching || restoring}
          >
            {#if restoring}
              Restoring your search…
            {:else if searching}
              Finding vendors…
            {:else if seen}
              Search again
            {:else}
              Find vendors
            {/if}
          </button>
        </div>

        <!-- Results -->
        {#if restoring}
          <div class="text-center text-surface-500 text-sm py-4" aria-live="polite">Restoring your previous search…</div>
        {:else if seen}
          {#if recommendations.length === 0}
            <!-- Empty state — no vendors found -->
            <div class="text-center space-y-2 py-6">
              <p class="font-medium">No vendors found for your search.</p>
              <p class="text-surface-600-400 text-sm">Try adjusting your description or location and search again.</p>
            </div>
          {:else}
            <section aria-label="Vendor recommendations" class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 class="font-semibold text-lg">Vendors for your project</h2>
                <span class="text-sm text-surface-500">{recommendations.length} result{recommendations.length !== 1 ? 's' : ''}</span>
              </div>

              {#if selectionError}
                <aside class="card preset-tonal-error p-3 text-sm" role="alert">{selectionError}</aside>
              {/if}

              <ul class="space-y-3" role="list">
                {#each recommendations as vendor (vendor.uuid)}
                  {@const isSelected = selected.has(vendor.uuid)}
                  <li>
                    <button
                      type="button"
                      onclick={() => toggleSelection(vendor.uuid)}
                      aria-pressed={isSelected}
                      class="w-full text-left rounded-xl border p-4 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {isSelected
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-surface-200-800 bg-surface-50-950/30 hover:bg-surface-100-900/40'}"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0 space-y-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-semibold truncate">{vendor.name}</span>
                            {#if vendor.onboardedToEnvoy}
                              <span class="inline-flex items-center gap-1 text-xs font-medium text-primary-500 bg-primary-500/10 rounded-full px-2 py-0.5">
                                <CheckCircleIcon class="size-3" />
                                Onboarded to Envoy
                              </span>
                            {/if}
                            {#if vendor.consumerOwned}
                              <span class="inline-flex items-center gap-1 text-xs font-medium text-warning-500 bg-warning-500/10 rounded-full px-2 py-0.5">
                                <ShieldAlertIcon class="size-3" />
                                Unverified listing
                              </span>
                            {/if}
                          </div>

                          {#if vendor.location}
                            <p class="text-sm text-surface-600-400 flex items-center gap-1">
                              <MapPinIcon class="size-3.5 shrink-0" />
                              {vendor.location}
                            </p>
                          {/if}

                          {#if vendor.categories.length > 0}
                            <p class="text-xs text-surface-500">{vendor.categories.join(' · ')}</p>
                          {/if}

                          {#if !vendor.hasEmail}
                            <p class="text-xs text-surface-500 flex items-center gap-1 mt-1">
                              <MailIcon class="size-3.5 shrink-0" />
                              No email on file — Envoy will attempt to reach out via other means
                            </p>
                          {/if}
                        </div>

                        <!-- Selection indicator -->
                        <div class="shrink-0 mt-0.5">
                          <div class="size-5 rounded-full border-2 flex items-center justify-center transition-colors {isSelected ? 'border-primary-500 bg-primary-500' : 'border-surface-400'}">
                            {#if isSelected}
                              <svg class="size-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                {/each}
              </ul>

              <div class="pt-2 space-y-2">
                <p class="text-sm text-surface-500 text-center">
                  {selected.size} of {recommendations.length} selected
                  {#if persistingSelection}
                    <span class="text-xs"> · saving…</span>
                  {/if}
                </p>

                <button
                  type="button"
                  class="btn preset-filled-primary-500 w-full"
                  onclick={handleContinue}
                  disabled={selected.size === 0}
                >
                  Continue with {selected.size > 0 ? selected.size : ''} vendor{selected.size !== 1 ? 's' : ''} →
                </button>

                <p class="text-xs text-center text-surface-500">
                  You'll create a free account to confirm your selection.
                  Already have one? <a href="/login" class="text-primary-500 hover:underline">Sign in</a>.
                </p>
              </div>

              <!-- Vendor CTA -->
              <div class="border-t border-surface-200-800 pt-4 text-center">
                <p class="text-sm text-surface-600-400">
                  Are you a vendor or pro?
                  <a href="/register?accountType=vendor" class="text-primary-500 hover:underline font-medium">Join Envoy as a pro →</a>
                </p>
              </div>
            </section>
          {/if}

        {:else}
          <!-- Pre-search vendor CTA -->
          <div class="text-center pt-2">
            <p class="text-sm text-surface-600-400">
              Are you a vendor or pro?
              <a href="/register?accountType=vendor" class="text-primary-500 hover:underline font-medium">Join Envoy as a pro →</a>
            </p>
          </div>
        {/if}

      </div>
    {/if}

  </main>

  <PublicFooter />
</div>
