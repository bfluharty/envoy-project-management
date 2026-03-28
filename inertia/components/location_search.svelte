<script lang="ts">
import { onDestroy } from 'svelte';
import { CheckIcon, SearchIcon, XIcon } from '@lucide/svelte';

export interface LocationData {
    city: string;
    state: string;
    formatted_address: string;
    lat: number | null;
    lon: number | null;
}

interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
    address: {
        house_number?: string;
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
    };
}

let {
    value = null,
    id = 'location-search',
    onchange,
}: {
    value?: LocationData | null;
    id?: string;
    onchange: (loc: LocationData | null) => void;
} = $props();

let inputEl = $state<HTMLInputElement | null>(null);
let query = $state('');
let results = $state<NominatimResult[]>([]);
let isOpen = $state(false);
let loading = $state(false);
let fetchError = $state<string | null>(null);
let activeIndex = $state(-1);
let isConfirmed = $state(false);

let timerId: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;

const listboxId = `location-listbox-${id}`;

// Sync display string when parent resets or changes value (only when dropdown is closed)
$effect(() => {
    if (!isOpen) {
        query = value?.formatted_address ?? value?.city ?? '';
        isConfirmed = value !== null;
    }
});

let statusMsg = $derived(
    loading
        ? 'Searching…'
        : isOpen && results.length > 0
            ? `${results.length} location${results.length === 1 ? '' : 's'} available`
            : isOpen && results.length === 0 && !loading
                ? 'No results found'
                : ''
);

function getDisplayName(result: NominatimResult): string {
    const a = result.address;
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = a.city ?? a.town ?? a.village ?? a.suburb ?? '';
    const parts = [street, city, a.state].filter(Boolean);
    return parts.join(', ');
}

function onInput() {
    isConfirmed = false;
    fetchError = null;
    clearTimeout(timerId!);
    if (query.trim().length < 2) {
        results = [];
        isOpen = false;
        return;
    }
    timerId = setTimeout(async () => {
        controller?.abort();
        controller = new AbortController();
        loading = true;
        isOpen = true;
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=us`,
                { signal: controller.signal }
            );
            const data: NominatimResult[] = await res.json();
            if (query.trim().length >= 2) {
                results = data;
                activeIndex = -1;
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                fetchError = 'Search unavailable — save without a location or try again.';
                results = [];
                isOpen = false;
            }
        } finally {
            loading = false;
        }
    }, 400);
}

function selectResult(result: NominatimResult) {
    const city = result.address.city ?? result.address.town ?? result.address.village ?? result.address.county ?? '';
    const state = result.address.state ?? '';
    const loc: LocationData = {
        city,
        state,
        formatted_address: getDisplayName(result),
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
    };
    query = loc.formatted_address;
    isConfirmed = true;
    results = [];
    isOpen = false;
    activeIndex = -1;
    onchange(loc);
    inputEl?.focus();
}

function saveAsEntered() {
    const loc: LocationData = {
        city: query.trim(),
        state: '',
        formatted_address: query.trim(),
        lat: null,
        lon: null,
    };
    isConfirmed = true;
    results = [];
    isOpen = false;
    onchange(loc);
    inputEl?.focus();
}

function clearLocation() {
    query = '';
    isConfirmed = false;
    results = [];
    isOpen = false;
    activeIndex = -1;
    fetchError = null;
    clearTimeout(timerId!);
    controller?.abort();
    onchange(null);
    inputEl?.focus();
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen && results.length > 0) { isOpen = true; return; }
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        scrollOptionIntoView();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        scrollOptionIntoView();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isOpen && activeIndex >= 0 && results[activeIndex]) {
            selectResult(results[activeIndex]);
        } else if (isOpen && query.trim().length >= 2) {
            saveAsEntered();
        }
    } else if (e.key === 'Escape') {
        if (isOpen) {
            e.stopPropagation();
            isOpen = false;
            activeIndex = -1;
        }
    } else if (e.key === 'Tab') {
        isOpen = false;
        activeIndex = -1;
    }
}

function scrollOptionIntoView() {
    if (activeIndex < 0) return;
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
}

function onDocumentClick(e: MouseEvent) {
    const wrapper = document.getElementById(`${listboxId}-wrapper`);
    if (wrapper && !wrapper.contains(e.target as Node)) {
        isOpen = false;
        activeIndex = -1;
    }
}

$effect(() => {
    document.addEventListener('click', onDocumentClick, true);
    return () => {
        document.removeEventListener('click', onDocumentClick, true);
    };
});

onDestroy(() => {
    clearTimeout(timerId!);
    controller?.abort();
});
</script>

<div id="{listboxId}-wrapper" class="relative">
    <div class="relative flex items-center">
        <span class="absolute left-3 text-surface-400 pointer-events-none" aria-hidden="true">
            {#if isConfirmed}
                <CheckIcon class="size-4 text-primary-500" />
            {:else}
                <SearchIcon class="size-4" />
            {/if}
        </span>

        <input
            bind:this={inputEl}
            {id}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            bind:value={query}
            oninput={onInput}
            onkeydown={onKeydown}
            placeholder="Search city or address…"
            class="input w-full pl-9 {value !== null ? 'pr-9' : ''}"
            autocomplete="off" />

        {#if value !== null}
            <button
                type="button"
                aria-label="Clear location"
                class="absolute right-2 top-1/2 -translate-y-1/2 btn-icon btn-icon-sm preset-tonal"
                onclick={clearLocation}>
                <XIcon class="size-3" aria-hidden="true" />
            </button>
        {/if}
    </div>

    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">{statusMsg}</div>

    {#if fetchError}
        <p class="text-error-500 text-sm mt-1">{fetchError}</p>
    {/if}

    {#if isOpen || loading}
        <ul
            id={listboxId}
            role="listbox"
            aria-label="Location suggestions"
            class="absolute z-50 left-0 right-0 card bg-surface-100-900 shadow-md mt-1 max-h-60 overflow-auto">
            {#if loading}
                <li class="px-3 py-2 text-surface-400 text-sm italic" aria-hidden="true">Searching…</li>
            {:else if results.length === 0}
                <li class="px-3 py-2 text-surface-400 text-sm italic">No results found</li>
                <li class="px-3 pb-2">
                    <button
                        type="button"
                        class="btn btn-sm preset-tonal w-full justify-start"
                        onclick={saveAsEntered}>
                        Save "{query}" as entered
                    </button>
                </li>
            {:else}
                {#each results as result, i}
                    <li
                        id="{listboxId}-opt-{i}"
                        role="option"
                        aria-selected={activeIndex === i}
                        class="min-h-[44px] flex items-center px-3 py-2 cursor-pointer select-none
                               {activeIndex === i
                                   ? 'bg-primary-500/20 border-l-2 border-primary-500'
                                   : 'hover:bg-surface-200-800'}"
                        onmousedown={(e) => { e.preventDefault(); selectResult(result); }}>
                        <span class="text-sm">{getDisplayName(result)}</span>
                    </li>
                {/each}
            {/if}
        </ul>
    {/if}
</div>
