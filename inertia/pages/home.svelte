<script lang="ts">
  import Sidebar from "#components/sidebar.svelte";
  import LocationSearch from '#components/location_search.svelte';
  import type { LocationData } from '#components/location_search.svelte';
  import VendorSearch from '#components/vendor_search.svelte';
  import { router } from '@inertiajs/svelte'
  import { page } from '@inertiajs/svelte'
  import { onDestroy } from 'svelte'
  import { Steps } from '@skeletonlabs/skeleton-svelte';
  import { showNewProjectForm } from '../stores/ui';
  import { FolderPlusIcon, FolderIcon, ChevronRightIcon } from '@lucide/svelte';

  const STORAGE_KEY = 'new-project-draft';

  const { currencies = [] } = $props();
  const flash = $derived($page.props.flash || {});
  const user = $derived($page.props.user);
  const projects = $derived($page.props.projects || []);
  const recentProjects = $derived(projects.slice(0, 3));

  // Common currencies to show at the top
  const commonCurrencyCodes = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MXN', 'BRL'];

  // Sort currencies: common ones first, then alphabetically
  const sortedCurrencies = $derived.by(() => {
    const common = [];
    const other = [];

    for (const currency of currencies) {
      if (commonCurrencyCodes.includes(currency.code)) {
        common.push(currency);
      } else {
        other.push(currency);
      }
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

  // Load persisted draft from localStorage
  function loadDraft() {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  const draft = loadDraft();

  const showForm = $derived($showNewProjectForm);
  let processing = $state(false);
  let errors = $state<Record<string, string>>({});

  // Vendor discovery state — selected listing UUIDs are preserved through project creation
  // and attached via POST /api/projects/:projectUuid/vendors after the project is created.
  let showVendorSearch = $state(false);
  let pendingVendorListingUuids = $state<string[]>([]);
  let attachingVendors = $state(false);
  let attachVendorError = $state('');
  let currentStep = $state<number>(typeof draft.currentStep === 'number' ? draft.currentStep : 0);

  let title = $state<string>(draft.title ?? '');
  let description = $state<string>(draft.description ?? '');
  let location = $state<LocationData | null>(draft.location ?? null);
  let startDate = $state<string>(draft.startDate ?? '');
  let endDate = $state<string>(draft.endDate ?? '');
  let deadline = $state<string>(draft.deadline ?? '');
  let budgetAmount = $state<string>(draft.budgetAmount ?? '');
  let budgetCurrency = $state<string>(draft.budgetCurrency ?? 'USD');
  let goals = $state<string>(draft.goals ?? '');
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounce draft persistence to keep typing responsive.
  $effect(() => {
    if (typeof localStorage === 'undefined') return;
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
    }
    const data = {
      currentStep,
      title,
      description,
      location,
      startDate,
      endDate,
      deadline,
      budgetAmount,
      budgetCurrency,
      goals,
    };
    draftSaveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      draftSaveTimer = null;
    }, 250);

    return () => {
      if (draftSaveTimer) {
        clearTimeout(draftSaveTimer);
      }
    };
  });

  onDestroy(() => {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = null;
    }
  });

  function toggleForm() {
    showNewProjectForm.set(!showForm);
  }

  function closeForm() {
    showNewProjectForm.set(false);
  }

  function clearDraft() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function resetForm() {
    title = '';
    description = '';
    location = null;
    startDate = '';
    endDate = '';
    deadline = '';
    budgetAmount = '';
    budgetCurrency = 'USD';
    goals = '';
    errors = {};
    currentStep = 0;
    clearDraft();
  }

  function nextStep() {
    if (currentStep === 0 && !title.trim()) {
      errors = { title: 'Project title is required.' };
      return;
    }
    errors = {};
    currentStep += 1;
  }

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
      isActive: true,
    };
  }

  function submitProject() {
    processing = true;
    errors = {};
    attachVendorError = '';

    router.post('/projects', buildPayload(), {
      onFinish: () => {
        processing = false;
      },
      onError: (formErrors) => {
        errors = formErrors || {};
      },
      onSuccess: async (page) => {
        // The server redirects to /projects/:uuid after creation.
        // Inertia follows the redirect internally so page.url is the final URL.
        // Parse the UUID from it rather than expecting a prop that doesn't exist.
        const targetUrl = page.url ?? '';
        const uuidMatch = targetUrl.match(/\/projects\/([^/?#]+)/);
        const projectUuid = uuidMatch ? uuidMatch[1] : null;
        const vendorListingUuidsToAttach = [...pendingVendorListingUuids];

        // Attach any vendor listings selected during new-project creation
        if (projectUuid && vendorListingUuidsToAttach.length > 0) {
          attachingVendors = true;
          const warningKey = `project-vendor-attach-warning:${projectUuid}`;
          try {
            const res = await fetch(`/api/projects/${projectUuid}/vendors`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vendorListingUuids: vendorListingUuidsToAttach }),
            });
            if (!res.ok) {
              attachVendorError = 'Project created, but vendors could not be added. You can retry from the project page.';
              sessionStorage.setItem(warningKey, attachVendorError);
            }
          } catch {
            attachVendorError = 'Project created, but vendors could not be added due to a network error.';
            sessionStorage.setItem(warningKey, attachVendorError);
          }
          attachingVendors = false;
        }

        resetForm();
        pendingVendorListingUuids = [];
        showNewProjectForm.set(false);

        // Explicitly navigate to the project page. Inertia may have already
        // followed the redirect, but this ensures the browser URL and view are
        // in sync even when they aren't (prevents the "page doesn't change" bug).
        const destination = projectUuid ? `/projects/${projectUuid}` : '/dashboard';
        if (typeof window !== 'undefined') {
          if (projectUuid && vendorListingUuidsToAttach.length > 0) {
            // The create redirect has already rendered the project page while
            // attachment was still running. Reload once so linked vendors (or
            // the persisted warning) are visible in the final page state.
            window.location.replace(destination);
          } else if (window.location.pathname !== destination) {
            router.visit(destination);
          }
        }
      },
    });
  }
