<!--
  VendorSearch — authenticated consumer vendor discovery panel.

  Props:
    context         — 'contacts' | 'project' | 'new-project'
    projectUuid     — required when context = 'project'; the project to attach listings to
    projectVendors  — UUIDs of vendors already attached to the project (for deriving attachment state)
    onClose         — called when the user dismisses the panel (no selection made)
    onAttached      — called after successful project attachment with the list of attached listing UUIDs
    onSavedToContacts — called after each successful contacts save with the listing UUID

  Usage examples:
    <VendorSearch context="contacts" {onClose} {onSavedToContacts} />
    <VendorSearch context="project" projectUuid="abc" {projectVendors} {onClose} {onAttached} />
    <VendorSearch context="new-project" {onClose} bind:pendingUuids />
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import {
    AlertTriangleIcon,
    CheckCircleIcon,
    LoaderCircleIcon,
    ShieldAlertIcon,
    MapPinIcon,
    XIcon,
    SearchIcon,
  } from '@lucide/svelte';
  import DismissibleBanner from '#components/dismissible_banner.svelte';
  import { groupVendorsByPrimaryClassification } from '../utils/vendor_grouping';

  interface VendorLocation {
    address?: string | null;
    locality?: string | null;
    region?: string | null;
    postcode?: string | null;
    country?: string | null;
    formatted_address?: string | null;
  }

  // ── Types ──────────────────────────────────────────────────────────────────
  export interface VendorResult {
    vendorListingUuid: string;
    name: string;
    categories: string[];
    location: VendorLocation | null;
    hasEmail: boolean;
    onboardedToEnvoy: boolean;
    consumerOwned: boolean;
    inContacts: boolean;
    vendorUuid: string | null;
  }

  type Context = 'contacts' | 'project' | 'new-project';
  const MAX_SELECTED_VENDORS = 8;

  // ── Props ──────────────────────────────────────────────────────────────────
  const {
    context,
    projectUuid    = null,
    projectVendors = [],
    selectedVendors = [],
    onClose        = () => {},
    onAttached     = (_uuids: string[]) => {},
    onSavedToContacts = (_uuid: string) => {},
    onSelectionChange = (_vendors: VendorResult[]) => {},
    onContinue = null,
    continueDisabled = false,
  }: {
    context: Context;
    projectUuid?: string | null;
    projectVendors?: string[];
    selectedVendors?: VendorResult[];
    onClose?: () => void;
    onAttached?: (uuids: string[]) => void;
    onSavedToContacts?: (uuid: string) => void;
    onSelectionChange?: (vendors: VendorResult[]) => void;
    onContinue?: (() => void) | null;
    continueDisabled?: boolean;
  } = $props();

  // ── State ──────────────────────────────────────────────────────────────────
  let projectDescription = $state('');
  let postalCode         = $state('');
  let descError          = $state('');
  let postalError        = $state('');
  let searching          = $state(false);
  let searchError        = $state('');
  let retryable          = $state(false);

  let results    = $state<VendorResult[]>([]);
  let vendorByUuid = $state<Record<string, VendorResult>>(
    Object.fromEntries(
      untrack(() => selectedVendors).map((vendor) => [vendor.vendorListingUuid, vendor])
    )
  );
  let hasSearched = $state(false);

  // Per-listing contact save state
  let savingContact  = $state<Record<string, boolean>>({});
  let savedContact   = $state<Record<string, boolean>>({});
  let saveErrors     = $state<Record<string, string>>({});

  // Selection (for project and new-project contexts)
  let selected       = $state<Set<string>>(
    new Set(untrack(() => selectedVendors).map((vendor) => vendor.vendorListingUuid))
  );
  let selectionError = $state('');

  // Attachment state
  let attaching      = $state(false);
  let attachError    = $state('');
  let attachRetryable = $state(false);

  // Derived: which listings are already in this project
  const attachedSet = $derived(new Set(projectVendors));
  const resultGroups = $derived(groupVendorsByPrimaryClassification(results));
  const selectableResultUuids = $derived(
    results
      .map((vendor) => vendor.vendorListingUuid)
      .filter((uuid) => !attachedSet.has(uuid))
  );
  const allSelectableResultsSelected = $derived(
    selectableResultUuids.length > 0 &&
      selectableResultUuids.every((uuid) => selected.has(uuid))
  );

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): boolean {
    descError   = '';
    postalError = '';
    let valid = true;
    if (!projectDescription.trim()) {
      descError = 'Describe what you need.';
      valid = false;
    } else if (projectDescription.trim().length < 5) {
      descError = 'Please enter at least 5 characters.';
      valid = false;
    }
    if (!postalCode.trim()) {
      postalError = 'ZIP or postal code is required.';
      valid = false;
    }
    return valid;
  }

  function formatLocation(location: VendorLocation | null): string {
    if (!location) return '';
    if (location.formatted_address?.trim()) return location.formatted_address.trim();

    return [location.address, location.locality, location.region, location.postcode, location.country]
      .filter((part): part is string => !!part?.trim())
      .join(', ');
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  async function search() {
    if (!validate()) return;

    searching   = true;
    searchError = '';
    retryable   = false;
    selected    = new Set(selectedVendors.map((vendor) => vendor.vendorListingUuid));
    hasSearched = false;

    try {
      const res = await fetch('/api/vendors/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDescription: projectDescription.trim(),
          postalCode: postalCode.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const isServerError = res.status >= 500;
        searchError = body?.error ?? (isServerError
          ? 'Search is temporarily unavailable. Please try again.'
          : 'Search failed. Please check your inputs and try again.');
        retryable = isServerError;
        return;
      }

      const data: { vendors: VendorResult[] } = await res.json();
      const nextResults = (data.vendors ?? []).slice(0, 8);
      results    = nextResults;
      vendorByUuid = {
        ...vendorByUuid,
        ...Object.fromEntries(nextResults.map((vendor) => [vendor.vendorListingUuid, vendor])),
      };
      hasSearched = true;
      if (context === 'contacts') {
        selected = new Set();
      } else {
        const nextSelected = new Set(selected);
        let skippedSelection = false;
        for (const uuid of nextResults
          .map((vendor) => vendor.vendorListingUuid)
          .filter((vendorUuid) => !projectVendors.includes(vendorUuid))) {
          if (nextSelected.size >= MAX_SELECTED_VENDORS) {
            skippedSelection = true;
            continue;
          }
          nextSelected.add(uuid);
        }
        selected = nextSelected;
        selectionError = skippedSelection
          ? `You can select up to ${MAX_SELECTED_VENDORS} contacts. Deselect one to add more.`
          : '';
      }
      publishSelection(selected);

      // Sync inContacts state from results into savedContact map
      for (const v of results) {
        if (v.inContacts) savedContact[v.vendorListingUuid] = true;
      }
    } catch {
      searchError = 'Network error. Please check your connection and try again.';
      retryable   = true;
    } finally {
      searching = false;
    }
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  function publishSelection(nextSelected: Set<string>) {
    if (context === 'new-project') {
      onSelectionChange(
        [...nextSelected]
          .map((uuid) => vendorByUuid[uuid])
          .filter((vendor): vendor is VendorResult => !!vendor)
      );
    }
  }

  function toggleSelection(uuid: string) {
    if (context === 'contacts') return; // no multi-select in contacts context

    const next = new Set(selected);
    if (next.has(uuid)) {
      next.delete(uuid);
    } else {
      if (next.size >= MAX_SELECTED_VENDORS) {
        selectionError = `You can select up to ${MAX_SELECTED_VENDORS} contacts.`;
        return;
      }
      next.add(uuid);
    }
    selectionError = '';
    selected = next;
    publishSelection(next);
  }

  function toggleAllResults() {
    if (context === 'contacts') return;
    selectionError = '';
    const next = new Set(selected);
    if (allSelectableResultsSelected) {
      for (const uuid of selectableResultUuids) {
        next.delete(uuid);
      }
    } else {
      let skippedSelection = false;
      for (const uuid of selectableResultUuids) {
        if (next.size >= MAX_SELECTED_VENDORS) {
          skippedSelection = true;
          continue;
        }
        next.add(uuid);
      }
      selectionError = skippedSelection
        ? `You can select up to ${MAX_SELECTED_VENDORS} contacts. Deselect one to add more.`
        : '';
    }
    selected = next;
    publishSelection(selected);
  }

  function confirmNewProjectSelection() {
    publishSelection(selected);
    onAttached([...selected]);
    selected = new Set();
  }

  function continueFromSearch() {
    publishSelection(selected);
    onContinue?.();
  }

  // ── Save to Contacts ───────────────────────────────────────────────────────
  async function saveToContacts(uuid: string) {
    if (savingContact[uuid] || savedContact[uuid]) return;
    savingContact = { ...savingContact, [uuid]: true };
    saveErrors    = { ...saveErrors, [uuid]: '' };

    try {
      const res = await fetch(`/api/vendors/${uuid}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        savedContact = { ...savedContact, [uuid]: true };
        // Update inContacts on the result object
        results = results.map((v) =>
          v.vendorListingUuid === uuid ? { ...v, inContacts: true } : v
        );
        onSavedToContacts(uuid);
      } else {
        saveErrors = { ...saveErrors, [uuid]: 'Could not save. Try again.' };
      }
    } catch {
      saveErrors = { ...saveErrors, [uuid]: 'Network error. Try again.' };
    } finally {
      savingContact = { ...savingContact, [uuid]: false };
    }
  }

  // ── Save multiple to Contacts (contacts context action) ────────────────────
  async function saveSelectedToContacts() {
    if (selected.size === 0) {
      selectionError = 'Select at least one contact to save.';
      return;
    }
    selectionError = '';

    const uuids = [...selected].filter((uuid) => !savedContact[uuid]);
    await Promise.all(uuids.map(saveToContacts));
    selected = new Set();
  }

  // ── Attach to existing project ─────────────────────────────────────────────
  async function attachToProject() {
    if (!projectUuid) return;
    if (selected.size === 0) {
      selectionError = 'Select at least one contact to add.';
      return;
    }

    selectionError  = '';
    attaching       = true;
    attachError     = '';
    attachRetryable = false;

    try {
      const res = await fetch(`/api/projects/${projectUuid}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorListingUuids: [...selected] }),
      });

      if (res.ok) {
        const attached = [...selected];
        // Also ensure they're saved in Contacts after successful attachment
        for (const uuid of attached) {
          if (!savedContact[uuid]) {
            savedContact = { ...savedContact, [uuid]: true };
          }
        }
        onAttached(attached);
        selected = new Set();
      } else {
        const body = await res.json().catch(() => ({}));
        attachError     = body?.error || 'Could not add contacts to the project. None were added.';
        attachRetryable = res.status >= 500;
      }
    } catch {
      attachError     = 'Network error. Please try again.';
      attachRetryable = true;
    } finally {
      attaching = false;
    }
  }

  // ── Keyboard nav on vendor cards ───────────────────────────────────────────
