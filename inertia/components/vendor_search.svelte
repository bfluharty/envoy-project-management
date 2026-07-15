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
  import { CheckCircleIcon, ShieldAlertIcon, MapPinIcon, XIcon, SearchIcon } from '@lucide/svelte';

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

  // ── Props ──────────────────────────────────────────────────────────────────
  const {
    context,
    projectUuid    = null,
    projectVendors = [],
    onClose        = () => {},
    onAttached     = (_uuids: string[]) => {},
    onSavedToContacts = (_uuid: string) => {},
  }: {
    context: Context;
    projectUuid?: string | null;
    projectVendors?: string[];
    onClose?: () => void;
    onAttached?: (uuids: string[]) => void;
    onSavedToContacts?: (uuid: string) => void;
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
  let hasSearched = $state(false);

  // Per-listing contact save state
  let savingContact  = $state<Record<string, boolean>>({});
  let savedContact   = $state<Record<string, boolean>>({});
  let saveErrors     = $state<Record<string, string>>({});

  // Selection (for project and new-project contexts)
  let selected       = $state<Set<string>>(new Set());
  let selectionError = $state('');

  // Attachment state
  let attaching      = $state(false);
  let attachError    = $state('');
  let attachRetryable = $state(false);

  // Derived: which listings are already in this project
  const attachedSet = $derived(new Set(projectVendors));

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
    selected    = new Set();
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
          ? 'Our vendor search is temporarily unavailable. Please try again.'
          : 'Search failed. Please check your inputs and try again.');
        retryable = isServerError;
        return;
      }

      const data: { vendors: VendorResult[] } = await res.json();
      results    = (data.vendors ?? []).slice(0, 8);
      hasSearched = true;

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
  function toggleSelection(uuid: string) {
    if (context === 'contacts') return; // no multi-select in contacts context

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
      selectionError = 'Select at least one vendor to save.';
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
      selectionError = 'Select at least one vendor to add.';
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
        attachError     = body?.error || 'Could not add vendors to the project. None were added.';
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

<div class="space-y-5">

  <!-- Header -->
  <div class="flex items-center justify-between gap-3">
    <h2 class="text-lg font-semibold flex items-center gap-2">
      <SearchIcon class="size-5 text-primary-500" />
      Find additional contacts
    </h2>
    <button
      type="button"
      onclick={onClose}
      aria-label="Close vendor search"
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
        aria-describedby={postalError ? 'vs-err-postal' : undefined}
        aria-invalid={postalError ? 'true' : undefined}
      />
      {#if postalError}<p id="vs-err-postal" class="text-error-500 text-sm">{postalError}</p>{/if}
    </label>

    {#if searchError}
      <aside class="card preset-tonal-error p-3 text-sm" role="alert">
        {searchError}
        {#if retryable}
          <button type="button" onclick={search} class="ml-2 underline text-error-500 text-sm">Retry</button>
        {/if}
      </aside>
    {/if}

    <button
      type="button"
      class="btn preset-filled-primary-500 w-full"
      onclick={search}
      disabled={searching}
      aria-busy={searching}
    >
      {searching ? 'Searching…' : hasSearched ? 'Search again' : 'Search vendors'}
    </button>
  </div>

  <!-- Results -->
  {#if hasSearched}
    {#if results.length === 0}
      <div class="text-center py-6 space-y-1" aria-live="polite">
        <p class="font-medium">No vendors found</p>
        <p class="text-sm text-surface-600-400">Try adjusting your description or location.</p>
      </div>
    {:else}
      <section aria-label="Search results" aria-live="polite" class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm text-surface-600-400">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {#if context !== 'contacts' && selected.size > 0}
              · {selected.size} selected
            {/if}
          </p>
        </div>

        {#if selectionError}
          <aside class="card preset-tonal-error p-3 text-sm" role="alert">{selectionError}</aside>
        {/if}

        <ul class="space-y-2" role="list">
          {#each results as vendor (vendor.vendorListingUuid)}
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

        <!-- Context-specific action bar -->
        {#if context === 'project'}
          <div class="space-y-2 pt-2">
            {#if attachError}
              <aside class="card preset-tonal-error p-3 text-sm" role="alert">
                {attachError}
                {#if attachRetryable}
                  <button type="button" onclick={attachToProject} class="ml-2 underline text-error-500 text-sm">Retry</button>
                {/if}
              </aside>
            {/if}
            <button
              type="button"
              class="btn preset-filled-primary-500 w-full"
              onclick={attachToProject}
              disabled={attaching || selected.size === 0}
            >
              {attaching ? 'Adding…' : `Add ${selected.size > 0 ? selected.size : ''} vendor${selected.size !== 1 ? 's' : ''} to project`}
            </button>
          </div>

        {:else if context === 'contacts'}
          <!-- No bulk action in contacts — each card has its own Save button above -->

        {:else if context === 'new-project'}
          <div class="space-y-2 pt-2">
            <p class="text-sm text-surface-600-400 text-center">
              {selected.size > 0 ? `${selected.size} vendor${selected.size !== 1 ? 's' : ''} selected` : 'Select vendors to add when you create the project.'}
            </p>
            <button
              type="button"
              class="btn preset-filled-primary-500 w-full"
              onclick={() => { onAttached([...selected]); selected = new Set(); }}
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
