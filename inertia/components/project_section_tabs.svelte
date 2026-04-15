<script lang="ts">
type ProjectTab = 'convo' | 'outreach' | 'overview';

const TABS: ProjectTab[] = ['convo', 'outreach', 'overview'];

const {
    activeTab,
    onSelectTab,
}: {
    activeTab: ProjectTab;
    onSelectTab: (tab: ProjectTab) => void;
} = $props();
</script>

<div class="sticky top-0 z-10 border-b border-surface-200-800 bg-surface-50-950 px-4 py-2 sm:px-6">
    <div class="mx-auto flex w-full max-w-6xl justify-center lg:justify-end">
        <div
            role="radiogroup"
            aria-label="Page section"
            class="inline-flex rounded-xl border border-surface-200-800 bg-surface-100-900/30 p-1"
        >
            {#each TABS as tab}
                <button
                    role="radio"
                    aria-checked={activeTab === tab}
                    class={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition sm:px-4 ${
                        activeTab === tab
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'text-surface-700-300 hover:bg-surface-100-900/50'
                    }`}
                    onclick={() => onSelectTab(tab)}>
                    {tab}
                </button>
            {/each}
        </div>
    </div>
</div>
