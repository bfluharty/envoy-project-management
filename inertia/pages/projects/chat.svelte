<script lang="ts">
import Sidebar from "#components/sidebar.svelte";
import Logo from '#components/logo.svelte';
import { UserIcon } from '@lucide/svelte';
import { onMount } from 'svelte';

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isTyping?: boolean;
    isError?: boolean;
    retryPrompt?: string;
    retryVariables?: Record<string, any>;
}

const {
    project,
    hasPriorConversation,
    conversationHistory,
}: {
    project: { uuid: string; name: string };
    hasPriorConversation: boolean;
    conversationHistory: { role: 'user' | 'assistant'; content: string }[];
} = $props();

let idCounter = conversationHistory.length;
let messages = $state<ChatMessage[]>(
    conversationHistory.map((m, i) => ({ id: i, role: m.role, content: m.content }))
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

onMount(() => {
    if (!hasPriorConversation) {
        sendChat(OPENING_PROMPT, OPENING_VARIABLES);
    }
});
</script>

<svelte:head>
  <title>{`Chat - ${project.name}`}</title>
</svelte:head>

<Sidebar>

<div class="flex flex-col h-[calc(100vh-4rem)] lg:h-screen w-full bg-surface-50-950">
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

</Sidebar>
