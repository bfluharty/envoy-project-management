<script lang="ts">
import Sidebar from "#components/sidebar.svelte";
import ProjectOutreachPanel from '#components/project_outreach_panel.svelte';
import ProjectSectionChrome from '#components/project_section_chrome.svelte';
import Logo from '#components/logo.svelte';
import UserAvatar, { type AvatarData } from '#components/user_avatar.svelte';
import LocationSearch from '#components/location_search.svelte';
import type { LocationData } from '#components/location_search.svelte';
import VendorSearch from '#components/vendor_search.svelte';
import { page } from '@inertiajs/svelte';
import { RefreshCwIcon } from '@lucide/svelte';
import { onDestroy, onMount, untrack } from 'svelte';
import { formatDate, formatCurrency } from '../../utils/format';
import { router } from '@inertiajs/svelte'
import { Trash2Icon } from '@lucide/svelte'

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isTyping?: boolean;
    isError?: boolean;
    retryPrompt?: string;
}

interface Vendor {
    uuid: string;
    vendorUuid?: string | null;
    vendorListingUuid?: string | null;
    name: string;
    email: string;
    vendorListingUuid?: string | null;
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
    budgetCurrency: string | null;
    goals: string | null;
}

interface OutreachMessage {
    uuid: string;
    direction: 'inbound' | 'outbound';
    subject: string;
    from: string;
    to: string;
    body: string;
    sentAt: string;
    messageId?: string;
    references?: string;
    threadId?: string;
}

interface OutreachCard {
    threadUuid: string;
    projectVendorUuid: string;
    draftUuid: string | null;
    vendor: Vendor;
    status: string;
    subject: string;
    body: string;
    sentAt: string | null;
    lastActivityAt: string | null;
    needsAttention: boolean;
    lastError: string | null;
    replyReceived: boolean;
    thread: {
        uuid: string;
        messages: OutreachMessage[];
    };
}

interface OutreachStateResponse {
    cards?: OutreachCard[];
    senderMode?: 'connected_inbox' | 'unavailable';
    createdThreadUuid?: string;
    revisedReplyBody?: string;
    revisedThreadUuid?: string;
    syncQueued?: boolean;
}

interface SharedUser {
    fullName?: string | null;
    email?: string;
    avatar?: AvatarData;
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
const getTabKey = () => `tab-${project.uuid}`;
const VALID_TABS = ['convo', 'outreach', 'overview'] as const;
type ProjectTab = typeof VALID_TABS[number];
const isReload = typeof performance !== 'undefined' &&
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';
const storedTab = isReload && typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(getTabKey()) : null;
let activeTab = $state<ProjectTab>(
    VALID_TABS.includes(storedTab as any) ? (storedTab as ProjectTab) : 'convo'
);

function handleTabChange(tab: ProjectTab) {
    if (editMode && tab !== 'overview') {
        if (!confirm('You have unsaved changes. Leave this tab anyway?')) return;
        editMode = false;
        localProject = { ...savedProject };
    }

    activeTab = tab;
    sessionStorage.setItem(getTabKey(), tab);
}

// ── Chat state ─────────────────────────────────────────────
let idCounter = untrack(() => conversationHistory.length);
let messages = $state<ChatMessage[]>(
    untrack(() => conversationHistory.map((m, i) => ({ id: i, role: m.role, content: m.content })))
);
let input = $state('');
let inputEl = $state<HTMLTextAreaElement | null>(null);
const MAX_INPUT_HEIGHT = 200;
let isLoading = $state(false);

$effect(() => {
    input;
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, MAX_INPUT_HEIGHT) + 'px';
});

function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
    }
}
let initialGreeting = $state<string | null>(null);
let greetingLoading = $state(false);

