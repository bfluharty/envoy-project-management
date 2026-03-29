<script lang="ts">
  import Sidebar from "#components/sidebar.svelte";
  import LocationSearch from '#components/location_search.svelte';
  import type { LocationData } from '#components/location_search.svelte';
  import { router } from '@inertiajs/svelte'
  import { page } from '@inertiajs/svelte'
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

  // Persist draft to localStorage whenever any field changes
  $effect(() => {
    if (typeof localStorage === 'undefined') return;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    const startDateIso = toIsoDateTime(startDate);
    const endDateIso = toIsoDateTime(endDate);
    const deadlineIso = toIsoDateTime(deadline);

    return {
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(location ? { location } : {}),
      ...(startDateIso ? { startDate: startDateIso } : {}),
      ...(endDateIso ? { endDate: endDateIso } : {}),
      ...(deadlineIso ? { deadline: deadlineIso } : {}),
      ...(budgetAmount !== '' ? { budgetAmount: Number(budgetAmount) } : {}),
      ...(budgetCurrency ? { budgetCurrency } : {}),
      ...(goals.trim() ? { goals: goals.trim() } : {}),
      isActive: true,
    };
  }

  function submitProject() {
    processing = true;
    errors = {};

    router.post('/projects', buildPayload(), {
      onFinish: () => {
        processing = false;
      },
      onError: (formErrors) => {
        errors = formErrors || {};
      },
      onSuccess: () => {
        resetForm();
        showNewProjectForm.set(false);
      },
    });
  }

  function toIsoDateTime(value: string) {
    if (!value) return undefined;
    const dateTime = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(dateTime.getTime())) return undefined;
    return dateTime.toISOString();
  }
</script>

<svelte:head>
  <title>Homepage</title>
</svelte:head>

<Sidebar>

  {#if showForm}
    <div class="w-full max-w-2xl px-6 py-10 space-y-6">
      <header>
        <h1 class="text-2xl font-semibold">Create New Project</h1>
        <p class="text-surface-400">Step through the details or skip ahead to get started.</p>
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
                  group-data-[state=incomplete]:bg-surface-200-800 group-data-[state=incomplete]:text-surface-400">
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
                  group-data-[state=incomplete]:text-surface-400">
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
        <div class="@container card preset-outlined-surface-200-800 p-4 sm:p-6">
          <Steps.Content index={0} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Essentials</h2>
                <p class="text-sm text-surface-400 mt-0.5">Give your project a name to get started.</p>
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
            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={closeForm}>Cancel</button>
              <button class="btn preset-filled-primary-500" type="button" onclick={nextStep}>Continue</button>
            </footer>
          </Steps.Content>

          <Steps.Content index={1} class="space-y-6">
            <section class="space-y-4">
              <div>
                <h2 class="h4">Where & When</h2>
                <p class="text-sm text-surface-400 mt-0.5">Set a location and timeline for the project.</p>
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
                <p class="text-sm text-surface-400 mt-0.5">Set a budget to track project spending.</p>
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
                <p class="text-sm text-surface-400 mt-0.5">What does success look like for this project?</p>
              </div>
              <label class="label">
                <span>Project Goals</span>
                <textarea class="textarea" rows="4" bind:value={goals} placeholder="What do you want to achieve?"></textarea>
                {#if errors.goals}<p class="text-error-500 text-sm">{errors.goals}</p>{/if}
              </label>
            </section>
            <footer class="flex justify-between items-center pt-2">
              <button class="btn preset-tonal" type="button" onclick={() => { errors = {}; currentStep -= 1; }}>Back</button>
              <button class="btn preset-filled-primary-500" type="button" onclick={submitProject} disabled={processing}>
                {processing ? 'Creating...' : 'Create project'}
              </button>
            </footer>
          </Steps.Content>
        </div>
      </Steps>
    </div>
  {:else}
    {#if flash.error}
      <div class="w-full max-w-md px-6 sm:px-0 my-4">
        <aside class="card preset-tonal-error p-4">
          <p>{flash.error}</p>
        </aside>
      </div>
    {/if}
    {#if flash.success}
      <div class="w-full max-w-md px-6 sm:px-0 my-4">
        <aside class="card preset-tonal p-4">
          <p>{flash.success}</p>
        </aside>
      </div>
    {/if}

    {#if recentProjects.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center text-center space-y-5 max-w-sm p-6">
        <div class="p-4 rounded-full bg-surface-200-800">
          <FolderPlusIcon class="size-10 text-primary-500" />
        </div>
        <div class="space-y-2">
          <h1 class="text-2xl font-bold">No projects yet</h1>
          <p class="text-surface-400">Plan projects, manage contacts, and draft outreach — all in one place.</p>
        </div>
        <button class="btn preset-filled-primary-500" onclick={toggleForm}>
          Create your first project
        </button>
      </div>
    {:else}
      <!-- Populated state -->
      <div class="w-full max-w-md p-6 space-y-5">
        <div>
          <h1 class="text-2xl font-bold">Jump back in{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}</h1>
          <p class="text-surface-400 text-sm mt-1">Pick up where you left off.</p>
        </div>
        <ul class="space-y-2">
          {#each recentProjects as project (project.uuid)}
            <li>
              <a
                href="/projects/{project.uuid}"
                class="flex items-center gap-3 p-3 card hover:preset-tonal rounded-lg transition-colors">
                <FolderIcon class="size-4 text-primary-500 shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm truncate">{project.title}</p>
                  {#if project.description}
                    <p class="text-xs text-surface-400 truncate">{project.description}</p>
                  {/if}
                </div>
                <ChevronRightIcon class="size-4 text-surface-400 shrink-0" />
              </a>
            </li>
          {/each}
        </ul>
        <button class="btn preset-filled-primary-500 w-full" onclick={toggleForm}>
          + New project
        </button>
      </div>
    {/if}
  {/if}

</Sidebar>
