<script lang="ts">
import Sidebar from '#components/sidebar.svelte';
import { page } from '@inertiajs/svelte';
import { untrack } from 'svelte';

interface Contact {
  uuid: string;
  name: string;
  email: string;
}

const { contacts: initialContacts }: { contacts: Contact[] } = $props();

// Local reactive list
let contacts = $state<Contact[]>(untrack(() => [...initialContacts]));

// Add form state
let addName = $state('');
let addEmail = $state('');
let addSubmitting = $state(false);
let addErrors = $state<{ name?: string; email?: string }>({});

// Inline edit state: keyed by uuid
let editing = $state<Record<string, { name: string; email: string } | null>>({});
let saving = $state<Record<string, boolean>>({});
let editErrors = $state<Record<string, { name?: string; email?: string }>>({});

// Inertia shared errors (for add form redirect-back errors)
const pageErrors = $derived(($page.props.errors as Record<string, string[]>) ?? {});

async function submitAdd(e: Event) {
  e.preventDefault();
  addErrors = {};

  // Client-side validation
  if (!addName.trim()) {
    addErrors = { ...addErrors, name: 'Name is required.' };
  }
  if (!addEmail.trim()) {
    addErrors = { ...addErrors, email: 'Email is required.' };
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())) {
    addErrors = { ...addErrors, email: 'Must be a valid email address.' };
  }
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
    } else {
      if (data?.errors) addErrors = data.errors;
      else addErrors = { email: data?.error ?? 'Something went wrong. Please try again.' };
    }
  } catch {
    addErrors = { name: undefined, email: 'Something went wrong. Please try again.' };
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
  if (!draft.name.trim()) {
    editErrors[uuid] = { ...editErrors[uuid], name: 'Name is required.' };
  }
  if (!draft.email.trim()) {
    editErrors[uuid] = { ...editErrors[uuid], email: 'Email is required.' };
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    editErrors[uuid] = { ...editErrors[uuid], email: 'Must be a valid email address.' };
  }
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
  <div class="w-full max-w-2xl px-6 py-10 space-y-10">

    <h1 class="text-2xl font-semibold">Contacts</h1>

    <!-- Contact list -->
    <section>
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
              {#if draft}
                <!-- Inline edit mode -->
                <div class="space-y-2">
                  <div class="flex gap-2">
                    <div class="flex-1">
                      <input
                        class="input w-full text-sm"
                        type="text"
                        bind:value={draft.name}
                        placeholder="Name"
                        disabled={isSaving}
                      />
                      {#if errs.name}
                        <p class="text-error-500 text-xs mt-0.5">{errs.name}</p>
                      {/if}
                    </div>
                    <div class="flex-1">
                      <input
                        class="input w-full text-sm"
                        type="email"
                        bind:value={draft.email}
                        placeholder="Email"
                        disabled={isSaving}
                      />
                      {#if errs.email}
                        <p class="text-error-500 text-xs mt-0.5">{errs.email}</p>
                      {/if}
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="btn btn-sm preset-filled-primary-500"
                      onclick={() => saveEdit(contact.uuid)}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      class="btn btn-sm preset-tonal"
                      onclick={() => cancelEdit(contact.uuid)}
                      disabled={isSaving}
                    >
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
                  <div class="flex gap-2 shrink-0">
                    <button
                      class="btn btn-sm preset-tonal"
                      onclick={() => startEdit(contact)}
                    >
                      Edit
                    </button>
                    <button
                      class="btn btn-sm preset-tonal-error"
                      onclick={() => deactivate(contact.uuid)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Add contact form -->
    <section>
      <h2 class="text-base font-semibold mb-3">Add Contact</h2>
      <form onsubmit={submitAdd} novalidate class="space-y-3">
        {#if pageErrors.name || pageErrors.email}
          <p class="text-error-500 text-sm">
            {pageErrors.name?.[0] ?? pageErrors.email?.[0]}
          </p>
        {/if}
        <div class="flex gap-3">
          <div class="flex-1">
            <input
              class="input w-full text-sm"
              type="text"
              bind:value={addName}
              placeholder="Name"
              disabled={addSubmitting}
            />
            {#if addErrors.name}
              <p class="text-error-500 text-xs mt-0.5">{addErrors.name}</p>
            {/if}
          </div>
          <div class="flex-1">
            <input
              class="input w-full text-sm"
              type="email"
              bind:value={addEmail}
              placeholder="Email"
              disabled={addSubmitting}
            />
            {#if addErrors.email}
              <p class="text-error-500 text-xs mt-0.5">{addErrors.email}</p>
            {/if}
          </div>
        </div>
        <button
          class="btn btn-sm preset-filled-primary-500"
          type="submit"
          disabled={addSubmitting}
        >
          {addSubmitting ? 'Adding…' : 'Add Contact'}
        </button>
      </form>
    </section>

  </div>
</Sidebar>