onMount(async () => {
    if (!hasPriorConversation) {
        const cacheKey = `greeting-${project.uuid}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            initialGreeting = cached;
            messages = [{ id: idCounter++, role: 'assistant', content: cached }, ...messages];
            return;
        }
        greetingLoading = true;
        try {
            const res = await fetch(`/projects/${project.uuid}/greeting`);
            if (res.ok) {
                initialGreeting = await res.text();
                sessionStorage.setItem(cacheKey, initialGreeting);
                messages = [{ id: idCounter++, role: 'assistant', content: initialGreeting }, ...messages];
            }
        } finally {
            greetingLoading = false;
        }
    }
});


async function sendChat(prompt: string) {
    isLoading = true;
    const typingId = idCounter++;
    messages = [...messages, { id: typingId, role: 'assistant', content: '', isTyping: true }];

    try {
        const res = await fetch(`/projects/${project.uuid}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
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

function retryMessage(retryPrompt: string) {
    if (isLoading) return;
    messages = messages.filter((m) => !m.isError);
    sendChat(retryPrompt);
}

// Outreach state
let outreachCards = $state<OutreachCard[]>([]);
let outreachLoaded = $state(false);
let outreachLoading = $state(false);
let outreachSyncing = $state(false);
let outreachInitialLoadAttempted = $state(false);
let outreachError = $state<string | null>(null);
let outreachSenderMode = $state<'connected_inbox' | 'unavailable'>('unavailable');
let sendingDraftUuid = $state<string | null>(null);
let retryingDraftUuid = $state<string | null>(null);
let creatingDraftProjectVendorUuid = $state<string | null>(null);
let revisingDraftUuid = $state<string | null>(null);
let reviseDraftUuid = $state<string | null>(null);
let reviseInstructions = $state('');
let selectedOutreachThreadUuid = $state<string | null>(null);
let composeThreadUuid = $state<string | null>(null);
let outreachPane = $state<'read' | 'create'>('read');
let newThreadVendorUuid = $state('');
let replyThreadUuid = $state<string | null>(null);
let replySubject = $state('');
let replyBody = $state('');
let replyInReplyTo = $state<string | undefined>(undefined);
let replyReferences = $state<string | undefined>(undefined);
let replyThreadId = $state<string | undefined>(undefined);
let sendingReply = $state(false);
let revisingReplyThreadUuid = $state<string | null>(null);
let showReplyReviseComposer = $state(false);
let replyReviseInstructions = $state('');
let replyRevisionOriginalBody = $state('');
let replyRevisionSuggestedBody = $state('');
let currentUser = $derived(($page.props.user as SharedUser | undefined) ?? undefined);
let currentUserName = $derived(currentUser?.fullName ?? 'You');
let currentUserAvatar = $derived(
    currentUser?.avatar ?? {
        url: null,
        source: 'generated' as const,
        initials: 'Y',
        displayName: currentUserName,
    }
);

let selectedOutreachCard = $derived(
    selectedOutreachThreadUuid
        ? outreachCards.find((card) => card.threadUuid === selectedOutreachThreadUuid) ?? null
        : outreachPane === 'create'
            ? null
            : outreachCards[0] ?? null
);

let composeOutreachCard = $derived(
    composeThreadUuid
        ? outreachCards.find((card) => card.threadUuid === composeThreadUuid) ?? null
        : null
);

function getDefaultOutreachPane(card: OutreachCard | null) {
    if (!card) return 'read';
    return card.status === 'draft' || card.status === 'error' || card.status === 'empty' ? 'create' : 'read';
}

function selectOutreachCard(card: OutreachCard) {
    selectedOutreachThreadUuid = card.threadUuid;
    composeThreadUuid = card.threadUuid;
    outreachPane = getDefaultOutreachPane(card);
    reviseDraftUuid = null;
    reviseInstructions = '';
    showReplyReviseComposer = false;
    replyReviseInstructions = '';
    replyRevisionOriginalBody = '';
    replyRevisionSuggestedBody = '';
    closeReplyComposer();
}

function applyOutreachState(data: OutreachStateResponse) {
    outreachCards = data.cards ?? [];
    outreachSenderMode = data.senderMode ?? 'unavailable';
    outreachLoaded = true;


    const selectedCardStillExists = selectedOutreachThreadUuid
        ? outreachCards.some((card) => card.threadUuid === selectedOutreachThreadUuid)
        : false;

    if (!selectedCardStillExists && outreachPane !== 'create') {
        const nextCard = outreachCards[0] ?? null;
        selectedOutreachThreadUuid = nextCard?.threadUuid ?? null;
        outreachPane = getDefaultOutreachPane(nextCard);
    }

    if (composeThreadUuid && !outreachCards.some((card) => card.threadUuid === composeThreadUuid)) {
        composeThreadUuid = null;
    }

    if (replyThreadUuid && !outreachCards.some((card) => card.threadUuid === replyThreadUuid)) {
        closeReplyComposer();
    }
}

async function requestOutreach(url: string, init?: RequestInit) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...init,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.developerText ?? data.error ?? 'Outreach request failed');
    }
    applyOutreachState(data);
    return data as OutreachStateResponse;
}

