<script lang="ts">
import Sidebar from '#components/sidebar.svelte';
import { page } from '@inertiajs/svelte';
import { untrack } from 'svelte';
import { isValidEmail } from '../../utils/format';

interface Contact {
  uuid: string;
  name: string;
  email: string;
}

const { contacts: initialContacts }: { contacts: Contact[] } = $props();

// Local reactive list
let contacts = $state<Contact[]>(untrack(() => [...initialContacts]));

// Page-level edit mode
let pageEditMode = $state(false);
let showAddForm = $state(false);

// Add form state
let addName = $state('');
let addEmail = $state('');
let addSubmitting = $state(false);
let addErrors = $state<{ name?: string; email?: string }>({});

// Inline edit state: keyed by uuid
let editing = $state<Record<string, { name: string; email: string } | null>>({});
let saving = $state<Record<string, boolean>>({});
let editErrors = $state<Record<string, { name?: string; email?: string }>>({});

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
  pendingRemove = null;
  // Cancel all open inline edits
  for (const uuid of Object.keys(editing)) {
    editing[uuid] = null;
    editErrors[uuid] = {};
  }
}

async function submitAdd(e: Event) {
  e.preventDefault();
  addErrors = {};

  if (!addName.trim()) addErrors = { ...addErrors, name: 'Name is required.' };
  if (!addEmail.trim()) addErrors = { ...addErrors, email: 'Email is required.' };
  else if (!isValidEmail(addEmail)) addErrors = { ...addErrors, email: 'Must be a valid email address.' };
  if (addErrors.name || addErrors.email) return;

  addSubmitting = true;
  try {
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

function startEdit(contact: Contact) {
  editing[contact.uuid] = { name: contact.name, email: contact.email };
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
  try {
    const res = await fetch(`/contacts/${uuid}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.ok) {
      contacts = contacts.filter((c) => c.uuid !== uuid);
      pendingRemove = null;
    }
  } catch {
    // silently ignore
  }
}
</script>

<svelte:head>
  <title>Contacts</title>
</svelte:head>

<Sidebar>
  <div class="w-full max-w-2xl px-6 py-10 space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Contacts</h1>
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

    {#if pageEditMode}
      <!-- New contact panel -->
      {#if showAddForm}
        <form onsubmit={submitAdd} novalidate class="card preset-outlined-surface-200-800 p-3 space-y-3">
          {#if pageErrors.name || pageErrors.email}
            <p class="text-error-500 text-sm">{pageErrors.name?.[0] ?? pageErrors.email?.[0]}</p>
          {/if}
          <label class="label" for="addName">
            <span class="text-sm">Name</span>
            <input id="addName" class="input w-full" type="text"
              bind:value={addName} disabled={addSubmitting} />
            {#if addErrors.name}
              <p class="text-error-500 text-sm">{addErrors.name}</p>
            {/if}
          </label>
          <label class="label" for="addEmail">
            <span class="text-sm">Email</span>
            <input id="addEmail" class="input w-full" type="email"
              bind:value={addEmail} disabled={addSubmitting} />
            {#if addErrors.email}
              <p class="text-error-500 text-sm">{addErrors.email}</p>
            {/if}
          </label>
          <div class="flex gap-2">
            <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={addSubmitting}>
              {addSubmitting ? 'Adding…' : 'Add Contact'}
            </button>
            <button class="btn btn-sm preset-tonal" type="button"
              onclick={() => { showAddForm = false; addName = ''; addEmail = ''; addErrors = {}; }}>
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
      <p class="text-surface-400 text-sm italic">
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
                  <p class="text-xs text-surface-400 truncate">{contact.email}</p>
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
                          aria-label="Confirm remove {contact.name}">Yes</button>
                        <button class="btn btn-sm preset-tonal"
                          onclick={() => pendingRemove = null}>Cancel</button>
                      </span>
                    {:else}
                      <button class="btn btn-sm preset-tonal-error"
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
