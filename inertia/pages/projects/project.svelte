<script lang="ts">
import Sidebar from "#components/sidebar.svelte";
import Logo from '#components/logo.svelte';
import LocationSearch from '#components/location_search.svelte';
import type { LocationData } from '#components/location_search.svelte';
import { UserIcon } from '@lucide/svelte';
import { onMount, untrack } from 'svelte';
import { formatDate, formatCurrency } from '../../utils/format';

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isTyping?: boolean;
    isError?: boolean;
    retryPrompt?: string;
    retryVariables?: Record<string, any>;
}

interface Vendor {
    uuid: string;
    name: string;
    email: string;
}

interface Project {
    uuid: string;
    name: string;
    description: string | null;
    location: LocationData | null;
    startDate: string | null;
    endDate: string | null;
    deadline: string | null;
    budgetAmount: number | null;
    goals: string | null;
}

const {
    project,
    hasPriorConversation,
    conversationHistory,
    linkedVendors,
    allVendors,
}: {
    project: Project;
    hasPriorConversation: boolean;
    conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    linkedVendors: Vendor[];
    allVendors: Vendor[];
} = $props();

// ── Tab state ──────────────────────────────────────────────
const TAB_KEY = `tab-${project.uuid}`;
const VALID_TABS = ['convo', 'outreach', 'overview'] as const;
const isReload = typeof performance !== 'undefined' &&
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';
const storedTab = isReload && typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(TAB_KEY) : null;
let activeTab = $state<'convo' | 'outreach' | 'overview'>(
    VALID_TABS.includes(storedTab as any) ? (storedTab as 'convo' | 'outreach' | 'overview') : 'convo'
);

// ── Chat state ─────────────────────────────────────────────
let idCounter = untrack(() => conversationHistory.length);
let messages = $state<ChatMessage[]>(
    untrack(() => conversationHistory.map((m, i) => ({ id: i, role: m.role, content: m.content })))
);
let input = $state('');
let isLoading = $state(false);

const OPENING_PROMPT =
    'A new project has been created. Ask the user for any missing information before starting to plan, one question at a time.';
const OPENING_VARIABLES = { context: 'PROJECT_SETUP' };