async function createDraftForVendorUuid(vendorUuid: string) {
    if (!vendorUuid || creatingDraftProjectVendorUuid) return;
    creatingDraftProjectVendorUuid = vendorUuid;
    outreachError = null;

    try {
        const data = await requestOutreach(`/api/projects/${project.uuid}/outreach/drafts`, {
            method: 'POST',
            body: JSON.stringify({
                vendorUuid,
            }),
        });
        const createdThreadUuid =
            data.createdThreadUuid
            ?? outreachCards.find((card) => card.vendor.uuid === vendorUuid && card.status === 'draft')?.threadUuid
            ?? null;
        selectedOutreachThreadUuid = createdThreadUuid;
        composeThreadUuid = createdThreadUuid;
        outreachPane = 'create';
        showReplyReviseComposer = false;
        replyReviseInstructions = '';
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to create outreach draft.';
    } finally {
        creatingDraftProjectVendorUuid = null;
    }
}

function startNewThread() {
    selectedOutreachThreadUuid = null;
    composeThreadUuid = null;
    outreachPane = 'create';
    reviseDraftUuid = null;
    reviseInstructions = '';
    showReplyReviseComposer = false;
    replyReviseInstructions = '';
    closeReplyComposer();

    if (!newThreadVendorUuid && localLinked.length > 0) {
        newThreadVendorUuid = localLinked[0].uuid;
    }
}

async function loadOutreach(sync = false) {
    if (outreachLoading || outreachSyncing) return;

    outreachError = null;
    if (sync) {
        outreachSyncing = true;
    } else {
        outreachLoading = true;
    }

    try {
        const data = await requestOutreach(
            sync
                ? `/api/projects/${project.uuid}/outreach/sync`
                : `/api/projects/${project.uuid}/outreach`,
            sync ? { method: 'POST' } : undefined
        );
        if (sync && data.syncQueued) {
            setOperationSuccess('Inbox refresh queued.');
        }
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to load outreach.';
    } finally {
        outreachLoading = false;
        outreachSyncing = false;
    }
}

function updateDraftField(draftUuid: string, field: 'subject' | 'body', value: string) {
    outreachCards = outreachCards.map((card) =>
        card.draftUuid === draftUuid
            ? {
                ...card,
                [field]: value,
            }
            : card
    );
}

function buildReplyReferences(message: OutreachMessage | undefined) {
    if (!message?.messageId) return undefined;
    if (message.references?.trim()) return `${message.references.trim()} ${message.messageId}`;
    return message.messageId;
}

