<script lang="ts">
import type { Snippet } from 'svelte';
import ProjectSectionTabs from '#components/project_section_tabs.svelte';

type ProjectTab = 'convo' | 'outreach' | 'overview';

const {
    activeTab,
    onSelectTab,
    sectionLabel,
    projectName,
    description,
    note = null,
    actions,
}: {
    activeTab: ProjectTab;
    onSelectTab: (tab: ProjectTab) => void;
    sectionLabel: string;
    projectName: string;
    description: string;
    note?: string | null;
    actions?: Snippet;
} = $props();
</script>

<header class="border-b border-surface-200-800 bg-surface-50-950/40 backdrop-blur-md">
    <div class="px-4 py-4 sm:px-6 sm:py-5">
        <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
                <p class="text-xs uppercase tracking-[0.18em] text-surface-600-400">{sectionLabel}</p>
                <h1 class="mt-2 text-base font-semibold sm:text-2xl">{projectName}</h1>
                <p class="mt-2 text-sm text-surface-600-400">{description}</p>
                {#if note}
                    <p class="mt-2 text-xs text-surface-600-400">{note}</p>
                {/if}
            </div>

            {#if actions}
                <div class="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                    {@render actions()}
                </div>
            {/if}
        </div>
    </div>
</header>

<ProjectSectionTabs activeTab={activeTab} onSelectTab={onSelectTab} />
