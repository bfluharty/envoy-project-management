<script lang="ts">
  import Sidebar from '#components/sidebar.svelte';
  import LocationSearch from '#components/location_search.svelte';
  import type { LocationData } from '#components/location_search.svelte';
  import { router } from '@inertiajs/svelte';
  import { page } from '@inertiajs/svelte';
  import { onMount, untrack } from 'svelte';
  import { Steps } from '@skeletonlabs/skeleton-svelte';
  import { CheckCircleIcon, ShieldAlertIcon, MapPinIcon, AlertTriangleIcon } from '@lucide/svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface VendorLocation {
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    country?: string;
    formatted_address?: string;
  }

  interface SelectedVendor {
    vendorListingUuid: string;
    name: string;
    location: VendorLocation | null;
    categories: string[];
    onboardedToEnvoy: boolean;
    consumerOwned: boolean;
    ownershipWarning: string | null;
  }

  interface ProjectPrefill {
    title?: string;
    description?: string | null;
    location?: Record<string, unknown> | null;
  }

  interface RecoveryLinks {
    dashboardUrl: string;
    vendorSearchUrl: string;
  }

  type OnboardingLocationData = LocationData & { postalCode?: string };

  // ── Props from backend ─────────────────────────────────────────────────────
  const {
    state: onboardingState = 'active',
    project = null,
    selectedVendors = [],
    currencies = [],
    recovery = null,
  }: {
    state?: 'active' | 'expired';
    project?: ProjectPrefill | null;
    selectedVendors?: SelectedVendor[];
    currencies?: { code: string; name: string }[];
    recovery?: RecoveryLinks | null;
  } = $props();

  const flash = $derived($page.props.flash || {});
  const expired = $derived(onboardingState === 'expired');

  // ── Currency sort ──────────────────────────────────────────────────────────
  const commonCurrencyCodes = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MXN', 'BRL'];
  const sortedCurrencies = $derived.by(() => {
    const common: typeof currencies = [];
    const other: typeof currencies = [];
    for (const c of currencies) {
      (commonCurrencyCodes.includes(c.code) ? common : other).push(c);
    }
    common.sort((a, b) => commonCurrencyCodes.indexOf(a.code) - commonCurrencyCodes.indexOf(b.code));
    other.sort((a, b) => a.code.localeCompare(b.code));
    return [...common, ...other];
  });

  const steps = [
    { label: 'Essentials' },
    { label: 'Details' },
    { label: 'Budget' },
    { label: 'Goals' },
  ];

  // ── Form state — prefilled from draft ─────────────────────────────────────
  let currentStep   = $state(0);
  let processing    = $state(false);
  let errors        = $state<Record<string, string>>({});

  const initialProject = untrack(() => project);
  let title          = $state(initialProject?.title ?? '');
  let description    = $state(initialProject?.description ?? '');
  let location       = $state<OnboardingLocationData | null>(normalizeProjectLocation(initialProject?.location));
  let startDate      = $state('');
  let endDate        = $state('');
  let deadline       = $state('');
  let budgetAmount   = $state('');
  let budgetCurrency = $state('USD');
  let goals          = $state('');

  function normalizeProjectLocation(
    value: Record<string, unknown> | null | undefined
  ): OnboardingLocationData | null {
    if (!value) return null;

    const formattedAddress =
      typeof value.formatted_address === 'string'
        ? value.formatted_address
        : typeof value.formattedAddress === 'string'
          ? value.formattedAddress
          : typeof value.postalCode === 'string'
            ? value.postalCode
            : typeof value.postcode === 'string'
              ? value.postcode
              : '';

    if (!formattedAddress) return null;

    return {
      city:
        typeof value.city === 'string'
          ? value.city
          : typeof value.locality === 'string'
            ? value.locality
            : formattedAddress,
      state:
        typeof value.state === 'string'
          ? value.state
          : typeof value.region === 'string'
            ? value.region
            : '',
      postcode:
        typeof value.postcode === 'string'
          ? value.postcode
          : typeof value.postalCode === 'string'
            ? value.postalCode
            : undefined,
      formatted_address: formattedAddress,
      lat: typeof value.lat === 'number' ? value.lat : null,
      lon: typeof value.lon === 'number' ? value.lon : null,
      postalCode:
        typeof value.postalCode === 'string'
          ? value.postalCode
          : typeof value.postcode === 'string'
            ? value.postcode
            : undefined,
    };
  }

  function formatVendorLocation(value: VendorLocation | null): string {
    if (!value) return '';
    if (value.formatted_address) return value.formatted_address;
    return [value.address, value.locality, value.region, value.postcode, value.country]
      .filter(Boolean)
      .join(', ');
  }

  onMount(() => {
    if (onboardingState === 'expired') {
      localStorage.removeItem('envoy_onboarding_token');
      localStorage.removeItem('envoy_seen');
    }
  });

  // ── Step nav ───────────────────────────────────────────────────────────────
  function nextStep() {
    if (currentStep === 0 && !title.trim()) {
      errors = { title: 'Project title is required.' };
      return;
    }
    errors = {};
    currentStep += 1;
  }

  function prevStep() {
    errors = {};
    currentStep -= 1;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function buildPayload() {
    return {
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(location ? { location } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(deadline ? { deadline } : {}),
      ...(budgetAmount !== '' ? { budgetAmount: Number(budgetAmount) } : {}),
      ...(budgetCurrency ? { budgetCurrency } : {}),
      ...(goals.trim() ? { goals: goals.trim() } : {}),
    };
  }

  function submitProject() {
    if (processing) return;
    if (!title.trim()) {
      errors = { title: 'Project title is required.' };
      currentStep = 0;
      return;
    }

    processing = true;
    errors = {};

    router.post('/onboarding/project', buildPayload(), {
      onFinish: () => { processing = false; },
      onError: (formErrors) => {
        errors = formErrors || {};
        // Return to step 0 on title errors so user sees them
        if (formErrors?.title) currentStep = 0;
      },
      onSuccess: () => {
        // The server redirects to the created project. Clear browser-only draft
        // state after that redirect succeeds; the server draft is already consumed.
        localStorage.removeItem('envoy_onboarding_token');
        localStorage.removeItem('envoy_seen');
      },
    });
  }
</script>

<svelte:head>
  <title>Complete your project — Envoy</title>
</svelte:head>

<Sidebar>
  <div class="w-full max-w-2xl px-6 py-10 space-y-6 mx-auto">

    {#if expired}
      <!-- Expired draft state — do not log out -->
      <div class="text-center space-y-4 py-10">
        <div class="flex justify-center">
          <div class="p-4 rounded-full bg-warning-500/10">
            <AlertTriangleIcon class="size-10 text-warning-500" />
          </div>
        </div>
        <h1 class="text-2xl font-bold">Your session has expired</h1>
        <p class="text-surface-600-400">The onboarding session that brought you here has expired or already been used.</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={recovery?.dashboardUrl ?? '/dashboard'} class="btn preset-filled-primary-500">Go to Dashboard</a>
          <a href={recovery?.vendorSearchUrl ?? '/'} class="btn preset-tonal">Start a new vendor search</a>
        </div>
      </div>

    {:else}
      <header>
        <h1 class="text-2xl font-semibold">Complete your project</h1>
        <p class="text-surface-600-400">We've prefilled what we know. Fill in the rest to get started.</p>
      </header>

      {#if flash.error}
        <aside class="card preset-tonal-error p-4">
          <p>{flash.error}</p>
        </aside>
      {/if}

      {#if flash.partial_success}
        <aside class="card preset-tonal-warning p-4" role="status">
          <p>{flash.partial_success}</p>
        </aside>
      {/if}

      <!-- Selected vendor review -->
      {#if selectedVendors.length > 0}
        <section class="space-y-3">
          <h2 class="font-medium text-sm text-surface-600-400 uppercase tracking-wide">Vendors you selected</h2>
          <ul class="space-y-2" role="list">
            {#each selectedVendors as vendor (vendor.vendorListingUuid)}
              <li class="flex items-start gap-3 rounded-xl border border-surface-200-800 bg-surface-50-950/30 p-3">
                <div class="flex-1 min-w-0 space-y-0.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{vendor.name}</span>
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
                    <p class="text-xs text-surface-500 flex items-center gap-1">
                      <MapPinIcon class="size-3 shrink-0" />{formatVendorLocation(vendor.location)}
                    </p>
                  {/if}
                  {#if vendor.categories.length > 0}
                    <p class="text-xs text-surface-500">{vendor.categories.join(' · ')}</p>
                  {/if}
                  {#if vendor.consumerOwned && vendor.ownershipWarning}
                    <p class="text-xs text-warning-600-400">{vendor.ownershipWarning}</p>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Project form wizard (matches pattern from home.svelte) -->
      <Steps
        step={currentStep}
        count={steps.length}
        onStepChange={(details) => { errors = {}; currentStep = details.step; }}
        linear={false}
        class="space-y-6"
      >
        <!-- Step list -->
        <Steps.List class="flex w-full">
          {#each steps as step, i}
            <Steps.Item index={i} class="flex flex-1 items-start last:flex-none">
              <Steps.Trigger
                disabled={i > currentStep}
                class="group flex flex-col items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-default"
              >
                <Steps.Indicator class="size-7 shrink-0 rounded-full text-xs font-semibold flex items-center justify-center transition-colors duration-200
                  group-data-[state=complete]:bg-primary-500/20 group-data-[state=complete]:text-primary-500
                  group-data-[state=current]:bg-primary-500 group-data-[state=current]:text-white
                  group-data-[state=incomplete]:bg-surface-200-800 group-data-[state=incomplete]:text-surface-700-300">
                  {#if i < currentStep}
                    <svg class="size-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  {:else}
                    {i + 1}
                  {/if}
                </Steps.Indicator>
                <span class="text-xs leading-tight text-center w-14 transition-colors duration-200
                  group-data-[state=complete]:text-primary-500
                  group-data-[state=current]:text-surface-900-100 group-data-[state=current]:font-medium
                  group-data-[state=incomplete]:text-surface-700-300">
                  {step.label}
                </span>
              </Steps.Trigger>
              {#if i < steps.length - 1}
                <Steps.Separator class="flex-1 h-px self-start mt-3.5 mx-1 transition-colors duration-300
                  data-[state=complete]:bg-primary-500
                  data-[state=incomplete]:bg-surface-300-700" />
              {/if}
            </Steps.Item>
          {/each}
        </Steps.List>

        <!-- Step content -->
        <div class="@container card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-4 sm:p-6">
          <Steps.Content index={0} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Essentials</h2>
                <p class="text-sm text-surface-600-400 mt-0.5">Give your project a name to get started.</p>
              </div>
              <div class="space-y-4">
                <label class="label">
                  <span>Title <span class="text-error-500">*</span></span>
                  <input class="input" type="text" bind:value={title} placeholder="Enter project title" />
                  {#if errors.title}<p class="text-error-500 text-sm">{errors.title}</p>{/if}
                </label>
                <label class="label">
                  <span>Description <span class="text-surface-500 text-xs font-normal">(prefilled from your search)</span></span>
                  <textarea class="textarea" rows="3" bind:value={description} placeholder="Describe your project..."></textarea>
                  {#if errors.description}<p class="text-error-500 text-sm">{errors.description}</p>{/if}
                </label>
              </div>
            </section>
            <footer class="flex justify-end pt-2">
              <button class="btn preset-filled-primary-500" type="button" onclick={nextStep}>Continue</button>
            </footer>
          </Steps.Content>

          <Steps.Content index={1} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Where & When</h2>
                <p class="text-sm text-surface-600-400 mt-0.5">Set a location and timeline for the project.</p>
              </div>
              <label class="label" for="create-location">
                <span>Location <span class="text-surface-500 text-xs font-normal">(prefilled from your search)</span></span>
              </label>
              <LocationSearch
                id="create-location"
                value={location}
                onchange={(loc) => { location = loc; }} />
              {#if errors.location}<p class="text-error-500 text-sm">{errors.location}</p>{/if}
              <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 gap-4">
                <label class="label">
                  <span>Start Date</span>
                  <input class="input" type="date" bind:value={startDate} />
                  {#if errors.startDate}<p class="text-error-500 text-sm">{errors.startDate}</p>{/if}
                </label>
                <label class="label">
                  <span>End Date</span>
                  <input class="input" type="date" bind:value={endDate} />
                  {#if errors.endDate}<p class="text-error-500 text-sm">{errors.endDate}</p>{/if}
                </label>
                <label class="label">
                  <span>Deadline</span>
                  <input class="input" type="date" bind:value={deadline} />
                  {#if errors.deadline}<p class="text-error-500 text-sm">{errors.deadline}</p>{/if}
                </label>
              </div>
            </section>
            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={prevStep}>Back</button>
              <div class="flex gap-2">
                <button class="btn preset-tonal" type="button" onclick={submitProject} disabled={processing}>
                  {processing ? 'Creating...' : 'Skip & create'}
                </button>
                <button class="btn preset-filled-primary-500" type="button" onclick={nextStep}>Continue</button>
              </div>
            </footer>
          </Steps.Content>

          <Steps.Content index={2} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Budget</h2>
                <p class="text-sm text-surface-600-400 mt-0.5">Set a budget to track project spending.</p>
              </div>
              <label class="label">
                <span>Amount</span>
                <div class="input-group grid-cols-[1fr_auto]">
                  <input class="ig-input" type="number" min="0" step="0.01" bind:value={budgetAmount} placeholder="0.00" />
                  <select class="ig-select" bind:value={budgetCurrency}>
                    {#each sortedCurrencies as currency}
                      <option value={currency.code}>{currency.code}</option>
                    {/each}
                  </select>
                </div>
                {#if errors.budgetAmount}<p class="text-error-500 text-sm">{errors.budgetAmount}</p>{/if}
                {#if errors.budgetCurrency}<p class="text-error-500 text-sm">{errors.budgetCurrency}</p>{/if}
              </label>
            </section>
            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={prevStep}>Back</button>
              <div class="flex gap-2">
                <button class="btn preset-tonal" type="button" onclick={submitProject} disabled={processing}>
                  {processing ? 'Creating...' : 'Skip & create'}
                </button>
                <button class="btn preset-filled-primary-500" type="button" onclick={nextStep}>Continue</button>
              </div>
            </footer>
          </Steps.Content>

          <Steps.Content index={3} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Goals</h2>
                <p class="text-sm text-surface-600-400 mt-0.5">What does success look like for this project?</p>
              </div>
              <label class="label">
                <span>Project Goals</span>
                <textarea class="textarea" rows="4" bind:value={goals} placeholder="What do you want to achieve?"></textarea>
                {#if errors.goals}<p class="text-error-500 text-sm">{errors.goals}</p>{/if}
              </label>
            </section>
            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={prevStep}>Back</button>
              <button class="btn preset-filled-primary-500" type="button" onclick={submitProject} disabled={processing}>
                {processing ? 'Creating project...' : 'Create project'}
              </button>
            </footer>
          </Steps.Content>
        </div>
      </Steps>
    {/if}

  </div>
</Sidebar>
