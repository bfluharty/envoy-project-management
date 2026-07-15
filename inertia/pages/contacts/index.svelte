<script lang="ts">
import Sidebar from '#components/sidebar.svelte';
import VendorSearch from '#components/vendor_search.svelte';
import { page, router } from '@inertiajs/svelte';
import { untrack } from 'svelte';
import { isValidEmail } from '../../utils/format';

interface Contact {
  uuid: string;
  name: string;
  email: string | null;
}

interface TrustedVendorMatch {
  vendorListingUuid: string;
  name: string;
  categories: string[];
  location: {
    locality?: string | null;
    region?: string | null;
    postcode?: string | null;
    formatted_address?: string | null;
  } | null;
  onboardedToEnvoy: boolean;
}

const { contacts: initialContacts }: { contacts: Contact[] } = $props();

// Local reactive list
let contacts = $state<Contact[]>(untrack(() => [...initialContacts]));

// Keep the local list in sync after partial Inertia reloads triggered by
// marketplace selections while preserving optimistic local edits otherwise.
$effect(() => {
  contacts = [...initialContacts];
});

// Page-level edit mode
let pageEditMode = $state(false);
let showAddForm = $state(false);
let showVendorSearch = $state(false);

// Add form state
let addName = $state('');
let addEmail = $state('');
let addSubmitting = $state(false);
let addErrors = $state<{ name?: string; email?: string }>({});
let trustedMatches = $state<TrustedVendorMatch[]>([]);
let trustedMatchError = $state('');
let selectingTrustedUuid = $state<string | null>(null);

// Inline edit state: keyed by uuid
let editing = $state<Record<string, { name: string; email: string } | null>>({});
let saving = $state<Record<string, boolean>>({});
let editErrors = $state<Record<string, { name?: string; email?: string }>>({});
let deleting = $state<Record<string, boolean>>({});
let deleteError = $state<string | null>(null);

// Confirmation guard for destructive remove action
let pendingRemove = $state<string | null>(null);

// Inertia shared errors (for add form redirect-back errors)
const pageErrors = $derived(($page.props.errors as Record<string, string[]>) ?? {});

function exitEditMode() {
  pageEditMode = false;
  showAddForm = false;
  addName = '';
  addEmail = '';
  addErrors = {};
  trustedMatches = [];
  trustedMatchError = '';
  pendingRemove = null;
  deleteError = null;
  // Cancel all open inline edits
  for (const uuid of Object.keys(editing)) {
    editing[uuid] = null;
    editErrors[uuid] = {};
  }
}

function clearTrustedMatches() {
  trustedMatches = [];
  trustedMatchError = '';
}

function formatTrustedLocation(match: TrustedVendorMatch) {
  if (!match.location) return '';
  return match.location.formatted_address
    || [match.location.locality, match.location.region, match.location.postcode]
      .filter(Boolean)
      .join(', ');
}