</script>

<div class="relative space-y-5" aria-busy={searching}>
  {#if searching}
    <div class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface-50-950/80 backdrop-blur-sm">
      <div class="flex items-center gap-3 rounded-xl border border-surface-200-800 bg-surface-50-950 px-4 py-3 shadow-lg">
        <LoaderCircleIcon class="size-5 animate-spin text-primary-500" />
        <span class="text-sm font-medium">Searching</span>
      </div>
    </div>
  {/if}

  <!-- Header -->
  <div class="flex items-center justify-between gap-3">
    <h2 class="text-lg font-semibold flex items-center gap-2">
      <SearchIcon class="size-5 text-primary-500" />
      Find additional contacts
    </h2>
    <button
      type="button"
      onclick={onClose}
      aria-label="Close search"
      class="btn btn-sm preset-tonal rounded-full p-1.5"
    >
      <XIcon class="size-4" />
    </button>
  </div>

  <!-- Search inputs -->
  <div class="space-y-3">
    <label class="label" for="vs-desc">
      <span class="font-medium">What do you need?</span>
      <textarea
        id="vs-desc"
        class="textarea resize-none"
        class:input-error={!!descError}
        rows="2"
        placeholder="e.g. Florist for an outdoor wedding in fall"
        bind:value={projectDescription}
        disabled={searching}
        aria-describedby={descError ? 'vs-err-desc' : undefined}
        aria-invalid={descError ? 'true' : undefined}
      ></textarea>
      {#if descError}<p id="vs-err-desc" class="text-error-500 text-sm">{descError}</p>{/if}
    </label>

    <label class="label" for="vs-postal">
      <span class="font-medium flex items-center gap-1.5"><MapPinIcon class="size-4" /> ZIP or postal code</span>
      <input
        id="vs-postal"
        type="text"
        class="input"
        class:input-error={!!postalError}
        placeholder="e.g. 10001"
        bind:value={postalCode}
        disabled={searching}
        aria-describedby={postalError ? 'vs-err-postal' : undefined}
        aria-invalid={postalError ? 'true' : undefined}
      />
      {#if postalError}<p id="vs-err-postal" class="text-error-500 text-sm">{postalError}</p>{/if}
    </label>

    {#if searchError}
      <DismissibleBanner variant="error" class="p-3" onDismiss={() => (searchError = '')}>
        {searchError}
        {#if retryable}
          <button type="button" onclick={search} class="ml-2 underline text-error-500 text-sm">Retry</button>
        {/if}
      </DismissibleBanner>
    {/if}

    <button
      type="button"
      class="btn preset-filled-primary-500 w-full"
      onclick={search}
      disabled={searching}
      aria-busy={searching}
    >
      {searching ? 'Searching...' : hasSearched ? 'Search again' : 'Search'}
    </button>
  </div>

  <!-- Results -->
  {#if hasSearched}
    {#if results.length === 0}
      <div class="text-center py-6 space-y-1" aria-live="polite">
        <p class="font-medium">No matches found</p>
        <p class="text-sm text-surface-600-400">Try adjusting your description or location.</p>
      </div>
    {:else}
      <section aria-label="Search results" aria-live="polite" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-surface-600-400">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {#if context !== 'contacts' && selected.size > 0}
              - {selected.size} selected
            {/if}
          </p>
          {#if context !== 'contacts'}
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="btn btn-sm preset-tonal"
                onclick={toggleAllResults}
                disabled={selectableResultUuids.length === 0}
              >
                {allSelectableResultsSelected ? 'Deselect all' : 'Select all'}
              </button>
              {#if context === 'new-project' && onContinue}
                <button
                  type="button"
                  class="btn btn-sm preset-filled-primary-500"
                  onclick={continueFromSearch}
                  disabled={continueDisabled}
                >
                  Select contacts & continue{selected.size > 0 ? ` (${selected.size})` : ''}
                </button>
              {/if}
            </div>
          {/if}
        </div>

        {#if selectionError}
          <DismissibleBanner variant="error" class="p-3" onDismiss={() => (selectionError = '')}>
            <p>{selectionError}</p>
          </DismissibleBanner>
        {/if}

        <div class="space-y-5">
          {#each resultGroups as group}
            <section
              aria-label={`${group.classification} contacts`}
              data-vendor-classification={group.classification}
              class="space-y-2"
            >
              <div class="flex items-center justify-between gap-3 border-b border-surface-200-800 pb-1.5">
                <h3 class="font-semibold text-sm">{group.classification}</h3>
                <span class="text-xs text-surface-500">{group.vendors.length}</span>
              </div>
              <ul class="space-y-2" role="list">
                {#each group.vendors as vendor (vendor.vendorListingUuid)}
            {@const isSelected = selected.has(vendor.vendorListingUuid)}
            {@const isAttached = attachedSet.has(vendor.vendorListingUuid)}
            {@const isInContacts = savedContact[vendor.vendorListingUuid] || vendor.inContacts}
            <li>
              <!-- Card is interactive for selection (project/new-project) or contact save (contacts) -->
              {#if context === 'contacts'}
                <div class="rounded-xl border border-surface-200-800 bg-surface-50-950/30 p-4 space-y-2">
                  {@render VendorCardContent({ vendor, isInContacts })}
                  <div class="flex justify-end">
                    {#if isInContacts}
                      <span class="text-xs text-primary-500 font-medium flex items-center gap-1">
                        <CheckCircleIcon class="size-3.5" /> Saved to Contacts
                      </span>
                    {:else}
                      <button
                        type="button"
                        onclick={() => saveToContacts(vendor.vendorListingUuid)}
                        disabled={savingContact[vendor.vendorListingUuid]}
                        class="btn btn-sm preset-tonal text-xs"
                      >
                        {savingContact[vendor.vendorListingUuid] ? 'Saving…' : 'Save to Contacts'}
                      </button>
                    {/if}
                    {#if saveErrors[vendor.vendorListingUuid]}
                      <p class="text-error-500 text-xs mt-1">{saveErrors[vendor.vendorListingUuid]}</p>
                    {/if}
                  </div>
                </div>
              {:else}
                <!-- Selectable card (project / new-project context) -->
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                    disabled={isAttached}
                    onclick={() => !isAttached && toggleSelection(vendor.vendorListingUuid)}
                  class="w-full text-left rounded-xl border p-4 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                    {isAttached
                      ? 'border-surface-200-800 opacity-60 cursor-default'
                      : isSelected
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-surface-200-800 bg-surface-50-950/30 hover:bg-surface-100-900/40'}"
                >
                  <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                      {@render VendorCardContent({ vendor, isInContacts })}
                      {#if isAttached}
                        <p class="text-xs text-primary-500 mt-1 flex items-center gap-1">
                          <CheckCircleIcon class="size-3.5" /> Already in this project
                        </p>
                      {/if}
                    </div>
                    {#if !isAttached}
                      <div class="shrink-0 mt-0.5">
                        <div class="size-5 rounded-full border-2 flex items-center justify-center transition-colors {isSelected ? 'border-primary-500 bg-primary-500' : 'border-surface-400'}">
                          {#if isSelected}
                            <svg class="size-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                </button>
              {/if}
            </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>

        <!-- Context-specific action bar -->
        {#if context === 'project'}
          <div class="space-y-2 pt-2">
            {#if attachError}
              <DismissibleBanner variant="error" class="p-3" onDismiss={() => (attachError = '')}>
                {attachError}
                {#if attachRetryable}
                  <button type="button" onclick={attachToProject} class="ml-2 underline text-error-500 text-sm">Retry</button>
                {/if}
              </DismissibleBanner>
            {/if}
            <button
              type="button"
              class="btn preset-filled-primary-500 w-full"
              onclick={attachToProject}
              disabled={attaching || selected.size === 0}
            >
              {attaching ? 'Adding…' : `Add ${selected.size > 0 ? selected.size : ''} contact${selected.size !== 1 ? 's' : ''} to project`}
            </button>
          </div>

        {:else if context === 'contacts'}
          <!-- No bulk action in contacts — each card has its own Save button above -->

        {:else if context === 'new-project'}
          <div class="space-y-2 pt-2">
            <p class="text-sm text-surface-600-400 text-center">
              {selected.size > 0 ? `${selected.size} contact${selected.size !== 1 ? 's' : ''} selected` : 'Select contacts to add when you create the project.'}
            </p>
            <button
              type="button"
              class="btn preset-filled-primary-500 w-full"
              onclick={confirmNewProjectSelection}
              disabled={selected.size === 0}
            >
              Confirm selection ({selected.size})
            </button>
          </div>
        {/if}
      </section>
    {/if}
  {/if}

</div>

<!-- Inline sub-component for vendor card content (avoids repetition) -->
{#snippet VendorCardContent(p: { vendor: VendorResult; isInContacts: boolean })}
  <div class="space-y-1">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="font-semibold text-sm">{p.vendor.name}</span>
      {#if p.vendor.onboardedToEnvoy}
        <span class="inline-flex items-center gap-1 text-xs font-medium text-primary-500 bg-primary-500/10 rounded-full px-2 py-0.5">
          <CheckCircleIcon class="size-3" />
          Onboarded to Envoy
        </span>
      {/if}
      {#if p.vendor.consumerOwned}
        <span class="inline-flex items-center gap-1 text-xs font-medium text-warning-500 bg-warning-500/10 rounded-full px-2 py-0.5">
          <ShieldAlertIcon class="size-3" />
          Unverified listing
        </span>
      {/if}
      {#if p.vendor.hasEmail === false}
        <span class="inline-flex items-center gap-1 text-xs font-medium text-warning-500 bg-warning-500/10 rounded-full px-2 py-0.5">
          <AlertTriangleIcon class="size-3" />
          Additional contact details required
        </span>
      {/if}
      {#if p.isInContacts}
        <span class="inline-flex items-center gap-1 text-xs text-surface-500">
          <CheckCircleIcon class="size-3" /> In Contacts
        </span>
      {/if}
    </div>
    {#if formatLocation(p.vendor.location)}
      <p class="text-xs text-surface-500 flex items-center gap-1">
        <MapPinIcon class="size-3 shrink-0" />{formatLocation(p.vendor.location)}
      </p>
    {/if}
    {#if p.vendor.categories.length > 0}
      <p class="text-xs text-surface-500">{p.vendor.categories.join(' · ')}</p>
    {/if}
  </div>
{/snippet}
