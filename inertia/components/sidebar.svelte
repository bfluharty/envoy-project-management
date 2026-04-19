<script lang="ts">
import { FolderIcon, HouseIcon, Settings2Icon, PlusIcon, XIcon, MenuIcon, UsersIcon, LogOutIcon } from "@lucide/svelte";
import Logo from './logo.svelte';
import { Navigation } from "@skeletonlabs/skeleton-svelte";
import { router, page } from '@inertiajs/svelte'
import { showNewProjectForm } from '../stores/ui';
import UserStatus from './user_status.svelte';

const { children } = $props();

const user = $derived($page.props.user);
const projects = $derived($page.props.projects || []);

let drawerOpen = $state(false);
let dialogEl = $state<HTMLDialogElement | null>(null);

$effect(() => {
	if (!dialogEl) return;
	if (drawerOpen) {
		dialogEl.showModal();
	} else if (dialogEl.open) {
		dialogEl.close();
	}
});

function toggleDrawer() {
	drawerOpen = !drawerOpen;
}

function closeDrawer() {
	drawerOpen = false;
}

function handleDialogClose() {
	drawerOpen = false;
}

const isFormVisible = $derived($showNewProjectForm);

function handleNewProject() {
	router.visit('/dashboard', {
		onSuccess: () => {
			showNewProjectForm.set(true);
			closeDrawer();
		}
	});
}

const _linksSidebar = $derived({
	projects: projects.map((project: any) => ({
		label: project.title,
		href: `/projects/${project.uuid}`,
		icon: FolderIcon
	}))
});

const currentPath = $derived($page.url);
const _anchorBase = "btn justify-start px-2 w-full";

function getNavClasses(href: string, exactMatch: boolean = false): string {
	if (href === '/dashboard' && isFormVisible) {
		return `${_anchorBase} hover:preset-tonal`;
	}
	const isActive = exactMatch
		? currentPath === href
		: currentPath === href || currentPath.startsWith(href + '/');
	return isActive
		? `${_anchorBase} preset-filled-primary-500`
		: `${_anchorBase} hover:preset-tonal`;
}

const newProjectClasses = $derived(
	isFormVisible
		? `${_anchorBase} preset-filled-primary-500`
		: `${_anchorBase} hover:preset-tonal`
);

let isLoggingOut = $state(false);

function handleLogout() {
	isLoggingOut = true;
	router.post('/logout', {}, {
		onFinish: () => {
			isLoggingOut = false;
		},
		onError: () => {
			isLoggingOut = false;
		}
	});
}
</script>

{#snippet navContent()}
	<Navigation.Header>
		<a href="/" class="btn-icon btn-icon-lg hidden md:inline-block" onclick={closeDrawer}>
			<Logo class="size-6" />
		</a>
	</Navigation.Header>
	<Navigation.Content>
		<Navigation.Group>
			<Navigation.Menu>
				<a href="/dashboard" class={getNavClasses('/dashboard')} onclick={closeDrawer}>
					<HouseIcon class="size-4 shrink-0" />
					<span class="truncate">Dashboard</span>
				</a>
				<a href="/contacts" class={getNavClasses('/contacts')} onclick={closeDrawer}>
					<UsersIcon class="size-4 shrink-0" />
					<span class="truncate">Contacts</span>
				</a>
				<button onclick={() => { handleNewProject(); closeDrawer(); }} class={newProjectClasses}>
					<PlusIcon class="size-4 shrink-0" />
					<span class="truncate">New Project</span>
				</button>
			</Navigation.Menu>
		</Navigation.Group>
		{#each Object.entries(_linksSidebar) as [category, links]}
			<Navigation.Group>
				<Navigation.Label class="capitalize pl-2">{category}</Navigation.Label>
				<Navigation.Menu>
					{#each links as link (link)}
						{@const Icon = link.icon}
						<a
							href={link.href}
							class={getNavClasses(link.href)}
							title={link.label}
							aria-label={link.label}
							onclick={closeDrawer}
						>
							<Icon class="size-4 shrink-0" />
							<span class="truncate min-w-0">{link.label}</span>
						</a>
					{/each}
				</Navigation.Menu>
			</Navigation.Group>
		{/each}
	</Navigation.Content>
	<Navigation.Footer>
		{#if user}
			<div class="px-2 py-2 border-t border-surface-200-800">
				<UserStatus {user} />
			</div>
		{/if}
		<div class="grid grid-cols-2 gap-2">
			<a href="/account" class={getNavClasses('/account', true)} onclick={closeDrawer}>
				<Settings2Icon class="size-4 shrink-0" />
				<span class="truncate">Account</span>
			</a>
			<button
				onclick={() => { handleLogout(); closeDrawer(); }}
				disabled={isLoggingOut}
				class="{_anchorBase} hover:preset-tonal disabled:opacity-50"
			>
				<LogOutIcon class="size-4 shrink-0" />
				<span class="truncate">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
			</button>
		</div>
	</Navigation.Footer>
{/snippet}

<!-- Mobile Header -->
<header class="lg:hidden fixed top-0 left-0 right-0 z-50 navbar bg-surface-50-950/85 backdrop-blur-md border-b border-surface-200-800 px-6 py-3 flex items-center justify-between">
	<a href="/" class="btn-icon btn-icon-lg">
		<Logo class="size-6" />
	</a>
	<button
		onclick={toggleDrawer}
		class="btn-icon btn-icon-lg hover:preset-tonal-surface transition-all duration-200"
		aria-label="Toggle menu"
		aria-expanded={drawerOpen}
		aria-controls="mobile-nav"
	>
		{#if drawerOpen}
			<XIcon class="size-6" />
		{:else}
			<MenuIcon class="size-6" />
		{/if}
	</button>
</header>

<!-- Mobile Navigation Dialog — blocks VoiceOver from content behind it -->
<dialog
	id="mobile-nav"
	bind:this={dialogEl}
	class="lg:hidden"
	onclose={handleDialogClose}
	onclick={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}
	aria-label="Navigation menu"
>
	<Navigation
		layout="sidebar"
		class="h-full w-full grid grid-rows-[auto_1fr_auto] gap-4 bg-surface-50-950/85 backdrop-blur-md border-r border-surface-200-800 overflow-y-auto px-4"
	>
		{@render navContent()}
	</Navigation>
</dialog>

<div class="w-full min-h-dvh lg:grid lg:grid-cols-[auto_1fr]" style="--mobile-header-height: 4.5rem;">
	<!-- Desktop Sidebar -->
	<Navigation
		layout="sidebar"
		class="hidden lg:grid sticky top-0 h-dvh! grid-rows-[auto_1fr_auto] gap-4 bg-surface-50-950 border-r border-surface-200-800 overflow-y-auto px-4"
	>
		{@render navContent()}
	</Navigation>

	<!-- Main Content -->
	<main class="flex min-h-0 min-w-0 flex-col items-stretch justify-start pt-[var(--mobile-header-height)] lg:pt-0 min-h-[calc(100dvh-var(--mobile-header-height)-1px)] lg:min-h-dvh box-border overflow-y-auto">
		{@render children()}
	</main>
</div>

<style>
	dialog {
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		width: 85vw;
		max-width: 22rem;
		height: 100dvh;
		max-height: 100dvh;
		top: 0;
		left: 0;
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
		animation: fade-in 200ms ease-out;
	}

	dialog[open] {
		animation: slide-in 250ms ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		dialog::backdrop,
		dialog[open] {
			animation: none;
		}
	}

	@keyframes slide-in {
		from { transform: translateX(-100%); }
		to { transform: translateX(0); }
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
