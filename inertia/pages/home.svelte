<script lang="ts">
  import Sidebar from "#components/sidebar.svelte";
  import LocationSearch from '#components/location_search.svelte';
  import type { LocationData } from '#components/location_search.svelte';
  import { router } from '@inertiajs/svelte'
  import { page } from '@inertiajs/svelte'
  import { showNewProjectForm } from '../stores/ui';
  import { FolderPlusIcon, FolderIcon, ChevronRightIcon } from '@lucide/svelte';

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
    
    // Sort common by their position in commonCurrencyCodes
    common.sort((a, b) => commonCurrencyCodes.indexOf(a.code) - commonCurrencyCodes.indexOf(b.code));
    // Sort other alphabetically
    other.sort((a, b) => a.code.localeCompare(b.code));
    
    return [...common, ...other];
  });

  const showForm = $derived($showNewProjectForm);
  let processing = $state(false);
  let errors = $state({});

  let title = $state('');
  let description = $state('');
  let location = $state<LocationData | null>(null);
  let startDate = $state('');
  let endDate = $state('');
  let deadline = $state('');
  let budgetAmount = $state('');
  let budgetCurrency = $state('USD');
  let goals = $state('');

  function toggleForm() {
    showNewProjectForm.set(!showForm);
  }

  function closeForm() {
    showNewProjectForm.set(false);
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
  }

  function submitProject(event) {
    event.preventDefault();
    processing = true;
    errors = {};

    const startDateIso = toIsoDateTime(startDate);
    const endDateIso = toIsoDateTime(endDate);
    const deadlineIso = toIsoDateTime(deadline);

    const payload = {
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

    router.post('/projects', payload, {
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

  function toIsoDateTime(value) {
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
    <!-- New Project Form -->
    <div class="w-full max-w-2xl p-6 space-y-6">
      <header>
        <h1 class="h2">Create New Project</h1>
        <p class="text-surface-600-400">Fill in the details below to create a new project.</p>
      </header>

      {#if flash.error}
        <aside class="card preset-tonal-error p-4">
          <p>{flash.error}</p>
        </aside>
      {/if}

      <form class="card preset-outlined-surface-200-800 p-6 space-y-6" onsubmit={submitProject}>
        <!-- Basic Info -->
        <section class="space-y-4">
          <h3 class="h4">Basic Information</h3>
          
          <label class="label">
            <span>Title <span class="text-error-500">*</span></span>
            <input class="input" type="text" bind:value={title} placeholder="Enter project title" required />
            {#if errors.title}<p class="text-error-500 text-sm">{errors.title}</p>{/if}
          </label>

          <label class="label">
            <span>Description</span>
            <textarea class="textarea" rows="3" bind:value={description} placeholder="Describe your project..."></textarea>
            {#if errors.description}<p class="text-error-500 text-sm">{errors.description}</p>{/if}
          </label>
        </section>

        <hr class="hr" />

        <!-- Location -->
        <section class="space-y-4">
          <h3 class="h4">Location</h3>
          <label class="label" for="create-location"><span>City or address</span></label>
          <LocationSearch
            id="create-location"
            value={location}
            onchange={(loc) => { location = loc; }} />
          {#if errors.location}<p class="text-error-500 text-sm">{errors.location}</p>{/if}
        </section>

        <hr class="hr" />

        <!-- Timeline -->
        <section class="space-y-4">
          <h3 class="h4">Timeline</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <hr class="hr" />

        <!-- Budget -->
        <section class="space-y-4">
          <h3 class="h4">Budget</h3>
          <div class="label">
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
          </div>
        </section>

        <hr class="hr" />

        <!-- Goals -->
        <section class="space-y-4">
          <h3 class="h4">Goals</h3>
          <label class="label">
            <span>Project Goals</span>
            <textarea class="textarea" rows="3" bind:value={goals} placeholder="What do you want to achieve?"></textarea>
            {#if errors.goals}<p class="text-error-500 text-sm">{errors.goals}</p>{/if}
          </label>
        </section>

        <!-- Actions -->
        <footer class="flex justify-end gap-2 pt-4">
          <button class="btn preset-tonal" type="button" onclick={closeForm}>Cancel</button>
          <button class="btn preset-filled-primary-500" type="submit" disabled={processing}>
            {processing ? 'Creating...' : 'Create Project'}
          </button>
        </footer>
      </form>
    </div>
  {:else}
    {#if flash.error}
      <aside class="card preset-tonal-error p-4 w-full max-w-md mb-4">
        <p>{flash.error}</p>
      </aside>
    {/if}
    {#if flash.success}
      <aside class="card preset-tonal p-4 w-full max-w-md mb-4">
        <p>{flash.success}</p>
      </aside>
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
