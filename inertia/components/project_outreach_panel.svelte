<script lang="ts">
import { ArrowLeftIcon, CheckIcon, PlusIcon, SendIcon, SparklesIcon } from '@lucide/svelte';
import { Combobox } from '@skeletonlabs/skeleton-svelte';
import { collection } from '@zag-js/combobox';
import { DateTime } from 'luxon';
import { formatDate, formatDateTime } from '../utils/format';

interface Vendor {
    uuid: string;
    name: string;
    email: string;
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

const {
    cards,
    contacts,
    currentUserName,
    selectedCard,
    composeCard,
    outreachPane,
    newThreadVendorUuid,
    creatingDraftProjectVendorUuid,
    sendingDraftUuid,
    revisingDraftUuid,
    reviseDraftUuid,
    reviseInstructions,
    replyThreadUuid,
    replySubject,
    replyBody,
    sendingReply,
    revisingReplyThreadUuid,
    showReplyReviseComposer,
    replyReviseInstructions,
    replyRevisionOriginalBody,
    replyRevisionSuggestedBody,
    onSelectCard,
    onStartNewThread,
    onCreateDraftForVendorUuid,
    onUpdateDraftField,
    onSendDraft,
    onCancelDraft,
    onToggleRevise,
    onReviseDraft,
    onChangeReviseInstructions,
    onChangeNewThreadVendorUuid,
    onCancelRevise,
    onOpenReplyComposer,
    onSendReply,
    onCloseReplyComposer,
    onReplySubjectChange,
    onReplyBodyChange,
    onToggleReplyRevise,
    onChangeReplyReviseInstructions,
    onReviseReply,
    onApplySuggestedReplyRevision,
    onDismissSuggestedReplyRevision,
    onCancelReplyRevise,
}: {
    cards: OutreachCard[];
    contacts: Vendor[];
    currentUserName?: string;
    selectedCard: OutreachCard | null;
    composeCard: OutreachCard | null;
    outreachPane: 'read' | 'create';
    newThreadVendorUuid: string;
    creatingDraftProjectVendorUuid: string | null;
    sendingDraftUuid: string | null;
    revisingDraftUuid: string | null;
    reviseDraftUuid: string | null;
    reviseInstructions: string;
    replyThreadUuid: string | null;
    replySubject: string;
    replyBody: string;
    sendingReply: boolean;
    revisingReplyThreadUuid: string | null;
    showReplyReviseComposer: boolean;
    replyReviseInstructions: string;
    replyRevisionOriginalBody: string;
    replyRevisionSuggestedBody: string;
    onSelectCard: (card: OutreachCard) => void;
    onStartNewThread: () => void;
    onCreateDraftForVendorUuid: (vendorUuid: string) => void | Promise<void>;
    onUpdateDraftField: (draftUuid: string, field: 'subject' | 'body', value: string) => void;
    onSendDraft: (card: OutreachCard) => void | Promise<void>;
    onCancelDraft: (card: OutreachCard) => void | Promise<void>;
    onToggleRevise: (card: OutreachCard) => void;
    onReviseDraft: (card: OutreachCard) => void | Promise<void>;
    onChangeReviseInstructions: (value: string) => void;
    onChangeNewThreadVendorUuid: (value: string) => void;
    onCancelRevise: () => void;
    onOpenReplyComposer: (card: OutreachCard, message?: OutreachMessage) => void;
    onSendReply: (card: OutreachCard) => void | Promise<void>;
    onCloseReplyComposer: () => void;
    onReplySubjectChange: (value: string) => void;
    onReplyBodyChange: (value: string) => void;
    onToggleReplyRevise: () => void;
    onChangeReplyReviseInstructions: (value: string) => void;
    onReviseReply: (card: OutreachCard) => void | Promise<void>;
    onApplySuggestedReplyRevision: () => void;
    onDismissSuggestedReplyRevision: () => void;
    onCancelReplyRevise: () => void;
} = $props();

let mobilePane = $state<'list' | 'detail'>('list');
let showFullMessageDetails = $state(false);

const contactCollection = $derived(
    collection({
        items: contacts,
        itemToValue: (contact) => contact.uuid,
        itemToString: (contact) => `${contact.name} (${contact.email})`,
    })
);

$effect(() => {
    if (
        selectedCard &&
        selectedCard.thread.messages.length > 0 &&
        replyThreadUuid !== selectedCard.threadUuid
    ) {
        onOpenReplyComposer(selectedCard);
    }
});

function getOutreachStatusLabel(card: OutreachCard) {
    if (card.status === 'sent') return card.sentAt ? `Sent - ${formatDate(card.sentAt)}` : 'Sent';
    if (card.status === 'received') return card.lastActivityAt ? `Received - ${formatDate(card.lastActivityAt)}` : 'Received';
    if (card.status === 'error') return 'Send failed';
    if (card.status === 'empty') return 'No messages yet';
    return 'Pending review';
}

function getBubbleDisplayName(message: OutreachMessage, card: OutreachCard) {
    if (message.direction === 'inbound') {
        return card.vendor.name;
    }

    return currentUserName?.trim() || 'You';
}

function getConversationSubject(card: OutreachCard) {
    if (card.subject?.trim()) return card.subject.trim();

    for (let index = card.thread.messages.length - 1; index >= 0; index--) {
        const candidate = card.thread.messages[index]?.subject?.trim();
        if (candidate) return candidate;
    }

    return 'Untitled message';
}

function getMessageTimestamp(sentAt: string) {
    return formatDateTime(sentAt) ?? formatDate(sentAt) ?? 'Unknown time';
}

function getMessageTime(sentAt: string) {
    const dt = DateTime.fromISO(sentAt);
    if (!dt.isValid) return getMessageTimestamp(sentAt);
    return dt.toLocaleString(DateTime.TIME_SIMPLE);
}

function looksLikeQuoteOrForwardBoundary(line: string) {
    return (
        /^>/.test(line) ||
        /^&gt;/.test(line) ||
        /^on .+wrote:$/i.test(line) ||
        /^from:\s/i.test(line) ||
        /^sent:\s/i.test(line) ||
        /^date:\s/i.test(line) ||
        /^bcc:\s/i.test(line) ||
        /^subject:\s/i.test(line) ||
        /^to:\s/i.test(line) ||
        /^cc:\s/i.test(line) ||
        /^-{2,}\s*original message\s*-{2,}$/i.test(line) ||
        /^begin forwarded message:/i.test(line) ||
        /^_{5,}$/.test(line)
    );
}

function normalizeMessageText(body: string) {
    return (body || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .trim();
}

function looksLikeSignatureStart(line: string) {
    return (
        /^--\s*/.test(line) ||
        /^sent from my /i.test(line) ||
        /^get outlook for /i.test(line) ||
        /^confidentiality notice[:\s]/i.test(line)
    );
}

function cleanMessageBodyForBubble(body: string) {
    const normalized = normalizeMessageText(body);
    if (!normalized) return '';

    const lines = normalized.split('\n');
    const cleanedLines: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (looksLikeQuoteOrForwardBoundary(trimmed)) break;
        cleanedLines.push(line);
    }

    while (cleanedLines.length > 0 && !cleanedLines[cleanedLines.length - 1].trim()) {
        cleanedLines.pop();
    }

    const signatureStart = cleanedLines.findIndex(
        (line, index) => index > 0 && looksLikeSignatureStart(line.trim())
    );
    if (signatureStart !== -1) {
        cleanedLines.splice(signatureStart);
    }

    const cleaned = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return cleaned || normalized;
}

function getOutreachPreview(card: OutreachCard) {
    const latestMessage = card.thread.messages[card.thread.messages.length - 1];
    if (card.status === 'draft' || card.status === 'error') {
        return cleanMessageBodyForBubble(card.body || '') || 'Draft ready for review.';
    }
    if (latestMessage?.body?.trim()) return cleanMessageBodyForBubble(latestMessage.body);
    return cleanMessageBodyForBubble(card.body || '') || 'Start a new email to this contact.';
}

function openNewMessage() {
    onStartNewThread();
    showFullMessageDetails = false;
    mobilePane = 'detail';
}

function openThread(card: OutreachCard) {
    onSelectCard(card);
    showFullMessageDetails = false;
    mobilePane = 'detail';
}

function backToList() {
    mobilePane = 'list';
}

async function cancelDraftAndReturn(card: OutreachCard) {
    await onCancelDraft(card);
    mobilePane = 'list';
}

function getMessageBodyForDisplay(message: OutreachMessage) {
    if (showFullMessageDetails) {
        return normalizeMessageText(message.body || '');
    }

    return cleanMessageBodyForBubble(message.body || '');
}

function getSelectedContact(contactUuid: string) {
    return contacts.find((contact) => contact.uuid === contactUuid) ?? null;
}
</script>

<div class={`min-w-0 grid gap-4 xl:gap-6 items-start ${cards.length === 0 && outreachPane === 'read' ? 'xl:grid-cols-1' : 'xl:grid-cols-[22rem_minmax(0,1fr)]'}`}>
    <aside class={`rounded-2xl border border-surface-200-800 bg-surface-50-950/50 ${mobilePane === 'detail' ? 'hidden xl:block' : ''}`}>
        <div class="flex items-center justify-between gap-3 border-b border-surface-200-800 px-4 py-4">
            <div>
                <h3 class="text-sm font-semibold">Inbox</h3>
                <p class="mt-1 text-xs text-surface-600-400">Thread list by most recent activity.</p>
            </div>
            <button type="button" class="btn btn-sm preset-filled-primary-500" onclick={openNewMessage}>
                <PlusIcon class="size-4 shrink-0" />
                <span>New message</span>
            </button>
        </div>