async function sendChat(prompt: string, variables: Record<string, any> = {}) {
    isLoading = true;
    const typingId = idCounter++;
    messages = [...messages, { id: typingId, role: 'assistant', content: '', isTyping: true }];

    try {
        const res = await fetch(`/projects/${project.uuid}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, variables }),
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const text = await res.text();
        messages = [
            ...messages.filter((m) => m.id !== typingId),
            { id: idCounter++, role: 'assistant', content: text },
        ];
    } catch {
        messages = [
            ...messages.filter((m) => m.id !== typingId),
            {
                id: idCounter++,
                role: 'assistant',
                content: 'Something went wrong. Please try again.',
                isError: true,
                retryPrompt: prompt,
                retryVariables: variables,
            },
        ];
    } finally {
        isLoading = false;
    }
}

function sendMessage(event: Event) {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    const prompt = input.trim();
    input = '';
    messages = [...messages, { id: idCounter++, role: 'user', content: prompt }];
    sendChat(prompt);
}

function retryMessage(retryPrompt: string, retryVariables: Record<string, any> = {}) {
    if (isLoading) return;
    messages = messages.filter((m) => !m.isError);
    sendChat(retryPrompt, retryVariables);
}

// ── Overview state ─────────────────────────────────────────
let localProject = $state(untrack(() => ({ ...project })));
let savedProject = $state(untrack(() => ({ ...project })));
let localLinked = $state<Vendor[]>(untrack(() => [...linkedVendors]));
let localAllVendors = $state<Vendor[]>(untrack(() => [...allVendors]));
let editMode = $state(false);
let saving = $state(false);
let saveError = $state<string | null>(null);
let fieldErrors = $state<Record<string, string>>({});
let vendorError = $state<string | null>(null);
let pendingDetach = $state<string | null>(null);
let isAttachingVendors = $state(false);
let selectedVendorUuids = $state(new Set<string>());
let contactSearchQuery = $state('');
let contactEditMode = $state(false);
let activeContactPanel = $state<'attach' | 'new' | null>(null);
let newContactName = $state('');
let newContactEmail = $state('');
let newContactErrors = $state<{ name?: string; email?: string }>({});
let creatingContact = $state(false);
let opSuccessMsg = $state('');

let unlinkedVendors = $derived(
    localAllVendors.filter((v) => !localLinked.some((l) => l.uuid === v.uuid))
);

let filteredUnlinked = $derived(
    contactSearchQuery.trim()
        ? unlinkedVendors.filter((v) =>
            v.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
            v.email.toLowerCase().includes(contactSearchQuery.toLowerCase()))
        : unlinkedVendors
);

let hasNoDetails = $derived(
    !editMode &&
    !localProject.description && !localProject.startDate && !localProject.endDate
    && !localProject.deadline && !localProject.goals
    && (localProject.budgetAmount === null || localProject.budgetAmount === 0)
    && !localProject.location
);

async function patchProject(body: Record<string, unknown>) {
    const res = await fetch(`/projects/${project.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(body),
    });
    return res;
}

async function saveDetails(event: Event) {
    event.preventDefault();
    saving = true;
    saveError = null;
    fieldErrors = {};
    try {
        const res = await patchProject({
            title: localProject.name,
            description: localProject.description ?? undefined,
            location: localProject.location ?? undefined,
            startDate: localProject.startDate || undefined,
            endDate: localProject.endDate || undefined,
            deadline: localProject.deadline || undefined,
            budgetAmount: localProject.budgetAmount ?? undefined,
            goals: localProject.goals ?? undefined,
        });
        if (res.ok) {
            const data = await res.json();
            localProject = { ...localProject, ...data.project };
            savedProject = { ...savedProject, ...data.project };
            editMode = false;
            opSuccessMsg = 'Project details saved.';
            setTimeout(() => { opSuccessMsg = ''; }, 3000);
        } else if (res.status >= 500) {
            saveError = 'Failed to save. Please try again.';
        } else {
            const data = await res.json();
            if (Array.isArray(data.errors)) {
                fieldErrors = Object.fromEntries(data.errors.map((e: { field: string; message: string }) => [e.field, e.message]));
            } else if (data.errors && typeof data.errors === 'object') {
                fieldErrors = data.errors;
            } else {
                saveError = data.error ?? 'Validation failed. Please check your input.';
            }
        }
    } catch {
        saveError = 'Failed to save. Please try again.';
    } finally {
        saving = false;
    }
}

function toggleVendorSelection(uuid: string) {
    const next = new Set(selectedVendorUuids);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    selectedVendorUuids = next;
}

async function attachSelectedVendors() {
    const uuids = [...selectedVendorUuids];
    if (uuids.length === 0) return;
    isAttachingVendors = true;
    vendorError = null;
    try {
        const newList = [...localLinked.map((v) => v.uuid), ...uuids];
        const res = await patchProject({ vendors: newList });
        if (res.ok) {
            const added = uuids.map((uuid) => localAllVendors.find((v) => v.uuid === uuid)!);
            localLinked = [...localLinked, ...added];
            selectedVendorUuids = new Set();
            contactSearchQuery = '';
            activeContactPanel = null;
            opSuccessMsg = `${uuids.length} contact${uuids.length > 1 ? 's' : ''} attached.`;
            setTimeout(() => { opSuccessMsg = ''; }, 3000);
        } else {
            vendorError = 'Failed to attach contacts. Please try again.';
        }
    } catch {
        vendorError = 'Failed to attach contacts. Please try again.';
    } finally {
        isAttachingVendors = false;
    }
}

async function detachVendor(vendorUuid: string) {
    vendorError = null;
    pendingDetach = null;
    try {
        const newList = localLinked.filter((v) => v.uuid !== vendorUuid).map((v) => v.uuid);
        const res = await patchProject({ vendors: newList });
        if (res.ok) {
            localLinked = localLinked.filter((v) => v.uuid !== vendorUuid);
            opSuccessMsg = 'Contact detached.';
            setTimeout(() => { opSuccessMsg = ''; }, 3000);
        } else {
            vendorError = 'Failed to detach contact. Please try again.';
        }
    } catch {
        vendorError = 'Failed to detach contact. Please try again.';
    }
}

async function createAndAttachContact(e: Event) {
    e.preventDefault();
    newContactErrors = {};
    if (!newContactName.trim()) newContactErrors.name = 'Name is required.';
    if (!newContactEmail.trim()) newContactErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContactEmail.trim())) newContactErrors.email = 'Must be a valid email address.';
    if (newContactErrors.name || newContactErrors.email) return;

    creatingContact = true;
    try {
        const createRes = await fetch('/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ name: newContactName.trim(), email: newContactEmail.trim() }),
        });
        if (!createRes.ok) {
            const data = await createRes.json().catch(() => ({}));
            newContactErrors = data?.errors ?? { email: 'Failed to create contact.' };
            return;
        }
        const { contact } = await createRes.json();
        const newList = [...localLinked.map((v) => v.uuid), contact.uuid];
        const patchRes = await patchProject({ vendors: newList });
        if (patchRes.ok) {
            localLinked = [...localLinked, contact];
            localAllVendors = [...localAllVendors, contact];
            newContactName = '';
            newContactEmail = '';
            activeContactPanel = null;
            opSuccessMsg = 'Contact created and attached.';
            setTimeout(() => { opSuccessMsg = ''; }, 3000);
        } else {
            // Contact was created but linking failed — surface it in the dropdown
            localAllVendors = [...localAllVendors, contact];
            contactSearchQuery = contact.name;
            activeContactPanel = 'attach';
            vendorError = 'Contact created but could not be attached. Select them from the dropdown and click Attach.';
        }
    } finally {
        creatingContact = false;
    }
}

