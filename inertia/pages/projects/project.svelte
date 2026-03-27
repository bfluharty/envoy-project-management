<script lang="ts">
import Sidebar from "#components/sidebar.svelte";
import Logo from '#components/logo.svelte';
import { UserIcon } from '@lucide/svelte';
import { onMount, untrack } from 'svelte';
import { SegmentedControl } from "@skeletonlabs/skeleton-svelte";

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
    location: object | null;
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
let activeTab = $state<'convo' | 'outreach' | 'overview'>('convo');

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
    messages = messages.filter((m) => !m.isError);
    sendChat(retryPrompt, retryVariables);
}

// ── Overview state ─────────────────────────────────────────
let localProject = $state(untrack(() => ({ ...project })));
let localLinked = $state<Vendor[]>(untrack(() => [...linkedVendors]));
let localAllVendors = $state<Vendor[]>(untrack(() => [...allVendors]));
let editMode = $state(false);
let saving = $state(false);
let saveError = $state<string | null>(null);
let fieldErrors = $state<Record<string, string>>({});
let attachingVendor = $state(false);
let selectedVendorUuid = $state('');
let showNewContactForm = $state(false);
let newContactName = $state('');
let newContactEmail = $state('');
let newContactErrors = $state<{ name?: string; email?: string }>({});
let creatingContact = $state(false);

let unlinkedVendors = $derived(
    localAllVendors.filter((v) => !localLinked.some((l) => l.uuid === v.uuid))
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
            description: localProject.description || undefined,
            location: localProject.location || undefined,
            startDate: localProject.startDate || undefined,
            endDate: localProject.endDate || undefined,
            deadline: localProject.deadline || undefined,
            budgetAmount: localProject.budgetAmount ?? undefined,
            goals: localProject.goals || undefined,
        });
        if (res.ok) {
            const data = await res.json();
            localProject = { ...localProject, ...data.project };
            editMode = false;
        } else if (res.status >= 500) {
            saveError = 'Failed to save. Please try again.';
        } else {
            const data = await res.json();
            if (data.errors) fieldErrors = data.errors;
        }
    } catch {
        saveError = 'Failed to save. Please try again.';
    } finally {
        saving = false;
    }
}

async function attachVendor() {
    if (!selectedVendorUuid) return;
    attachingVendor = true;
    try {
        const newList = [...localLinked.map((v) => v.uuid), selectedVendorUuid];
        const res = await patchProject({ vendors: newList });
        if (res.ok) {
            const vendor = localAllVendors.find((v) => v.uuid === selectedVendorUuid)!;
            localLinked = [...localLinked, vendor];
            selectedVendorUuid = '';
        }
    } finally {
        attachingVendor = false;
    }
}