        <div class="max-h-[42rem] space-y-2 overflow-y-auto p-3">
            {#if cards.length === 0}
                <p class="rounded-xl border border-dashed border-surface-200-800 bg-surface-100-900/25 px-4 py-5 text-sm text-surface-600-400">
                    No threads yet. Create your first outreach message.
                </p>
            {:else}
                {#each cards as card (card.threadUuid)}
                    <button
                        type="button"
                        class={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedCard?.threadUuid === card.threadUuid ? 'border-primary-500/40 bg-primary-500/10' : 'border-surface-200-800 bg-surface-100-900/20 hover:bg-surface-100-900/40'}`}
                        onclick={() => openThread(card)}
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-semibold">{card.vendor.name}</p>
                                <p class="truncate text-xs text-surface-600-400">{card.vendor.email}</p>
                            </div>
                            <div class="flex shrink-0 flex-col items-end gap-1">
                                <span class="rounded-full bg-surface-100-900/70 px-2.5 py-1 text-[11px] font-medium text-surface-600-400">
                                    {card.status === 'draft' ? 'Draft' : card.status === 'error' ? 'Error' : card.status === 'received' ? 'Received' : card.status === 'sent' ? 'Sent' : 'New'}
                                </span>
                                {#if card.needsAttention}
                                    <span class="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:text-primary-300">
                                        Needs attention
                                    </span>
                                {/if}
                            </div>
                        </div>
                        <p class="mt-3 truncate text-sm font-medium">{card.subject || 'Untitled message'}</p>
                        <p class="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-surface-600-400">{getOutreachPreview(card)}</p>
                        <div class="mt-3 flex items-center justify-between gap-2 text-[11px] text-surface-600-400">
                            <span>{card.lastActivityAt ? formatDate(card.lastActivityAt) : 'No activity yet'}</span>
                            <span>{card.thread.messages.length} message{card.thread.messages.length === 1 ? '' : 's'}</span>
                        </div>
                    </button>
                {/each}
            {/if}
        </div>
    </aside>

    <section class={`overflow-hidden rounded-2xl border border-surface-200-800 bg-surface-50-950/50 ${mobilePane === 'list' ? 'hidden xl:block' : ''}`}>
        {#if outreachPane === 'create'}
            <div class="xl:hidden border-b border-surface-200-800 px-5 py-3">
                <button type="button" class="btn btn-sm preset-tonal" onclick={backToList}>
                    <ArrowLeftIcon class="size-4 shrink-0" />
                    <span>Back</span>
                </button>
            </div>
            <div class="border-b border-surface-200-800 px-5 py-5 xl:border-t-0">
                <div class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div class="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <div>
                            <p class="text-xs uppercase tracking-[0.18em] text-surface-600-400">Compose</p>
                            {#if composeCard}
                                <h3 class="mt-2 text-lg font-semibold">Draft to {composeCard.vendor.name}</h3>
                                <p class="text-sm text-surface-600-400">{composeCard.vendor.email}</p>
                            {:else}
                                <h3 class="mt-2 text-lg font-semibold">New message</h3>
                                <p class="text-sm text-surface-600-400">Choose a contact and create a new thread draft.</p>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-5">
                {#if composeCard?.draftUuid}
                    <div class="space-y-4">
                        <label class="block text-sm font-medium">
                            Subject
                            <input
                                class="input mt-2 w-full"
                                type="text"
                                value={composeCard.subject}
                                oninput={(event) => onUpdateDraftField(composeCard.draftUuid!, 'subject', (event.currentTarget as HTMLInputElement).value)}
                            />
                        </label>
                        <label class="block text-sm font-medium">
                            Body
                            <textarea
                                class="textarea mt-2 min-h-[20rem] w-full"
                                value={composeCard.body}
                                oninput={(event) => onUpdateDraftField(composeCard.draftUuid!, 'body', (event.currentTarget as HTMLTextAreaElement).value)}
                            />
                        </label>
                        {#if composeCard.lastError}
                            <p class="text-sm text-error-500">{composeCard.lastError}</p>
                        {/if}
                        <div class="flex flex-wrap gap-2">
                            <button
                                type="button"
                                class="btn btn-sm preset-filled-primary-500"
                                disabled={sendingDraftUuid === composeCard.draftUuid}
                                onclick={() => onSendDraft(composeCard)}
                            >
                                <SendIcon class="size-4 shrink-0" />
                                <span>{sendingDraftUuid === composeCard.draftUuid ? 'Sending...' : 'Approve & Send'}</span>
                            </button>
                            <button type="button" class="btn btn-sm preset-tonal" onclick={() => onToggleRevise(composeCard)}>
                                <SparklesIcon class="size-4 shrink-0" />
                                <span>Revise</span>
                            </button>
                            <button
                                type="button"
                                class="btn btn-sm preset-tonal"
                                disabled={sendingDraftUuid === composeCard.draftUuid || revisingDraftUuid === composeCard.draftUuid}
                                onclick={() => cancelDraftAndReturn(composeCard)}
                            >
                                <span>Cancel draft</span>
                            </button>
                        </div>

                        {#if reviseDraftUuid === composeCard.draftUuid}
                            <div class="rounded-xl border border-surface-200-800 bg-surface-100-900/30 p-4 space-y-3">
                                <label class="block text-sm font-medium">
                                    What should Envoy change?
                                    <textarea class="textarea mt-2 min-h-28 w-full" value={reviseInstructions} oninput={(event) => onChangeReviseInstructions((event.currentTarget as HTMLTextAreaElement).value)} placeholder="Tighten the tone, add missing project details, or shorten the message." />
                                </label>
                                <div class="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        class="btn btn-sm preset-filled-primary-500"
                                        disabled={revisingDraftUuid === composeCard.draftUuid || !reviseInstructions.trim()}
                                        onclick={() => onReviseDraft(composeCard)}
                                    >
                                        {revisingDraftUuid === composeCard.draftUuid ? 'Revising...' : 'Generate revision'}
                                    </button>
                                    <button type="button" class="btn btn-sm preset-tonal" onclick={onCancelRevise}>Cancel</button>
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#if contacts.length === 0}
                            <div class="rounded-xl border border-dashed border-surface-200-800 bg-surface-100-900/20 p-4 text-sm text-surface-600-400">
                                No contacts are linked to this project yet. Add a contact in the Overview tab to start a new outreach message.
                            </div>
                        {:else}
                            <div class="space-y-2">
                                <label for="outreach-contact-select" class="block text-sm font-medium">Contact</label>
                                <Combobox
                                    id="outreach-contact-select"
                                    collection={contactCollection}
                                    value={newThreadVendorUuid ? [newThreadVendorUuid] : []}
                                    placeholder="Choose a contact"
                                    closeOnSelect={true}
                                    openOnClick={true}
                                    onValueChange={(details) => onChangeNewThreadVendorUuid(details.value[0] ?? '')}
                                >
                                    <Combobox.Control class="grid grid-cols-[1fr_auto] items-center gap-2">
                                        <Combobox.Input class="input w-full" />
                                        <Combobox.Trigger class="btn btn-sm preset-tonal shrink-0" />
                                    </Combobox.Control>
                                    <Combobox.Positioner>
                                        <Combobox.Content class="card z-10 mt-2 max-h-72 overflow-y-auto border border-surface-200-800 bg-surface-100-900 p-2 shadow-md">
                                            {#each contacts as contact (contact.uuid)}
                                                <Combobox.Item
                                                    item={contact}
                                                    class="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-surface-200-800 data-[highlighted]:bg-surface-200-800 data-[state=checked]:!bg-transparent data-[state=checked]:!text-inherit"
                                                >
                                                    <div class="min-w-0">
                                                        <p class="truncate text-sm font-medium">{contact.name}</p>
                                                        <p class="truncate text-xs text-surface-600-400">{contact.email}</p>
                                                    </div>
                                                    <Combobox.ItemIndicator aria-hidden="true">
                                                        <CheckIcon class="size-4" />
                                                    </Combobox.ItemIndicator>
                                                </Combobox.Item>
                                            {/each}
                                        </Combobox.Content>
                                    </Combobox.Positioner>
                                </Combobox>
                                {#if getSelectedContact(newThreadVendorUuid)}
                                    <p class="text-xs text-surface-600-400">
                                        Selected: {getSelectedContact(newThreadVendorUuid)?.name} ({getSelectedContact(newThreadVendorUuid)?.email})
                                    </p>
                                {/if}
                            </div>

                            <button
                                type="button"
                                class="btn btn-sm preset-filled-primary-500"
                                disabled={!newThreadVendorUuid || creatingDraftProjectVendorUuid === newThreadVendorUuid}
                                onclick={() => onCreateDraftForVendorUuid(newThreadVendorUuid)}
                            >
                                <PlusIcon class="size-4 shrink-0" />
                                <span>{creatingDraftProjectVendorUuid === newThreadVendorUuid ? 'Creating...' : 'Create draft'}</span>
                            </button>
                        {/if}
                    </div>
                {/if}
            </div>
        {:else if selectedCard}
            <div class="xl:hidden border-b border-surface-200-800 px-5 py-3">
                <button type="button" class="btn btn-sm preset-tonal" onclick={backToList}>
                    <ArrowLeftIcon class="size-4 shrink-0" />
                    <span>Back</span>
                </button>
            </div>
            <div class="border-b border-surface-200-800 px-5 py-5 xl:border-t-0">
                <div class="min-w-0 space-y-3">
                    <div class="min-w-0 space-y-3">
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0 space-y-1">
                                <p class="text-xs uppercase tracking-[0.18em] text-surface-600-400">Conversation</p>
                                <h3 class="text-lg font-semibold">{selectedCard.vendor.name}</h3>
                                <p class="text-sm text-surface-600-400">{selectedCard.vendor.email}</p>
                            </div>
                            <div class="hidden shrink-0 items-end gap-2 sm:flex sm:flex-col">
                                <div class="flex flex-wrap items-center justify-end gap-2">
                                    <span class="rounded-full bg-surface-100-900/70 px-3 py-1 text-xs font-medium">{getOutreachStatusLabel(selectedCard)}</span>
                                    {#if selectedCard.needsAttention}
                                        <span class="rounded-full bg-primary-500/15 px-3 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">Needs attention</span>
                                    {/if}
                                </div>
                                <div class="flex items-center justify-end">
                                    <button
                                        type="button"
                                        class="inline-flex items-center rounded-full border border-surface-200-800 bg-surface-100-900/30 p-1 text-xs font-medium"
                                        aria-label="Message detail level"
                                        aria-pressed={showFullMessageDetails}
                                        onclick={() => (showFullMessageDetails = !showFullMessageDetails)}
                                    >
                                        <span
                                            class={`rounded-full px-3 py-1 transition ${
                                                showFullMessageDetails
                                                    ? 'text-surface-600-400'
                                                    : 'bg-primary-500 text-white'
                                            }`}
                                        >
                                            Simple
                                        </span>
                                        <span
                                            class={`rounded-full px-3 py-1 transition ${
                                                showFullMessageDetails
                                                    ? 'bg-primary-500 text-white'
                                                    : 'text-surface-600-400'
                                            }`}
                                        >
                                            Detailed
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 sm:hidden">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="rounded-full bg-surface-100-900/70 px-3 py-1 text-xs font-medium">{getOutreachStatusLabel(selectedCard)}</span>
                                {#if selectedCard.needsAttention}
                                    <span class="rounded-full bg-primary-500/15 px-3 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">Needs attention</span>
                                {/if}
                            </div>
                            <button
                                type="button"
                                class="inline-flex items-center rounded-full border border-surface-200-800 bg-surface-100-900/30 p-1 text-xs font-medium"
                                aria-label="Message detail level"
                                aria-pressed={showFullMessageDetails}
                                onclick={() => (showFullMessageDetails = !showFullMessageDetails)}
                            >
                                <span
                                    class={`rounded-full px-3 py-1 transition ${
                                        showFullMessageDetails
                                            ? 'text-surface-600-400'
                                            : 'bg-primary-500 text-white'
                                    }`}
                                >
                                    Simple
                                </span>
                                <span
                                    class={`rounded-full px-3 py-1 transition ${
                                        showFullMessageDetails
                                            ? 'bg-primary-500 text-white'
                                            : 'text-surface-600-400'
                                    }`}
                                >
                                    Detailed
                                </span>
                            </button>
                        </div>
                        <div class="w-full rounded-xl border border-surface-200-800 bg-surface-100-900/20 px-3 py-2">
                            <p class="text-[11px] uppercase tracking-[0.14em] text-surface-600-400">Subject</p>
                            <p class="mt-1 text-sm font-medium text-surface-900-100">{getConversationSubject(selectedCard)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-5 space-y-4">
                {#if selectedCard.status === 'draft' || selectedCard.status === 'error'}
                    <div class="rounded-xl border border-surface-200-800 bg-surface-100-900/20 p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p class="text-sm font-semibold">Pending draft</p>
                            <p class="mt-1 text-sm text-surface-600-400">Open the draft composer to review and send this message.</p>
                        </div>
                        <button type="button" class="btn btn-sm preset-tonal" onclick={openNewMessage}>
                            <SparklesIcon class="size-4 shrink-0" />
                            <span>Start another draft</span>
                        </button>
                    </div>
                {/if}

                {#if selectedCard.thread.messages.length}
                    <div class="space-y-4">
                        {#each selectedCard.thread.messages as message, index (message.uuid)}
                            {#if index === 0 || formatDate(message.sentAt) !== formatDate(selectedCard.thread.messages[index - 1]?.sentAt)}
                                <div class="flex items-center justify-center py-1">
                                    <span class="rounded-full border border-surface-200-800 bg-surface-100-900/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-surface-600-400">
                                        {formatDate(message.sentAt) ?? 'Unknown date'}
                                    </span>
                                </div>
                            {/if}
                            <div class={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                <article class={`max-w-[90%] rounded-2xl border p-4 ${message.direction === 'outbound' ? 'border-primary-500/30 bg-primary-500/12' : 'border-surface-200-800 bg-surface-100-900/25'}`}>
                                    <div class="flex items-start justify-between gap-4 flex-wrap">
                                        <div class="min-w-0 flex-1">
                                            <p class="text-xs text-surface-600-400">{getBubbleDisplayName(message, selectedCard)}</p>
                                            {#if showFullMessageDetails}
                                                <p class="hidden mt-1 text-[11px] text-surface-600-400 whitespace-pre-wrap break-words">
                                                    From: {message.from || '—'}{"\n"}
                                                    To: {message.to || '—'}
                                                    {message.subject ? `\nSubject: ${message.subject}` : ''}
                                                    {message.threadId ? `\nThread ID: ${message.threadId}` : ''}
                                                    {message.messageId ? `\nMessage ID: ${message.messageId}` : ''}
                                                    {message.references ? `\nReferences: ${message.references}` : ''}
                                                </p>
                                                <dl class="mt-2 grid gap-x-3 gap-y-1 text-[11px] text-surface-600-400 sm:grid-cols-[auto,minmax(0,1fr)]">
                                                    <dt class="font-medium text-surface-500-500">Sent</dt>
                                                    <dd class="min-w-0 break-words">{getMessageTimestamp(message.sentAt)}</dd>
                                                    <dt class="font-medium text-surface-500-500">From</dt>
                                                    <dd class="min-w-0 break-words">{message.from || '—'}</dd>
                                                    <dt class="font-medium text-surface-500-500">To</dt>
                                                    <dd class="min-w-0 break-words">{message.to || '—'}</dd>
                                                    {#if message.subject}
                                                        <dt class="font-medium text-surface-500-500">Subject</dt>
                                                        <dd class="min-w-0 break-words">{message.subject}</dd>
                                                    {/if}
                                                    {#if message.threadId}
                                                        <dt class="font-medium text-surface-500-500">Thread ID</dt>
                                                        <dd class="min-w-0 break-all">{message.threadId}</dd>
                                                    {/if}
                                                    {#if message.messageId}
                                                        <dt class="font-medium text-surface-500-500">Message ID</dt>
                                                        <dd class="min-w-0 break-all">{message.messageId}</dd>
                                                    {/if}
                                                    {#if message.references}
                                                        <dt class="font-medium text-surface-500-500">References</dt>
                                                        <dd class="min-w-0 break-all">{message.references}</dd>
                                                    {/if}
                                                </dl>
                                            {/if}
                                        </div>
                                        <span class="shrink-0 text-right text-xs text-surface-600-400">{getMessageTime(message.sentAt)}</span>
                                    </div>
                                    <p class="mt-3 whitespace-pre-wrap break-words text-sm">{getMessageBodyForDisplay(message)}</p>
                                </article>
                            </div>
                        {/each}
                    </div>

                    <div class="space-y-3">
                        <label class="sr-only" for="thread-reply-box">Reply</label>
                        <textarea
                            id="thread-reply-box"
                            class="textarea min-h-32 w-full"
                            value={replyBody}
                            oninput={(event) => onReplyBodyChange((event.currentTarget as HTMLTextAreaElement).value)}
                            placeholder="Write your reply..."
                        />
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex flex-wrap gap-2">
                                <button type="button" class="btn btn-sm preset-tonal" onclick={onToggleReplyRevise}>
                                    <SparklesIcon class="size-4 shrink-0" />
                                    <span>Write with AI</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                class="btn btn-sm preset-filled-primary-500"
                                disabled={sendingReply || !replyBody.trim()}
                                onclick={() => onSendReply(selectedCard)}
                            >
                                {sendingReply ? 'Sending...' : 'Send reply'}
                            </button>
                        </div>

                        {#if showReplyReviseComposer}
                            <div class="rounded-xl border border-surface-200-800 bg-surface-100-900/30 p-4 space-y-3">
                                <label class="block text-sm font-medium">
                                    What should Envoy change?
                                    <textarea
                                        class="textarea mt-2 min-h-24 w-full"
                                        value={replyReviseInstructions}
                                        oninput={(event) => onChangeReplyReviseInstructions((event.currentTarget as HTMLTextAreaElement).value)}
                                        placeholder="Make it shorter, warmer, more direct, or add missing details."
                                    />
                                </label>
                                <p class="text-xs text-surface-600-400">
                                    Use plain language here. You can be conversational, like "keep my tone but make it less stiff" or "rewrite this so it sounds confident and short."
                                </p>
                                <div class="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        class="btn btn-sm preset-filled-primary-500"
                                        disabled={revisingReplyThreadUuid === selectedCard.threadUuid || !replyReviseInstructions.trim()}
                                        onclick={() => onReviseReply(selectedCard)}
                                    >
                                        {revisingReplyThreadUuid === selectedCard.threadUuid ? 'Writing...' : 'Generate draft'}
                                    </button>
                                    <button type="button" class="btn btn-sm preset-tonal" onclick={onCancelReplyRevise}>Cancel</button>
                                </div>
                            </div>
                        {/if}

                        {#if replyRevisionSuggestedBody.trim()}
                            <div class="rounded-xl border border-primary-200-700 bg-primary-50-950/30 p-4 space-y-3">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h4 class="text-sm font-semibold">Revision preview</h4>
                                        <p class="text-xs text-surface-600-400">Your draft stays unchanged until you apply the suggestion.</p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <button type="button" class="btn btn-sm preset-filled-primary-500" onclick={onApplySuggestedReplyRevision}>
                                            Apply revision
                                        </button>
                                        <button type="button" class="btn btn-sm preset-tonal" onclick={onDismissSuggestedReplyRevision}>
                                            Keep current draft
                                        </button>
                                    </div>
                                </div>
                                <div class="grid gap-3 lg:grid-cols-2">
                                    <label class="block text-sm font-medium">
                                        Current draft
                                        <textarea class="textarea mt-2 min-h-28 w-full" value={replyRevisionOriginalBody || replyBody} readonly />
                                    </label>
                                    <label class="block text-sm font-medium">
                                        Suggested revision
                                        <textarea class="textarea mt-2 min-h-28 w-full" value={replyRevisionSuggestedBody} readonly />
                                    </label>
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else if selectedCard.status !== 'draft' && selectedCard.status !== 'error'}
                    <div class="rounded-xl border border-dashed border-surface-200-800 bg-surface-100-900/20 p-8 text-center">
                        <p class="text-sm text-surface-600-400">This thread has no synced messages yet.</p>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="p-8 text-center">
                <p class="text-base font-medium">Create your first outreach thread</p>
                <p class="mt-2 text-sm text-surface-600-400">Select a contact and start a message without leaving this project.</p>
                <button type="button" class="btn btn-sm preset-filled-primary-500 mt-4" onclick={openNewMessage}>
                    <PlusIcon class="size-4 shrink-0" />
                    <span>New message</span>
                </button>
            </div>
        {/if}
    </section>
</div>