function reSubject(subject: string) {
    const trimmed = (subject || '').trim();
    if (!trimmed) return 'Re: Project Outreach';
    return /^re:\s/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function openReplyComposer(card: OutreachCard, message?: OutreachMessage) {
    const target = message ?? card.thread.messages[card.thread.messages.length - 1];
    replyThreadUuid = card.threadUuid;
    replySubject = reSubject(target?.subject ?? card.subject);
    replyBody = '';
    replyInReplyTo = target?.messageId;
    replyReferences = buildReplyReferences(target);
    replyThreadId = target?.threadId ?? card.thread.messages.find((entry) => entry.threadId)?.threadId;
    showReplyReviseComposer = false;
    replyReviseInstructions = '';
    replyRevisionOriginalBody = '';
    replyRevisionSuggestedBody = '';
    outreachError = null;
    outreachPane = 'read';
}

function closeReplyComposer() {
    replyThreadUuid = null;
    replySubject = '';
    replyBody = '';
    replyInReplyTo = undefined;
    replyReferences = undefined;
    replyThreadId = undefined;
    showReplyReviseComposer = false;
    replyReviseInstructions = '';
    replyRevisionOriginalBody = '';
    replyRevisionSuggestedBody = '';
}

function clearReplyRevisionPreview() {
    replyRevisionOriginalBody = '';
    replyRevisionSuggestedBody = '';
}

function applySuggestedReplyRevision() {
    if (!replyRevisionSuggestedBody.trim()) return;
    replyBody = replyRevisionSuggestedBody;
    clearReplyRevisionPreview();
    showReplyReviseComposer = false;
    setOperationSuccess('Revision applied to reply.');
}

async function sendDraft(card: OutreachCard) {
    if (!card.draftUuid || sendingDraftUuid) return;
    sendingDraftUuid = card.draftUuid;
    outreachError = null;

    try {
        await requestOutreach(`/api/projects/${project.uuid}/outreach/drafts/${card.draftUuid}/send`, {
            method: 'POST',
            body: JSON.stringify({
                subject: card.subject,
                body: card.body,
            }),
        });
        reviseDraftUuid = null;
        reviseInstructions = '';
        outreachPane = 'read';
        setOperationSuccess('Outreach email sent.');
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to send outreach email.';
        outreachCards = outreachCards.map((entry) =>
            entry.draftUuid === card.draftUuid
                ? {
                    ...entry,
                    status: 'error',
                    lastError: outreachError,
                }
                : entry
        );
    } finally {
        sendingDraftUuid = null;
    }
}

async function reviseDraft(card: OutreachCard) {
    if (!card.draftUuid || !reviseInstructions.trim() || revisingDraftUuid) return;
    revisingDraftUuid = card.draftUuid;
    outreachError = null;

    try {
        await requestOutreach(`/api/projects/${project.uuid}/outreach/drafts/${card.draftUuid}/revise`, {
            method: 'POST',
            body: JSON.stringify({
                instructions: reviseInstructions,
                subject: card.subject,
                body: card.body,
            }),
        });
        outreachPane = 'create';
        reviseDraftUuid = null;
        reviseInstructions = '';
        setOperationSuccess('Draft revised.');
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to revise outreach draft.';
    } finally {
        revisingDraftUuid = null;
    }
}

async function retryDraft(card: OutreachCard) {
    if (!card.draftUuid || retryingDraftUuid) return;
    retryingDraftUuid = card.draftUuid;
    outreachError = null;

    try {
        await requestOutreach(`/api/projects/${project.uuid}/outreach/drafts/${card.draftUuid}/retry`, {
            method: 'POST',
        });
        outreachPane = 'create';
        reviseDraftUuid = null;
        reviseInstructions = '';
        setOperationSuccess('Draft regenerated.');
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to retry outreach draft.';
        outreachCards = outreachCards.map((entry) =>
            entry.draftUuid === card.draftUuid
                ? {
                    ...entry,
                    status: 'error',
                    lastError: outreachError,
                }
                : entry
        );
    } finally {
        retryingDraftUuid = null;
    }
}

async function cancelDraft(card: OutreachCard) {
    if (!card.draftUuid) return;
    outreachError = null;

    try {
        await requestOutreach(`/api/projects/${project.uuid}/outreach/drafts/${card.draftUuid}`, {
            method: 'DELETE',
        });

        reviseDraftUuid = null;
        reviseInstructions = '';
        showReplyReviseComposer = false;
        replyReviseInstructions = '';
        closeReplyComposer();

        if (composeThreadUuid === card.threadUuid) {
            composeThreadUuid = null;
        }

        if (selectedOutreachThreadUuid === card.threadUuid) {
            selectedOutreachThreadUuid = outreachCards[0]?.threadUuid ?? null;
        }

        if (outreachCards.length === 0) {
            startNewThread();
        } else {
            outreachPane = selectedOutreachThreadUuid ? getDefaultOutreachPane(selectedOutreachCard) : 'read';
        }

        setOperationSuccess('Draft canceled.');
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to cancel outreach draft.';
    }
}

async function sendReply(card: OutreachCard) {
    if (!card.threadUuid || !replyBody.trim() || sendingReply) return;
    sendingReply = true;
    outreachError = null;

    try {
        await requestOutreach(`/api/projects/${project.uuid}/outreach/threads/${card.threadUuid}/replies`, {
            method: 'POST',
            body: JSON.stringify({
                subject: replySubject,
                body: replyBody,
                inReplyTo: replyInReplyTo,
                references: replyReferences,
                threadId: replyThreadId,
            }),
        });
        closeReplyComposer();
        outreachPane = 'read';
        setOperationSuccess('Reply sent.');
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to send reply.';
    } finally {
        sendingReply = false;
    }
}

async function reviseReply(card: OutreachCard) {
    if (!card.threadUuid || !replyReviseInstructions.trim() || revisingReplyThreadUuid) return;
    revisingReplyThreadUuid = card.threadUuid;
    outreachError = null;
    const originalBody = replyBody;

    try {
        const data = await requestOutreach(`/api/projects/${project.uuid}/outreach/threads/${card.threadUuid}/replies/revise`, {
            method: 'POST',
            body: JSON.stringify({
                instructions: replyReviseInstructions,
                body: replyBody.trim() || undefined,
            }),
        });

        if (typeof data.revisedReplyBody === 'string' && data.revisedReplyBody.trim()) {
            replyRevisionOriginalBody = originalBody;
            replyRevisionSuggestedBody = data.revisedReplyBody;
        }

        setOperationSuccess('Revision ready to review.');
    } catch (error) {
        outreachError = error instanceof Error ? error.message : 'Failed to revise reply.';
    } finally {
        revisingReplyThreadUuid = null;
    }
}

$effect(() => {
    if (
        activeTab === 'outreach' &&
        !outreachLoaded &&
        !outreachInitialLoadAttempted &&
        !outreachLoading &&
        !outreachSyncing
    ) {
        outreachInitialLoadAttempted = true;
        loadOutreach(true);
    }
});

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
let activeContactPanel = $state<'attach' | 'new' | 'find-vendors' | null>(null);
let newContactName = $state('');
let newContactEmail = $state('');
let newContactErrors = $state<{ name?: string; email?: string }>({});
let creatingContact = $state(false);
let opSuccessMsg = $state('');
let opSuccessTimer: ReturnType<typeof setTimeout> | null = null;
let deleteDialogEl = $state<HTMLDialogElement | null>(null)
let deleteProcessing = $state(false)
let deleteError = $state<string | null>(null)
let deleteButtonEl = $state<HTMLButtonElement | null>(null)

function openDeleteDialog() {
    deleteError = null
    deleteDialogEl?.showModal()
}

async function deleteProject() {
    if (deleteProcessing) return
    deleteProcessing = true 
    deleteError = null
    try {
        const res = await patchProject({ isActive: false })
        if (!res.ok) {
            deleteError = res.status === 404 
            ? 'This project could not be deleted. It may have already been removed.'
            : 'Failed to delete project. Please try again.'
        return
        }
        window.location.replace('/dashboard', { replace: true })
    } catch {
        deleteError = 'Failed to delete project. Please try again.'
    } finally {
        deleteProcessing = false
    }
}

function setOperationSuccess(message: string) {
    opSuccessMsg = message;
    if (opSuccessTimer) {
        clearTimeout(opSuccessTimer);
    }
    opSuccessTimer = setTimeout(() => {
        opSuccessMsg = '';
        opSuccessTimer = null;
    }, 3000);
}

let unlinkedVendors = $derived(
    localAllVendors.filter((v) => !localLinked.some((l) => l.uuid === v.uuid))
);

// Listing UUIDs already attached — used by VendorSearch to show "already in project" state
let attachedListingUuids = $derived(
    localLinked.flatMap((v) => v.vendorListingUuid ? [v.vendorListingUuid] : [])
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
    && localProject.budgetAmount === null
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
            budgetCurrency: localProject.budgetCurrency ?? undefined,
            goals: localProject.goals ?? undefined,
        });
        if (res.ok) {
            const data = await res.json();
            localProject = { ...localProject, ...data.project };
            savedProject = { ...savedProject, ...data.project };
            editMode = false;
            setOperationSuccess('Project details saved.');
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
            setOperationSuccess(`${uuids.length} contact${uuids.length > 1 ? 's' : ''} attached.`);
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
            setOperationSuccess('Contact detached.');
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
        const contactVendorUuid = contact.vendorUuid ?? contact.uuid;
        const linkedContact = {
            uuid: contactVendorUuid,
            vendorUuid: contactVendorUuid,
            vendorListingUuid: contact.vendorListingUuid ?? contact.uuid,
            name: contact.name,
            email: contact.email,
        };
        const newList = [...localLinked.map((v) => v.uuid), contactVendorUuid];
        const patchRes = await patchProject({ vendors: newList });
        if (patchRes.ok) {
            localLinked = [...localLinked, linkedContact];
            localAllVendors = [...localAllVendors, linkedContact];
            newContactName = '';
            newContactEmail = '';
            activeContactPanel = null;
            setOperationSuccess('Contact created and attached.');
        } else {
            // Contact was created but linking failed — surface it in the dropdown
            localAllVendors = [...localAllVendors, linkedContact];
            contactSearchQuery = contact.name;
            activeContactPanel = 'attach';
            vendorError = 'Contact created but could not be attached. Select them from the dropdown and click Attach.';
        }
    } finally {
        creatingContact = false;
    }
}


