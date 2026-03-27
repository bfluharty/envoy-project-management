<script lang="ts">
import { FolderIcon, HouseIcon, DatabaseIcon, LogOutIcon, PlusIcon, XIcon, MenuIcon, MailIcon, UsersIcon } from "@lucide/svelte";
import Logo from './logo.svelte';
import { Navigation } from "@skeletonlabs/skeleton-svelte";
import { router, page } from '@inertiajs/svelte'
import { showNewProjectForm } from '../stores/ui';

const { children } = $props();

// Access user and projects from global Inertia shared data
const user = $derived($page.props.user);
const projects = $derived($page.props.projects || []);

// Drawer state for mobile
let drawerOpen = $state(false);

function toggleDrawer() {
	drawerOpen = !drawerOpen;
}

function closeDrawer() {
	drawerOpen = false;
}

const isFormVisible = $derived($showNewProjectForm);

function handleNewProject() {
	// Navigate to dashboard and show the form
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

// Get current path for active state (Inertia's $page.url is a string)
const currentPath = $derived($page.url);

// Base styles for sidebar links
const _anchorBase = "btn justify-start px-2 w-full";

// Helper to get classes for nav items with active state
function getNavClasses(href: string, exactMatch: boolean = false): string {
	// Don't highlight dashboard when form is visible
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

// Get classes for new project button
const newProjectClasses = $derived(
	isFormVisible 
		? `${_anchorBase} preset-filled-primary-500`
		: `${_anchorBase} hover:preset-tonal`
);

function handleLogout() {
	router.post('/logout')
}
</script>

<!-- Mobile Header -->
<header class="lg:hidden fixed top-0 left-0 right-0 z-50 navbar bg-surface-100-900 border-b border-surface-200-800 px-6 py-3 flex items-center justify-between">
	<a href="/" class="btn-icon btn-icon-lg preset-filled-primary-500">
		<Logo class="size-6" />
	</a>
	<button
		onclick={toggleDrawer}
		class="btn-icon btn-icon-lg hover:preset-tonal-surface transition-all duration-200"
		aria-label="Toggle menu"
	>
		{#if drawerOpen}
			<XIcon class="size-6" />
		{:else}
			<MenuIcon class="size-6" />
		{/if}
	</button>
</header>

<!-- Mobile Drawer Backdrop -->
{#if drawerOpen}
	<button
		class="lg:hidden fixed inset-0 z-40 bg-black/50"
		onclick={closeDrawer}
		aria-label="Close menu"
	></button>
{/if}

<div class="w-full min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
	<!-- Sidebar Navigation -->
	<Navigation 
		layout="sidebar" 
		class="fixed lg:sticky top-0 left-0 z-50 h-screen w-64 lg:w-auto grid grid-rows-[auto_1fr_auto] gap-4 bg-surface-50-950 border-r border-surface-200-800 overflow-y-auto transform transition-transform duration-300 ease-in-out {drawerOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 px-4"
	>
		<Navigation.Header>
			<a
				href="/"
				class="btn-icon btn-icon-lg preset-filled-primary-500"
				onclick={closeDrawer}
			>
				<Logo class="size-6" />
			</a>
		</Navigation.Header>
		<Navigation.Content>
			<Navigation.Group>
				<Navigation.Menu>
					<a href="/dashboard" class={getNavClasses('/dashboard')} onclick={closeDrawer}>
						<HouseIcon class="size-4" />
						<span>Dashboard</span>
					</a>
					<a href="/contacts" class={getNavClasses('/contacts')} onclick={closeDrawer}>
						<UsersIcon class="size-4" />
						<span>Contacts</span>
					</a>
					<a href="/projects" class={getNavClasses('/projects', true)} onclick={closeDrawer}>
						<DatabaseIcon class="size-4" />
						<span>Projects <span class="text-xs">(JSON)</span></span>
					</a>
					<a href="/inbox/emails" class={getNavClasses('/inbox/emails')} onclick={closeDrawer}>
						<MailIcon class="size-4" />
						<span>Inbox</span>
					</a>
					<button onclick={() => { handleNewProject(); closeDrawer(); }} class={newProjectClasses}>
						<PlusIcon class="size-4" />
						<span>New Project</span>
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
								<Icon class="size-4" />
								<span>{link.label}</span>
							</a>
						{/each}
					</Navigation.Menu>
				</Navigation.Group>
			{/each}
		</Navigation.Content>
		<Navigation.Footer>
			{#if user}
				<div class="px-2 py-2 border-t border-surface-200-800 flex items-center space-x-2">
					<div class="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
					<p class="text-sm text-light text-surface-200">
						Welcome, <span class="font-semibold text-surface-900-100">{user.fullName || user.email || 'User'}</span>
					</p>
				</div>
			{/if}
			<button
				onclick={() => { handleLogout(); closeDrawer(); }}
				class="{_anchorBase} hover:preset-tonal"
				title="Logout"
				aria-label="Logout"
			>
				<LogOutIcon class="size-4" />
				<span>Logout</span>
			</button>
		</Navigation.Footer>
	</Navigation>

	<!-- Main Content -->
	<main class="flex justify-center items-center flex-col pt-16 lg:pt-0 min-h-screen overflow-y-auto">
		{@render children()}
	</main>
</div>