onMount(() => {
    if (!hasPriorConversation) {
        sendChat(OPENING_PROMPT, OPENING_VARIABLES);
    }
});
</script>

<svelte:head>
  <title>{project.name} — Envoy</title>
</svelte:head>

<Sidebar>

<div class="flex flex-col w-full h-[calc(100dvh-4.5rem)] lg:h-dvh">

<h1 class="sr-only">{project.name}</h1>

<!-- Screen reader live region for operation feedback -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">{opSuccessMsg}</div>

<!-- Tab bar -->
<div class="flex justify-center lg:justify-end shrink-0 px-4 lg:px-6 py-3 lg:py-2 bg-surface-50-950/50 backdrop-blur-md border-b border-surface-200-800">
    <div role="radiogroup" aria-label="Page section" class="flex gap-1">
        {#each (['convo', 'outreach', 'overview'] as const) as tab}
            <button
                role="radio"
                aria-checked={activeTab === tab}
                class="btn btn-sm capitalize {activeTab === tab ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
                onclick={() => {
                    if (editMode && tab !== 'overview') {
                        if (!confirm('You have unsaved changes. Leave this tab anyway?')) return;
                        editMode = false;
                        localProject = { ...savedProject };
                    }
                    activeTab = tab;
                    sessionStorage.setItem(TAB_KEY, tab);
                }}>
                {tab}
            </button>
        {/each}
    </div>
</div>

<!-- Convo tab -->
{#if activeTab === 'convo'}
<div class="flex flex-col flex-1 overflow-hidden w-full">
    <div class="flex-1 overflow-y-auto p-4 space-y-4"
         aria-live="polite" aria-atomic="false" aria-label="Conversation">
        {#each messages as msg (msg.id)}
            <div class="flex items-start gap-2" class:justify-end={msg.role === 'user'}>
                {#if msg.role === 'assistant'}
                    <div class="avatar size-8 mt-1.5" aria-hidden="true">
                        <Logo class="size-8" />
                    </div>
                {/if}
                <div class="card max-w-lg p-3 text-sm"
                    class:preset-filled-surface-100-900={msg.role === 'assistant'}
                    class:preset-filled-primary-500={msg.role === 'user'}>
                    {#if msg.isTyping}
                        <span class="inline-flex gap-1 items-center h-4" role="status" aria-label="Assistant is typing">
                            <span class="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:0ms]" aria-hidden="true"></span>
                            <span class="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:150ms]" aria-hidden="true"></span>
                            <span class="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:300ms]" aria-hidden="true"></span>
                        </span>
                    {:else if msg.isError}
                        <div role="alert">
                            <p>{msg.content}</p>
                            <button
                                class="btn btn-sm preset-filled-error-500 mt-2"
                                onclick={() => retryMessage(msg.retryPrompt!, msg.retryVariables ?? {})}>
                                Retry
                            </button>
                        </div>
                    {:else}
                        {msg.content}
                    {/if}
                </div>
                {#if msg.role === 'user'}
                    <div class="avatar size-8 mt-1.5 preset-filled-primary-500" aria-hidden="true">
                        <UserIcon class="size-4" />
                    </div>
                {/if}
            </div>
        {/each}
    </div>
    <form class="p-4 flex gap-2 bg-surface-50-950/50 backdrop-blur-md border-t border-surface-200-800" onsubmit={sendMessage}>
        <input
            class="input flex-1"
            type="text"
            bind:value={input}
            placeholder="Type your message..."
            autocomplete="off"
            disabled={isLoading} />
        <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send'}
        </button>
    </form>
</div>
{/if}

<!-- Outreach tab -->
{#if activeTab === 'outreach'}
<div class="flex-1 overflow-y-auto p-6">
    <h2 class="text-lg font-semibold mb-4">Outreach</h2>
    <p class="text-surface-400 text-sm italic">Outreach coming soon.</p>
</div>
{/if}

<!-- Overview tab -->
{#if activeTab === 'overview'}
<div class="flex-1 overflow-y-auto @container">
<div class="p-6 w-full max-w-5xl mx-auto">
<div class="grid grid-cols-1 @lg:grid-cols-2 gap-8 items-start">

    <!-- Project Details -->
    <section>
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Project Details</h2>
            {#if !editMode}
                <button class="btn btn-sm preset-tonal" onclick={() => { editMode = true; saveError = null; fieldErrors = {}; }}>
                    Edit
                </button>
            {/if}
        </div>

        {#if editMode}
            <form onsubmit={saveDetails} class="space-y-4">
                {#if saveError}
                    <p role="alert" class="text-error-500 text-sm">{saveError}</p>
                {/if}

                <div>
                    <label class="label" for="projectName">
                        <span class="text-sm">Project Name <span class="text-error-500">*</span></span>
                        <input id="projectName" type="text" class="input w-full"
                            bind:value={localProject.name}
                            aria-describedby={fieldErrors.title ? 'err-title' : undefined}
                            required />
                    </label>
                    {#if fieldErrors.title}<p id="err-title" class="text-error-500 text-sm">{fieldErrors.title}</p>{/if}
                </div>

                <div>
                    <label class="label" for="description">
                        <span class="text-sm">Description</span>
                        <textarea id="description" class="textarea w-full" rows="3"
                            bind:value={localProject.description}
                            aria-describedby={fieldErrors.description ? 'err-description' : undefined}></textarea>
                    </label>
                    {#if fieldErrors.description}<p id="err-description" class="text-error-500 text-sm">{fieldErrors.description}</p>{/if}
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="label" for="startDate">
                            <span class="text-sm">Start Date</span>
                            <input id="startDate" type="date" class="input w-full"
                                bind:value={localProject.startDate}
                                aria-describedby={fieldErrors.startDate ? 'err-startDate' : undefined} />
                        </label>
                        {#if fieldErrors.startDate}<p id="err-startDate" class="text-error-500 text-sm">{fieldErrors.startDate}</p>{/if}
                    </div>
                    <div>
                        <label class="label" for="endDate">
                            <span class="text-sm">End Date</span>
                            <input id="endDate" type="date" class="input w-full"
                                bind:value={localProject.endDate}
                                aria-describedby={fieldErrors.endDate ? 'err-endDate' : undefined} />
                        </label>
                        {#if fieldErrors.endDate}<p id="err-endDate" class="text-error-500 text-sm">{fieldErrors.endDate}</p>{/if}
                    </div>
                </div>

                <div>
                    <label class="label" for="deadline">
                        <span class="text-sm">Deadline</span>
                        <input id="deadline" type="date" class="input w-full"
                            bind:value={localProject.deadline}
                            aria-describedby={fieldErrors.deadline ? 'err-deadline' : undefined} />
                    </label>
                    {#if fieldErrors.deadline}<p id="err-deadline" class="text-error-500 text-sm">{fieldErrors.deadline}</p>{/if}
                </div>

                <div>
                    <label class="label" for="location-search"><span class="text-sm">Location</span></label>
                    <LocationSearch
                        id="location-search"
                        value={localProject.location}
                        onchange={(loc) => { localProject = { ...localProject, location: loc }; }} />
                    {#if fieldErrors.location}<p class="text-error-500 text-sm">{fieldErrors.location}</p>{/if}
                </div>

                <div>
                    <label class="label" for="budgetAmount">
                        <span class="text-sm">Budget</span>
                        <input id="budgetAmount" type="number" min="0" class="input w-full"
                            bind:value={localProject.budgetAmount}
                            aria-describedby={fieldErrors.budgetAmount ? 'err-budgetAmount' : undefined} />
                    </label>
                    {#if fieldErrors.budgetAmount}<p id="err-budgetAmount" class="text-error-500 text-sm">{fieldErrors.budgetAmount}</p>{/if}
                </div>

                <div>
                    <label class="label" for="goals">
                        <span class="text-sm">Goals</span>
                        <textarea id="goals" class="textarea w-full" rows="3"
                            bind:value={localProject.goals}
                            aria-describedby={fieldErrors.goals ? 'err-goals' : undefined}></textarea>
                    </label>
                    {#if fieldErrors.goals}<p id="err-goals" class="text-error-500 text-sm">{fieldErrors.goals}</p>{/if}
                </div>

                <div class="flex gap-2">
                    <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button class="btn btn-sm preset-tonal" type="button" onclick={() => { editMode = false; localProject = { ...savedProject }; }}>
                        Cancel
                    </button>
                </div>
            </form>
        {:else}
            <dl class="space-y-3 text-sm">
                {#if localProject.description}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Description</dt>
                        <dd>{localProject.description}</dd>
                    </div>
                {/if}
                {#if localProject.location}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Location</dt>
                        <dd>{localProject.location.formatted_address || localProject.location.city}</dd>
                    </div>
                {/if}
                {#if localProject.startDate}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Start Date</dt>
                        <dd>{formatDate(localProject.startDate)}</dd>
                    </div>
                {/if}
                {#if localProject.endDate}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">End Date</dt>
                        <dd>{formatDate(localProject.endDate)}</dd>
                    </div>
                {/if}
                {#if localProject.deadline}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Deadline</dt>
                        <dd>{formatDate(localProject.deadline)}</dd>
                    </div>
                {/if}
                {#if localProject.budgetAmount !== null && localProject.budgetAmount !== 0}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Budget</dt>
                        <dd>{formatCurrency(localProject.budgetAmount)}</dd>
                    </div>
                {/if}
                {#if localProject.goals}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Goals</dt>
                        <dd class="whitespace-pre-wrap">{localProject.goals}</dd>
                    </div>
                {/if}
                {#if hasNoDetails}
                    <p class="text-surface-400 text-sm italic">No details added yet.</p>
                {/if}
            </dl>
        {/if}
    </section>

    <!-- Contacts -->
    <section>
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Contacts</h2>
            {#if !contactEditMode}
                <button class="btn btn-sm preset-tonal" onclick={() => { contactEditMode = true; vendorError = null; }}>
                    Edit
                </button>
            {:else}
                <button class="btn btn-sm preset-tonal" onclick={() => { contactEditMode = false; activeContactPanel = null; contactSearchQuery = ''; selectedVendorUuids = new Set(); newContactName = ''; newContactEmail = ''; newContactErrors = {}; pendingDetach = null; vendorError = null; }}>
                    Done
                </button>
            {/if}
        </div>

        {#if vendorError}
            <p role="alert" class="text-error-500 text-sm mb-2">{vendorError}</p>
        {/if}

        {#if contactEditMode}
            <!-- Action buttons -->
            <div class="flex gap-2 mb-3" role="group" aria-label="Add contact options">
                <button
                    class="btn btn-sm {activeContactPanel === 'attach' ? 'preset-filled-primary-500' : 'preset-tonal'}"
                    aria-expanded={activeContactPanel === 'attach'}
                    aria-controls="panel-attach-contact"
                    disabled={unlinkedVendors.length === 0}
                    onclick={() => { activeContactPanel = activeContactPanel === 'attach' ? null : 'attach'; newContactName = ''; newContactEmail = ''; newContactErrors = {}; }}>
                    + Attach existing
                </button>
                <button
                    class="btn btn-sm {activeContactPanel === 'new' ? 'preset-filled-primary-500' : 'preset-tonal'}"
                    aria-expanded={activeContactPanel === 'new'}
                    aria-controls="panel-new-contact"
                    onclick={() => { activeContactPanel = activeContactPanel === 'new' ? null : 'new'; contactSearchQuery = ''; selectedVendorUuids = new Set(); }}>
                    + New contact
                </button>
            </div>

            <!-- Attach existing panel -->
            {#if activeContactPanel === 'attach'}
                <div id="panel-attach-contact" class="card preset-outlined-surface-200-800 p-3 mb-4 space-y-3">
                    <label class="label" for="contactSearch">
                        <span class="text-sm">Search contacts</span>
                        <input id="contactSearch" type="search" class="input w-full"
                            placeholder="Name or email…"
                            bind:value={contactSearchQuery}
                            disabled={isAttachingVendors} />
                    </label>
                    {#if filteredUnlinked.length > 0}
                        <ul class="divide-y divide-surface-200-800 max-h-48 overflow-auto rounded"
                            role="group" aria-label="Contacts to attach">
                            {#each filteredUnlinked as v (v.uuid)}
                                <li>
                                    <label class="flex items-center gap-3 px-3 min-h-[44px] cursor-pointer hover:bg-surface-200-800 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                                        <input type="checkbox"
                                            class="checkbox"
                                            checked={selectedVendorUuids.has(v.uuid)}
                                            onchange={() => toggleVendorSelection(v.uuid)}
                                            disabled={isAttachingVendors}
                                            aria-label="{v.name}, {v.email}" />
                                        <span class="flex-1 text-sm">
                                            <span class="font-medium">{v.name}</span>
                                            <span class="text-surface-400 ml-2 text-xs">{v.email}</span>
                                        </span>
                                    </label>
                                </li>
                            {/each}
                        </ul>
                    {:else if contactSearchQuery.trim()}
                        <p class="text-surface-400 text-sm italic">No contacts match "{contactSearchQuery}"</p>
                    {/if}
                    <div class="flex gap-2 items-center">
                        <button class="btn btn-sm preset-filled-primary-500"
                            disabled={selectedVendorUuids.size === 0 || isAttachingVendors}
                            onclick={attachSelectedVendors}>
                            {isAttachingVendors ? 'Attaching…' : selectedVendorUuids.size > 0 ? `Attach (${selectedVendorUuids.size})` : 'Attach'}
                        </button>
                        <button class="btn btn-sm preset-tonal" type="button"
                            onclick={() => { activeContactPanel = null; contactSearchQuery = ''; selectedVendorUuids = new Set(); }}>
                            Cancel
                        </button>
                    </div>
                </div>
            {/if}

            <!-- New contact panel -->
            {#if activeContactPanel === 'new'}
                <form id="panel-new-contact" onsubmit={createAndAttachContact} novalidate class="card preset-outlined-surface-200-800 p-3 mb-4 space-y-3">
                    <label class="label" for="newContactName">
                        <span class="text-sm">Name</span>
                        <input id="newContactName" class="input w-full" type="text" bind:value={newContactName}
                            disabled={creatingContact} />
                        {#if newContactErrors.name}
                            <p class="text-error-500 text-sm">{newContactErrors.name}</p>
                        {/if}
                    </label>
                    <label class="label" for="newContactEmail">
                        <span class="text-sm">Email</span>
                        <input id="newContactEmail" class="input w-full" type="email" bind:value={newContactEmail}
                            disabled={creatingContact} />
                        {#if newContactErrors.email}
                            <p class="text-error-500 text-sm">{newContactErrors.email}</p>
                        {/if}
                    </label>
                    <div class="flex gap-2">
                        <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={creatingContact}>
                            {creatingContact ? 'Adding…' : 'Add & Attach'}
                        </button>
                        <button class="btn btn-sm preset-tonal" type="button"
                            onclick={() => { activeContactPanel = null; newContactName = ''; newContactEmail = ''; newContactErrors = {}; }}>
                            Cancel
                        </button>
                    </div>
                </form>
            {/if}
        {/if}

        <!-- Contact list -->
        {#if localLinked.length === 0}
            <p class="text-surface-400 text-sm italic">
                No contacts yet. Attach contacts here so Envoy can draft outreach emails for them.
            </p>
        {:else}
            <ul class="divide-y divide-surface-200-800">
                {#each localLinked as vendor (vendor.uuid)}
                    <li class="flex items-center justify-between py-2">
                        <div>
                            <p class="text-sm font-medium">{vendor.name}</p>
                            <p class="text-xs text-surface-400">{vendor.email}</p>
                        </div>
                        {#if contactEditMode}
                            {#if pendingDetach === vendor.uuid}
                                <span class="flex gap-1 items-center text-xs">
                                    <span class="text-surface-400">Remove?</span>
                                    <button class="btn btn-sm preset-filled-error-500"
                                        onclick={() => detachVendor(vendor.uuid)}>Yes</button>
                                    <button class="btn btn-sm preset-tonal"
                                        onclick={() => pendingDetach = null}>Cancel</button>
                                </span>
                            {:else}
                                <button class="btn btn-sm preset-tonal-error"
                                    aria-label="Detach {vendor.name}"
                                    onclick={() => pendingDetach = vendor.uuid}>
                                    Detach
                                </button>
                            {/if}
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </section>

</div>
</div>
</div>
{/if}

</div><!-- end outer flex column -->

</Sidebar>