onDestroy(() => {
    if (opSuccessTimer) {
        clearTimeout(opSuccessTimer);
        opSuccessTimer = null;
    }
});
</script>

<svelte:head>
  <title>{project.name} — Envoy</title>
</svelte:head>

<Sidebar>

<div class="flex min-h-0 min-w-0 flex-col w-full h-[calc(100dvh-var(--mobile-header-height,4.5rem))] lg:h-dvh" style="contain: layout;">

<!-- Screen reader live region for operation feedback -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">{opSuccessMsg}</div>

<!-- Convo tab -->
{#if activeTab === 'convo'}
<div class="flex min-h-0 min-w-0 flex-col flex-1 overflow-hidden w-full">
    <div class="min-h-0 flex-1 overflow-y-auto"
         aria-live="polite" aria-atomic="false" aria-label="Conversation">
        <ProjectSectionChrome
            activeTab={activeTab}
            onSelectTab={handleTabChange}
            sectionLabel="Conversation"
            projectName={project.name}
            description="Use Envoy to capture missing details, refine the brief, and keep project planning in one thread."
        />
        <div class="mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-4">
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
                                    onclick={() => retryMessage(msg.retryPrompt!)}>
                                    Retry
                                </button>
                            </div>
                        {:else}
                            {msg.content}
                        {/if}
                    </div>
                    {#if msg.role === 'user'}
                        <UserAvatar
                            avatar={currentUserAvatar}
                            size="sm"
                            decorative={true}
                            testId="chat-user-avatar"
                            class="mt-1.5"
                        />
                    {/if}
                </div>
            {/each}
            {#if greetingLoading}
                <div class="flex items-start gap-2">
                    <div class="avatar size-8 mt-1.5" aria-hidden="true">
                        <Logo class="size-8" />
                    </div>
                    <div class="card max-w-lg p-3 text-sm preset-filled-surface-100-900">
                        <span class="inline-flex gap-1 items-center h-4" role="status" aria-label="Assistant is typing">
                            <span class="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:0ms]" aria-hidden="true"></span>
                            <span class="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:150ms]" aria-hidden="true"></span>
                            <span class="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:300ms]" aria-hidden="true"></span>
                        </span>
                    </div>
                </div>
            {/if}
        </div>
    </div>
    <form class="p-4 flex gap-2 items-end bg-surface-50-950/50 backdrop-blur-md border-t border-surface-200-800" onsubmit={sendMessage}>
        <label for="project-message" class="sr-only">Message</label>
        <textarea
            id="project-message"
            class="textarea flex-1 resize-none overflow-y-auto leading-6"
            rows="1"
            bind:value={input}
            bind:this={inputEl}
            onkeydown={handleInputKeydown}
            placeholder="Type your message..."
            autocomplete="off"
            disabled={isLoading}></textarea>
        <button class="btn btn-sm preset-filled-primary-500" type="submit" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send'}
        </button>
    </form>
</div>
{/if}

<!-- Outreach tab -->
{#if activeTab === 'outreach'}
<div class="min-h-0 flex-1 overflow-y-auto w-full">
    <ProjectSectionChrome
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        sectionLabel="Outreach"
        projectName={project.name}
        description="Review drafts, send outreach, and reply to vendor threads without leaving this project."
    >
        {#snippet actions()}

            <button class="btn btn-sm preset-tonal" type="button" onclick={() => loadOutreach(true)} disabled={outreachSyncing}>
                    <RefreshCwIcon class={`size-4 shrink-0 ${outreachSyncing ? 'animate-spin' : ''}`} />
                    <span>{outreachSyncing ? 'Refreshing…' : 'Refresh'}</span>
                </button>
                <a href="/account#email-accounts" class="btn btn-sm preset-tonal">Manage Email Accounts</a>
        {/snippet}
    </ProjectSectionChrome>
    <div class="mx-auto w-full max-w-6xl p-4 sm:p-6 space-y-6">

        {#if outreachError}
            <div class="rounded-xl border border-error-500/30 bg-error-500/10 p-4 text-sm text-error-500">
                {outreachError}
            </div>
        {/if}

        {#if outreachLoading}
            <div class="rounded-xl border border-surface-200-800 bg-surface-50-950/50 p-6 text-sm text-surface-600-400">
                Loading outreach…
            </div>
        {:else}
            {#if localLinked.length === 0}
                <div class="rounded-xl border border-dashed border-surface-200-800 bg-surface-50-950/30 p-4 text-sm text-surface-600-400">
                    No contacts are linked to this project yet. Add one in the Overview tab, then create your first outreach message.
                </div>
            {/if}
            <ProjectOutreachPanel
                cards={outreachCards}
                contacts={localLinked}
                currentUserName={currentUserName}
                selectedCard={selectedOutreachCard}
                composeCard={composeOutreachCard}
                outreachPane={outreachPane}
                newThreadVendorUuid={newThreadVendorUuid}
                creatingDraftProjectVendorUuid={creatingDraftProjectVendorUuid}
                sendingDraftUuid={sendingDraftUuid}
                retryingDraftUuid={retryingDraftUuid}
                revisingDraftUuid={revisingDraftUuid}
                reviseDraftUuid={reviseDraftUuid}
                reviseInstructions={reviseInstructions}
                replyThreadUuid={replyThreadUuid}
                replySubject={replySubject}
                replyBody={replyBody}
                sendingReply={sendingReply}
                revisingReplyThreadUuid={revisingReplyThreadUuid}
                showReplyReviseComposer={showReplyReviseComposer}
                replyReviseInstructions={replyReviseInstructions}
                replyRevisionOriginalBody={replyRevisionOriginalBody}
                replyRevisionSuggestedBody={replyRevisionSuggestedBody}
                onSelectCard={selectOutreachCard}
                onStartNewThread={startNewThread}
                onCreateDraftForVendorUuid={createDraftForVendorUuid}
                onUpdateDraftField={updateDraftField}
                onSendDraft={sendDraft}
                onRetryDraft={retryDraft}
                onCancelDraft={cancelDraft}
                onToggleRevise={(card) => {
                    reviseDraftUuid = reviseDraftUuid === card.draftUuid ? null : card.draftUuid;
                    reviseInstructions = '';
                }}
                onReviseDraft={reviseDraft}
                onChangeReviseInstructions={(value) => {
                    reviseInstructions = value;
                }}
                onChangeNewThreadVendorUuid={(value) => {
                    newThreadVendorUuid = value;
                }}
                onCancelRevise={() => {
                    reviseDraftUuid = null;
                    reviseInstructions = '';
                }}
                onOpenReplyComposer={openReplyComposer}
                onSendReply={sendReply}
                onCloseReplyComposer={closeReplyComposer}
                onReplySubjectChange={(value) => {
                    replySubject = value;
                }}
                onReplyBodyChange={(value) => {
                    replyBody = value;
                    clearReplyRevisionPreview();
                }}
                onToggleReplyRevise={() => {
                    showReplyReviseComposer = !showReplyReviseComposer;
                }}
                onChangeReplyReviseInstructions={(value) => {
                    replyReviseInstructions = value;
                }}
                onReviseReply={reviseReply}
                onApplySuggestedReplyRevision={applySuggestedReplyRevision}
                onDismissSuggestedReplyRevision={clearReplyRevisionPreview}
                onCancelReplyRevise={() => {
                    showReplyReviseComposer = false;
                    replyReviseInstructions = '';
                    clearReplyRevisionPreview();
                }}
            />
        {/if}
        </div>
</div>
{/if}
<!-- Overview tab -->
{#if activeTab === 'overview'}
<div class="min-h-0 flex-1 overflow-y-auto @container">
<ProjectSectionChrome
    activeTab={activeTab}
    onSelectTab={handleTabChange}
    sectionLabel="Overview"
    projectName={project.name}
    description="Keep the project brief, timeline, budget, and key contacts together in one place."
>
    {#snippet actions()}
        <button
            bind:this={deleteButtonEl}
            type="button"
            class="btn btn-sm preset-tonal-error"
            aria-haspopup="dialog"
            aria-controls="delete-project-dialog"
            onclick={openDeleteDialog}
    >
            <Trash2Icon class="size-4" />
            <span>Delete project</span>
        </button>
    {/snippet}
</ProjectSectionChrome>



    <div class="p-4 sm:p-6 w-full max-w-6xl mx-auto">
<div class="grid grid-cols-1 @4xl:grid-cols-2 gap-8 items-start">

    <!-- Project Details -->
    <section class="rounded-2xl border border-surface-200-800 bg-surface-50-950/40 backdrop-blur-md p-5">
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
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">Description</dt>
                        <dd>{localProject.description}</dd>
                    </div>
                {/if}
                {#if localProject.location}
                    <div>
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">Location</dt>
                        <dd>{localProject.location.formatted_address || localProject.location.city}</dd>
                    </div>
                {/if}
                {#if localProject.startDate}
                    <div>
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">Start Date</dt>
                        <dd>{formatDate(localProject.startDate)}</dd>
                    </div>
                {/if}
                {#if localProject.endDate}
                    <div>
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">End Date</dt>
                        <dd>{formatDate(localProject.endDate)}</dd>
                    </div>
                {/if}
                {#if localProject.deadline}
                    <div>
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">Deadline</dt>
                        <dd>{formatDate(localProject.deadline)}</dd>
                    </div>
                {/if}
                {#if localProject.budgetAmount !== null && localProject.budgetAmount !== 0}
                    <div>
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">Budget</dt>
                        <dd>{formatCurrency(localProject.budgetAmount, localProject.budgetCurrency ?? 'USD')}</dd>
                    </div>
                {/if}
                {#if localProject.goals}
                    <div>
                        <dt class="text-surface-600-400 text-xs uppercase tracking-wide mb-0.5">Goals</dt>
                        <dd class="whitespace-pre-wrap">{localProject.goals}</dd>
                    </div>
                {/if}
                {#if hasNoDetails}
                    <p class="text-surface-600-400 text-sm italic">No details added yet.</p>
                {/if}
            </dl>
        {/if}
    </section>

    <!-- Contacts -->
    <section class="rounded-2xl border border-surface-200-800 bg-surface-50-950/40 backdrop-blur-md p-5">
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
            <div class="flex gap-2 mb-3 flex-wrap" role="group" aria-label="Add contact options">
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
                <button
                    class="btn btn-sm {activeContactPanel === 'find-vendors' ? 'preset-filled-primary-500' : 'preset-tonal'}"
                    aria-expanded={activeContactPanel === 'find-vendors'}
                    aria-controls="panel-find-vendors"
                    onclick={() => { activeContactPanel = activeContactPanel === 'find-vendors' ? null : 'find-vendors'; contactSearchQuery = ''; selectedVendorUuids = new Set(); newContactName = ''; newContactEmail = ''; newContactErrors = {}; }}>
                    🔍 Find vendors
                </button>
            </div>

            <!-- Attach existing panel -->
            {#if activeContactPanel === 'attach'}
                <div id="panel-attach-contact" class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-3 mb-4 space-y-3">
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
                                            <span class="text-surface-600-400 ml-2 text-xs">{v.email}</span>
                                        </span>
                                    </label>
                                </li>
                            {/each}
                        </ul>
                    {:else if contactSearchQuery.trim()}
                        <p class="text-surface-600-400 text-sm italic">No contacts match "{contactSearchQuery}"</p>
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
                <form id="panel-new-contact" onsubmit={createAndAttachContact} novalidate class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-3 mb-4 space-y-3">
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

            <!-- Find vendors panel -->
            {#if activeContactPanel === 'find-vendors'}
                <div id="panel-find-vendors" class="card preset-outlined-surface-200-800 border border-surface-200-800 bg-surface-50-950/50 backdrop-blur-md p-4 mb-4">
                    <VendorSearch
                        context="project"
                        projectUuid={project.uuid}
                        projectVendors={attachedListingUuids}
                        onClose={() => { activeContactPanel = null; }}
                        onAttached={(_uuids) => {
                            activeContactPanel = null;
                            router.reload({ only: ['linkedVendors', 'allVendors'] });
                        }}
                    />
                </div>
            {/if}
        {/if}

        <!-- Contact list -->
        {#if localLinked.length === 0}
            <p class="text-surface-600-400 text-sm italic">
                No contacts yet. Attach contacts here so Envoy can draft outreach emails for them.
            </p>
        {:else}
            <ul class="divide-y divide-surface-200-800">
                {#each localLinked as vendor (vendor.uuid)}
                    <li class="flex items-center justify-between py-2">
                        <div>
                            <p class="text-sm font-medium">{vendor.name}</p>
                            <p class="text-xs text-surface-600-400">{vendor.email}</p>
                        </div>
                        {#if contactEditMode}
                            {#if pendingDetach === vendor.uuid}
                                <span class="flex gap-1 items-center text-xs">
                                    <span class="text-surface-600-400">Remove?</span>
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
<dialog 
    bind:this={deleteDialogEl}
    id="delete-project-dialog"
    class="m-auto p-0 bg-transparent rounded-2x1 shadow-2x1 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    onclose={() => deleteButtonEl?.focus()}
    onclick={(e) => { if (e.target === deleteDialogEl) deleteDialogEl?.close() }}
>
    <div class="rounded-2x1 border border-surface-200-800 bg-surface-50-950 p-6 w-full max-w-sm">
        <h3 class="text-lg font-semibold">Delete project?</h3>
        <p class="mt-2 text-sm text-surface-600-400">
            This removes "{project.name}" from your active projects.
        </p>
        {#if deleteError}
            <p role="alert" class="mt-3 text-sm text-error-500">{deleteError}</p>
        {/if}
        <div class="mt-6 flex justify-end gap-3">
            <button 
                type="button"
                class="btn btn-sm preset-tonal"
                onclick={() => deleteDialogEl?.close()}
            >Cancel</button>
            <button
                type="button"
                class="btn btn-sm preset-filled-error-500"
                disabled={deleteProcessing}
                onclick={deleteProject}
            >
                {deleteProcessing ? 'Deleting...' : 'Delete project'}
            </button>
        </div>
    </div>
    </dialog>
{/if}

</div><!-- end outer flex column -->

</Sidebar>