async function detachVendor(vendorUuid: string) {
    const newList = localLinked.filter((v) => v.uuid !== vendorUuid).map((v) => v.uuid);
    const res = await patchProject({ vendors: newList });
    if (res.ok) {
        localLinked = localLinked.filter((v) => v.uuid !== vendorUuid);
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
            showNewContactForm = false;
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
  <title>{project.name}</title>
</svelte:head>

<Sidebar>

<div class="flex flex-col w-full h-[calc(100vh-4rem)] lg:h-screen">

<!-- Tab bar -->
<div class="flex justify-end shrink-0 px-4 lg:px-6 py-2 bg-surface-50-950 border-b border-surface-200-800">
    <SegmentedControl
        value={activeTab}
        onValueChange={(details) => { if (details.value) activeTab = details.value as typeof activeTab }}>
        <SegmentedControl.Control>
            <SegmentedControl.Indicator />
            {#each (['convo', 'outreach', 'overview'] as const) as tab}
                <SegmentedControl.Item value={tab}>
                    <SegmentedControl.ItemText class="capitalize">{tab}</SegmentedControl.ItemText>
                    <SegmentedControl.ItemHiddenInput />
                </SegmentedControl.Item>
            {/each}
        </SegmentedControl.Control>
    </SegmentedControl>
</div>

<!-- Convo tab -->
{#if activeTab === 'convo'}
<div class="flex flex-col flex-1 overflow-hidden w-full bg-surface-50-950">
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#each messages as msg (msg.id)}
            <div class="flex items-start gap-2" class:justify-end={msg.role === 'user'}>
                {#if msg.role === 'assistant'}
                    <div class="avatar size-8 mt-1.5">
                        <Logo class="size-8" />
                    </div>
                {/if}
                <div class="card max-w-lg p-3 text-sm"
                    class:preset-filled-surface-100-900={msg.role === 'assistant'}
                    class:preset-filled-primary-500={msg.role === 'user'}>
                    {#if msg.isTyping}
                        <span class="inline-flex gap-1 items-center h-4">
                            <span class="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]"></span>
                            <span class="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]"></span>
                            <span class="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]"></span>
                        </span>
                    {:else if msg.isError}
                        <p>{msg.content}</p>
                        <button
                            class="btn btn-sm preset-filled-error-500 mt-2"
                            onclick={() => retryMessage(msg.retryPrompt!, msg.retryVariables ?? {})}>
                            Retry
                        </button>
                    {:else}
                        {msg.content}
                    {/if}
                </div>
                {#if msg.role === 'user'}
                    <div class="avatar size-8 mt-1.5 rounded-full bg-primary-500 flex items-center justify-center">
                        <UserIcon class="size-4 text-white" />
                    </div>
                {/if}
            </div>
        {/each}
    </div>
    <form class="p-4 flex gap-2 bg-surface-800" onsubmit={sendMessage}>
        <input
            class="input flex-1 outline-none"
            type="text"
            bind:value={input}
            placeholder="Type your message..."
            autocomplete="off"
            disabled={isLoading} />
        <button class="btn preset-filled-primary-500" type="submit" disabled={isLoading}>Send</button>
    </form>
</div>
{/if}

<!-- Outreach tab -->
{#if activeTab === 'outreach'}
<div class="flex-1 overflow-y-auto p-6 text-surface-500">Outreach coming soon.</div>
{/if}

<!-- Overview tab -->
{#if activeTab === 'overview'}
<div class="flex-1 overflow-y-auto p-6 max-w-2xl space-y-10">

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
                    <p class="text-error-500 text-sm">{saveError}</p>
                {/if}

                <div>
                    <label class="label text-sm" for="description">Description</label>
                    <textarea id="description" class="textarea w-full" rows="3"
                        bind:value={localProject.description}></textarea>
                    {#if fieldErrors.description}<p class="text-error-500 text-xs mt-1">{fieldErrors.description}</p>{/if}
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label text-sm" for="startDate">Start Date</label>
                        <input id="startDate" type="date" class="input w-full"
                            bind:value={localProject.startDate} />
                        {#if fieldErrors.startDate}<p class="text-error-500 text-xs mt-1">{fieldErrors.startDate}</p>{/if}
                    </div>
                    <div>
                        <label class="label text-sm" for="endDate">End Date</label>
                        <input id="endDate" type="date" class="input w-full"
                            bind:value={localProject.endDate} />
                        {#if fieldErrors.endDate}<p class="text-error-500 text-xs mt-1">{fieldErrors.endDate}</p>{/if}
                    </div>
                </div>

                <div>
                    <label class="label text-sm" for="deadline">Deadline</label>
                    <input id="deadline" type="date" class="input w-full"
                        bind:value={localProject.deadline} />
                    {#if fieldErrors.deadline}<p class="text-error-500 text-xs mt-1">{fieldErrors.deadline}</p>{/if}
                </div>

                <div>
                    <label class="label text-sm" for="budgetAmount">Budget</label>
                    <input id="budgetAmount" type="number" min="0" class="input w-full"
                        bind:value={localProject.budgetAmount} />
                    {#if fieldErrors.budgetAmount}<p class="text-error-500 text-xs mt-1">{fieldErrors.budgetAmount}</p>{/if}
                </div>

                <div>
                    <label class="label text-sm" for="goals">Goals</label>
                    <textarea id="goals" class="textarea w-full" rows="3"
                        bind:value={localProject.goals}></textarea>
                    {#if fieldErrors.goals}<p class="text-error-500 text-xs mt-1">{fieldErrors.goals}</p>{/if}
                </div>

                <div class="flex gap-2">
                    <button class="btn preset-filled-primary-500" type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button class="btn preset-tonal" type="button" onclick={() => { editMode = false; localProject = { ...project }; }}>
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
                    <!-- TODO: R-1 — location shape from Google Places API not yet documented -->
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Location</dt>
                        <dd class="font-mono text-xs">{JSON.stringify(localProject.location)}</dd>
                    </div>
                {/if}
                {#if localProject.startDate}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Start Date</dt>
                        <dd>{localProject.startDate}</dd>
                    </div>
                {/if}
                {#if localProject.endDate}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">End Date</dt>
                        <dd>{localProject.endDate}</dd>
                    </div>
                {/if}
                {#if localProject.deadline}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Deadline</dt>
                        <dd>{localProject.deadline}</dd>
                    </div>
                {/if}
                {#if localProject.budgetAmount !== null && localProject.budgetAmount !== 0}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Budget</dt>
                        <dd>{localProject.budgetAmount}</dd>
                    </div>
                {/if}
                {#if localProject.goals}
                    <div>
                        <dt class="text-surface-400 text-xs uppercase tracking-wide mb-0.5">Goals</dt>
                        <dd class="whitespace-pre-wrap">{localProject.goals}</dd>
                    </div>
                {/if}
                {#if !localProject.description && !localProject.startDate && !localProject.endDate && !localProject.deadline && !localProject.goals && (localProject.budgetAmount === null || localProject.budgetAmount === 0) && !localProject.location}
                    <p class="text-surface-400 italic">No details added yet.</p>
                {/if}
            </dl>
        {/if}
    </section>

    <!-- Contacts -->
    <section>
        <h2 class="text-lg font-semibold mb-4">Contacts</h2>

        {#if localLinked.length === 0}
            <p class="text-surface-400 text-sm italic">
                No contacts yet. Attach contacts here so Envoy can draft outreach emails for them.
            </p>
        {:else}
            <ul class="space-y-2 mb-4">
                {#each localLinked as vendor (vendor.uuid)}
                    <li class="flex items-center justify-between py-2 border-b border-surface-200-800">
                        <div>
                            <p class="text-sm font-medium">{vendor.name}</p>
                            <p class="text-xs text-surface-400">{vendor.email}</p>
                        </div>
                        <button class="btn btn-sm preset-tonal-error"
                            onclick={() => detachVendor(vendor.uuid)}>
                            Detach
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if unlinkedVendors.length > 0}
            <div class="flex gap-2 items-center mb-3">
                <select class="select flex-1" bind:value={selectedVendorUuid} disabled={attachingVendor}>
                    <option value="">Attach a contact…</option>
                    {#each unlinkedVendors as v (v.uuid)}
                        <option value={v.uuid}>{v.name} — {v.email}</option>
                    {/each}
                </select>
                <button class="btn btn-sm preset-filled-primary-500"
                    disabled={!selectedVendorUuid || attachingVendor}
                    onclick={attachVendor}>
                    {attachingVendor ? 'Attaching…' : 'Attach'}
                </button>
            </div>
        {/if}

        {#if showNewContactForm}
            <form onsubmit={createAndAttachContact} novalidate class="space-y-2 pt-1">
                <div class="flex gap-2">
                    <div class="flex-1">
                        <input class="input w-full text-sm" type="text" bind:value={newContactName}
                            placeholder="Name" disabled={creatingContact} />
                        {#if newContactErrors.name}
                            <p class="text-error-500 text-xs mt-0.5">{newContactErrors.name}</p>
                        {/if}
                    </div>
                    <div class="flex-1">
                        <input class="input w-full text-sm" type="email" bind:value={newContactEmail}
                            placeholder="Email" disabled={creatingContact} />
                        {#if newContactErrors.email}
                            <p class="text-error-500 text-xs mt-0.5">{newContactErrors.email}</p>
                        {/if}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={creatingContact}>
                        {creatingContact ? 'Adding…' : 'Add & Attach'}
                    </button>
                    <button class="btn btn-sm preset-tonal" type="button"
                        onclick={() => { showNewContactForm = false; newContactName = ''; newContactEmail = ''; newContactErrors = {}; }}>
                        Cancel
                    </button>
                </div>
            </form>
        {:else}
            <button class="btn btn-sm preset-tonal" onclick={() => showNewContactForm = true}>
                + New contact
            </button>
        {/if}
    </section>

</div>
{/if}

</div><!-- end outer flex column -->

</Sidebar>
