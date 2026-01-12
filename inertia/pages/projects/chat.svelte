<script lang="ts">
import Sidebar from "#components/sidebar.svelte";
import Logo from '#components/logo.svelte';

export let project: { uuid?: string, name?: string };
console.log('Project prop:', project);
// Message type
interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
}

let messages: Message[] = [
    { id: 1, role: 'assistant', content: `Hello! How can I help you with project "${project.name}"?` }
];
let input = '';
let nextId = 2;

function sendMessage() {
    if (!input.trim()) return;
    messages = [...messages, { id: nextId++, role: 'user', content: input }];
    input = '';
    // Simulate assistant response
    setTimeout(() => {
        messages = [...messages, {
            id: nextId++,
            role: 'assistant',
            content: 'This is a simulated response.'
        }];
    }, 800);
}
</script>

<svelte:head>
  <title>{`Chat - ${project.name}`}</title>
</svelte:head>

<Sidebar>

<div class="flex flex-col h-full w-full bg-surface-50-950">
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#each messages as msg (msg.id)}
            <div class="flex items-start gap-2" class:justify-end={msg.role === 'user'}>
                {#if msg.role === 'assistant'}
                    <div class="avatar size-8">
                        <Logo class="size-8" />
                    </div>
                {/if}
                <div class="card max-w-lg p-3 text-sm"
                    class:preset-filled-surface-100-900={msg.role === 'assistant'}
                    class:preset-filled-primary-500={msg.role === 'user'}>
                    {msg.content}
                </div>
                {#if msg.role === 'user'}
                    <div class="avatar size-8">
                        <img src="https://i.pravatar.cc/40?img=12" alt="You" class="rounded-full" />
                    </div>
                {/if}
            </div>
        {/each}
    </div>
    <form class="p-4 flex gap-2 border-t border-surface-200-800 bg-surface-100-900" on:submit|preventDefault={sendMessage}>
        <input class="input flex-1" type="text" bind:value={input} placeholder="Type your message..." autocomplete="off" />
        <button class="btn preset-filled-primary-500" type="submit">Send</button>
    </form>
</div>

</Sidebar>