async function addContact(skipTrustedCheck: boolean) {
  addErrors = {};
  trustedMatchError = '';

  if (!addName.trim()) addErrors = { ...addErrors, name: 'Name is required.' };
  if (!addEmail.trim()) addErrors = { ...addErrors, email: 'Email is required.' };
  else if (!isValidEmail(addEmail)) addErrors = { ...addErrors, email: 'Must be a valid email address.' };
  if (addErrors.name || addErrors.email) return;

  addSubmitting = true;
  try {
    if (!skipTrustedCheck) {
      const params = new URLSearchParams({ name: addName.trim(), email: addEmail.trim() });
      const matchRes = await fetch(`/api/vendors/trusted-matches?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!matchRes.ok) {
        trustedMatchError = 'We could not check for an existing verified listing. Retry, or create a separate contact anyway.';
        return;
      }

      const matchData = await matchRes.json().catch(() => ({}));
      trustedMatches = (matchData.vendors ?? []).slice(0, 5);
      if (trustedMatches.length > 0) return;
    }

    const res = await fetch('/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ name: addName.trim(), email: addEmail.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      contacts = [...contacts, data.contact];
      addName = '';
      addEmail = '';
      trustedMatches = [];
      showAddForm = false;
    } else {
      if (data?.errors) addErrors = data.errors;
      else addErrors = { email: data?.error ?? 'Something went wrong. Please try again.' };
    }
  } catch {
    addErrors = { email: 'Something went wrong. Please try again.' };
  } finally {
    addSubmitting = false;
  }
}

async function submitAdd(e: Event) {
  e.preventDefault();
  await addContact(false);
}

async function useTrustedMatch(match: TrustedVendorMatch) {
  if (selectingTrustedUuid) return;
  selectingTrustedUuid = match.vendorListingUuid;
  trustedMatchError = '';

  try {
    const res = await fetch(`/api/vendors/${match.vendorListingUuid}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      trustedMatchError = data?.error ?? 'Could not save this listing. Please try again.';
      return;
    }

    const listing = data?.listing;
    const listingUuid = listing?.vendorListingUuid ?? match.vendorListingUuid;
    if (!contacts.some((contact) => contact.uuid === listingUuid)) {
      contacts = [
        ...contacts,
        { uuid: listingUuid, name: listing?.name ?? match.name, email: null },
      ];
    }
    addName = '';
    addEmail = '';
    trustedMatches = [];
    showAddForm = false;
    router.reload({ only: ['contacts'] });
  } catch {
    trustedMatchError = 'Could not save this listing. Please try again.';
  } finally {
    selectingTrustedUuid = null;
  }
}

function startEdit(contact: Contact) {
  editing[contact.uuid] = { name: contact.name, email: contact.email ?? '' };
  editErrors[contact.uuid] = {};
}

function cancelEdit(uuid: string) {
  editing[uuid] = null;
  editErrors[uuid] = {};
}

async function saveEdit(uuid: string) {
  const draft = editing[uuid];
  if (!draft) return;

  editErrors[uuid] = {};
  if (!draft.name.trim()) editErrors[uuid] = { ...editErrors[uuid], name: 'Name is required.' };
  if (!draft.email.trim()) editErrors[uuid] = { ...editErrors[uuid], email: 'Email is required.' };
  else if (!isValidEmail(draft.email)) editErrors[uuid] = { ...editErrors[uuid], email: 'Must be a valid email address.' };
  if (editErrors[uuid].name || editErrors[uuid].email) return;

  saving[uuid] = true;
  try {
    const res = await fetch(`/contacts/${uuid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ name: draft.name.trim(), email: draft.email.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      contacts = contacts.map((c) => (c.uuid === uuid ? data.contact : c));
      editing[uuid] = null;
    } else if (res.status === 404) {
      editErrors[uuid] = { name: 'Contact not found.' };
    } else {
      editErrors[uuid] = { email: 'Failed to save. Please try again.' };
    }
  } catch {
    editErrors[uuid] = { email: 'Something went wrong. Please try again.' };
  } finally {
    saving[uuid] = false;
  }
}

async function deactivate(uuid: string) {
  deleteError = null;
  deleting[uuid] = true;
  try {
    const res = await fetch(`/contacts/${uuid}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.ok) {
      contacts = contacts.filter((c) => c.uuid !== uuid);
      pendingRemove = null;
    } else {
      const data = await res.json().catch(() => ({}));
      deleteError = data?.error ?? 'Failed to remove contact. Please try again.';
    }
  } catch {
    deleteError = 'Failed to remove contact. Please try again.';
  } finally {
    deleting[uuid] = false;
  }
}
</script>

<svelte:head>
  <title>Contacts</title>
</svelte:head>

<Sidebar>
  <div class="w-full max-w-2xl px-6 py-10 space-y-6 mx-auto">

    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold">Contacts</h1>
      <div class="flex gap-2">
        <button
          class="btn btn-sm {showVendorSearch ? 'preset-filled-primary-500' : 'preset-tonal'}"
          onclick={() => { showVendorSearch = !showVendorSearch; }}
          aria-expanded={showVendorSearch}
        >
          🔍 Find additional contacts
        </button>
        {#if !pageEditMode}
          <button class="btn btn-sm preset-tonal" onclick={() => { pageEditMode = true; }}>
            Edit
          </button>
        {:else}
          <button class="btn btn-sm preset-tonal" onclick={exitEditMode}>
            Done
          </button>
        {/if}
      </div>
    </div>

    <!-- Vendor search panel -->
    {#if showVendorSearch}
      <div class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-4">
        <VendorSearch
          context="contacts"
          onClose={() => { showVendorSearch = false; }}
          onSavedToContacts={(_uuid) => router.reload({ only: ['contacts'] })}
        />
      </div>
    {/if}

    {#if pageEditMode}
      {#if deleteError}
        <p role="alert" class="text-error-500 text-sm">{deleteError}</p>
      {/if}

      <!-- New contact panel -->
      {#if showAddForm}
        <form onsubmit={submitAdd} novalidate class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-3 space-y-3">
          {#if pageErrors.name || pageErrors.email}
            <div class="space-y-1">
              {#if pageErrors.name}
                <p class="text-error-500 text-sm">{pageErrors.name[0]}</p>
              {/if}
              {#if pageErrors.email}
                <p class="text-error-500 text-sm">{pageErrors.email[0]}</p>
              {/if}
            </div>
          {/if}
          <label class="label" for="addName">
            <span class="text-sm">Name</span>
            <input id="addName" class="input w-full" type="text"
              bind:value={addName} oninput={clearTrustedMatches} disabled={addSubmitting} />
            {#if addErrors.name}
              <p class="text-error-500 text-sm">{addErrors.name}</p>
            {/if}
          </label>
          <label class="label" for="addEmail">
            <span class="text-sm">Email</span>
            <input id="addEmail" class="input w-full" type="email"
              bind:value={addEmail} oninput={clearTrustedMatches} disabled={addSubmitting} />
            {#if addErrors.email}
              <p class="text-error-500 text-sm">{addErrors.email}</p>
            {/if}
          </label>
          {#if trustedMatchError}
            <aside class="card preset-tonal-error p-3 text-sm" role="alert">
              <p>{trustedMatchError}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button class="btn btn-sm preset-tonal" type="button" onclick={() => addContact(false)} disabled={addSubmitting}>
                  Retry check
                </button>
                <button class="btn btn-sm preset-tonal" type="button" onclick={() => addContact(true)} disabled={addSubmitting}>
                  Create separate contact
                </button>
              </div>
            </aside>
          {/if}
          {#if trustedMatches.length > 0}
            <aside class="card preset-tonal-primary-500 p-3 space-y-3" aria-label="Existing trusted listings">
              <div>
                <p class="font-medium text-sm">A trusted listing may already exist</p>
                <p class="text-xs text-surface-600-400">Use an existing vendor-controlled listing, or create your own separate contact.</p>
              </div>
              <ul class="space-y-2">
                {#each trustedMatches as match (match.vendorListingUuid)}
                  <li class="rounded-lg border border-surface-200-800 p-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-medium text-sm">{match.name}</p>
                      {#if match.onboardedToEnvoy}
                        <p class="text-xs text-primary-500">Onboarded to Envoy</p>
                      {/if}
                      {#if formatTrustedLocation(match)}
                        <p class="text-xs text-surface-600-400">{formatTrustedLocation(match)}</p>
                      {/if}
                      {#if match.categories.length > 0}
                        <p class="text-xs text-surface-600-400">{match.categories.join(' · ')}</p>
                      {/if}
                    </div>
                    <button
                      class="btn btn-sm preset-filled-primary-500 shrink-0"
                      type="button"
                      onclick={() => useTrustedMatch(match)}
                      disabled={selectingTrustedUuid !== null}
                    >
                      {selectingTrustedUuid === match.vendorListingUuid ? 'Saving…' : 'Use listing'}
                    </button>
                  </li>
                {/each}
              </ul>
              <button class="btn btn-sm preset-tonal" type="button" onclick={() => addContact(true)} disabled={addSubmitting || selectingTrustedUuid !== null}>
                Create separate contact
              </button>
            </aside>
          {/if}
          <div class="flex gap-2">
            <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={addSubmitting}>
              {addSubmitting ? 'Adding…' : 'Add Contact'}
            </button>
            <button class="btn btn-sm preset-tonal" type="button"
              onclick={() => { showAddForm = false; addName = ''; addEmail = ''; addErrors = {}; clearTrustedMatches(); }}>
              Cancel
            </button>
          </div>
        </form>
      {:else}
        <button class="btn btn-sm preset-tonal" onclick={() => showAddForm = true}>
          + New contact
        </button>
      {/if}
    {/if}

    <!-- Contact list -->
    {#if contacts.length === 0}
      <p class="text-surface-600-400 text-sm italic">
        No contacts yet. Add your first contact to get started.
      </p>
    {:else}
      <ul class="divide-y divide-surface-200-800">
        {#each contacts as contact (contact.uuid)}
          {@const draft = editing[contact.uuid]}
          {@const isSaving = saving[contact.uuid] ?? false}
          {@const errs = editErrors[contact.uuid] ?? {}}
          <li class="py-3">
            {#if draft && pageEditMode}
              <!-- Inline edit mode -->
              <div class="space-y-3">
                <label class="label" for="edit-name-{contact.uuid}">
                  <span class="text-sm">Name</span>
                  <input id="edit-name-{contact.uuid}" class="input w-full" type="text"
                    bind:value={draft.name} disabled={isSaving} />
                  {#if errs.name}
                    <p class="text-error-500 text-sm">{errs.name}</p>
                  {/if}
                </label>
                <label class="label" for="edit-email-{contact.uuid}">
                  <span class="text-sm">Email</span>
                  <input id="edit-email-{contact.uuid}" class="input w-full" type="email"
                    bind:value={draft.email} disabled={isSaving} />
                  {#if errs.email}
                    <p class="text-error-500 text-sm">{errs.email}</p>
                  {/if}
                </label>
                <div class="flex gap-2">
                  <button class="btn btn-sm preset-filled-primary-500"
                    onclick={() => saveEdit(contact.uuid)} disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button class="btn btn-sm preset-tonal"
                    onclick={() => cancelEdit(contact.uuid)} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <!-- Read mode -->
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{contact.name}</p>
                  <p class="text-xs text-surface-600-400 truncate">
                    {contact.email || 'Contact details needed'}
                  </p>
                </div>
                {#if pageEditMode}
                  <div class="flex gap-2 shrink-0">
                    <button class="btn btn-sm preset-tonal" onclick={() => startEdit(contact)}>
                      Edit
                    </button>
                    {#if pendingRemove === contact.uuid}
                      <span class="flex items-center gap-1 text-sm">
                        <span class="text-error-500">Remove?</span>
                        <button class="btn btn-sm preset-tonal-error"
                          onclick={() => deactivate(contact.uuid)}
                          disabled={deleting[contact.uuid]}
                          aria-label="Confirm remove {contact.name}">Yes</button>
                        <button class="btn btn-sm preset-tonal"
                          disabled={deleting[contact.uuid]}
                          onclick={() => pendingRemove = null}>Cancel</button>
                      </span>
                    {:else}
                      <button class="btn btn-sm preset-tonal-error"
                        disabled={deleting[contact.uuid]}
                        onclick={() => pendingRemove = contact.uuid}
                        aria-label="Remove {contact.name}">Remove</button>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

  </div>
</Sidebar>