</script>

<svelte:head>
  <title>Homepage</title>
</svelte:head>

<Sidebar>

  {#if showForm}
    <div class="w-full max-w-2xl px-6 py-10 space-y-6 mx-auto">
      <header>
        <h1 class="text-2xl font-semibold">Create New Project</h1>
        <p class="text-surface-600-400">Step through the details or skip ahead to get started.</p>
      </header>

      {#if flash.error}
        <aside class="card preset-tonal-error p-4">
          <p>{flash.error}</p>
        </aside>
      {/if}

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
                  <span>Description</span>
                  <textarea class="textarea" rows="3" bind:value={description} placeholder="Describe your project..."></textarea>
                  {#if errors.description}<p class="text-error-500 text-sm">{errors.description}</p>{/if}
                </label>
              </div>
            </section>
            <!-- Vendor discovery (optional) -->
            <div class="border-t border-surface-200-800 pt-4">
              <button
                type="button"
                class="btn btn-sm {showVendorSearch ? 'preset-filled-primary-500' : 'preset-tonal'} w-full"
                onclick={() => { showVendorSearch = !showVendorSearch; }}
                aria-expanded={showVendorSearch}
              >
                🔍 {showVendorSearch ? 'Hide contact search' : 'Find new contacts for this project'}
                {#if pendingVendorListingUuids.length > 0}
                  <span class="ml-1 text-xs bg-white/20 rounded-full px-2 py-0.5">{pendingVendorListingUuids.length} selected</span>
                {/if}
              </button>
              {#if showVendorSearch}
                <div class="mt-3">
                  <VendorSearch
                    context="new-project"
                    onClose={() => { showVendorSearch = false; }}
                    onAttached={(uuids) => {
                      pendingVendorListingUuids = [...new Set([...pendingVendorListingUuids, ...uuids])];
                      showVendorSearch = false;
                    }}
                  />
                </div>
              {/if}
            </div>

            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={closeForm}>Cancel</button>
              <button class="btn preset-filled-primary-500" type="button" onclick={nextStep}>Continue</button>
            </footer>
          </Steps.Content>

          <Steps.Content index={1} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Where & When</h2>
                <p class="text-sm text-surface-600-400 mt-0.5">Set a location and timeline for the project.</p>
              </div>
              <label class="label" for="create-location"><span>Location</span></label>
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
              <button class="btn preset-tonal" type="button" onclick={() => { errors = {}; currentStep -= 1; }}>Back</button>
              <div class="flex gap-2">
                <button class="btn preset-tonal" type="button" onclick={submitProject} disabled={processing}>
                  {processing ? 'Creating...' : 'Skip & create project'}
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
              <button class="btn preset-tonal" type="button" onclick={() => { errors = {}; currentStep -= 1; }}>Back</button>
              <div class="flex gap-2">
                <button class="btn preset-tonal" type="button" onclick={submitProject} disabled={processing}>
                  {processing ? 'Creating...' : 'Skip & create project'}
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
            {#if attachVendorError}
              <aside class="card preset-tonal-warning p-3 text-sm">{attachVendorError}</aside>
            {/if}
            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={() => { errors = {}; currentStep -= 1; }}>Back</button>
              <button class="btn preset-filled-primary-500" type="button" onclick={submitProject} disabled={processing || attachingVendors}>
                {#if attachingVendors}
                  Adding vendors…
                {:else if processing}
                  Creating…
                {:else}
                  Create project{pendingVendorListingUuids.length > 0 ? ` + ${pendingVendorListingUuids.length} vendor${pendingVendorListingUuids.length !== 1 ? 's' : ''}` : ''}
                {/if}
              </button>
            </footer>
          </Steps.Content>
        </div>
      </Steps>
    </div>
  {:else}
    {#if flash.error}
      <div class="w-full max-w-md px-6 sm:px-0 my-4 sm:mx-auto">
        <aside class="card preset-tonal-error p-4">
          <p>{flash.error}</p>
        </aside>
      </div>
    {/if}
    {#if flash.success}
      <div class="w-full max-w-md px-6 sm:px-0 my-4 sm:mx-auto">
        <aside class="card preset-tonal p-4">
          <p>{flash.success}</p>
        </aside>
      </div>
    {/if}

    {#if recentProjects.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center text-center space-y-5 max-w-sm p-6 mx-auto mt-42">
        <div class="p-4 rounded-full bg-surface-200-800">
          <FolderPlusIcon class="size-10 text-primary-500" />
        </div>
        <div class="space-y-2">
          <h1 class="text-2xl font-bold">No projects yet</h1>
          <p class="text-surface-600-400">Plan projects, manage contacts, and draft outreach - all in one place.</p>
        </div>
        <button class="btn preset-filled-primary-500" onclick={toggleForm}>
          Create your first project
        </button>
      </div>
    {:else}
      <!-- Populated state -->
      <div class="w-full max-w-5xl p-6 space-y-8">
        <header class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 class="text-3xl font-bold">Jump back in{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}</h1>
            <p class="text-surface-600-400 text-sm mt-2">Pick up where you left off or start a fresh project.</p>
          </div>
          <button class="btn preset-filled-primary-500" onclick={toggleForm}>
            + New project
          </button>
        </header>

        <section class="rounded-2xl border border-surface-200-800 bg-surface-50-950/40 backdrop-blur-md p-5 sm:p-6 space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 class="text-lg font-semibold">Recent projects</h2>
              <p class="text-sm text-surface-600-400 mt-1">Your latest workspaces, ready to reopen.</p>
            </div>
            <p class="text-xs uppercase tracking-[0.18em] text-surface-600-400">{recentProjects.length} shown</p>
          </div>

          <ul class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {#each recentProjects as project (project.uuid)}
              <li>
                <a
                  href="/projects/{project.uuid}"
                  class="flex h-full items-start gap-3 rounded-xl border border-surface-200-800 bg-surface-100-900/20 p-4 transition-colors hover:bg-surface-100-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
                  <FolderIcon class="size-4 text-primary-500 shrink-0 mt-0.5" />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm truncate">{project.title}</p>
                    {#if project.description}
                      <p class="text-xs text-surface-600-400 mt-1 line-clamp-2">{project.description}</p>
                    {/if}
                  </div>
                  <ChevronRightIcon class="size-4 text-surface-400 shrink-0 mt-0.5" />
                </a>
              </li>
            {/each}
          </ul>
        </section>
      </div>
    {/if}
  {/if}

</Sidebar>
