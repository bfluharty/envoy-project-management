<script lang="ts">
import { FolderIcon, HouseIcon, DatabaseIcon, LogOutIcon } from "@lucide/svelte";
import Logo from './logo.svelte';
import { Navigation } from "@skeletonlabs/skeleton-svelte";
import { router, page } from '@inertiajs/svelte'

const { children } = $props();

// Access user and projects from global Inertia shared data
const user = $derived($page.props.user);
const projects = $derived($page.props.projects || []);

const _linksSidebar = $derived({
	projects: projects.map((project: any) => ({
		label: project.title,
		href: `/projects/${project.uuid}`,
		icon: FolderIcon
	}))
});

const _anchorSidebar = "btn hover:preset-tonal justify-start px-2 w-full";

function handleLogout() {
	router.post('/logout')
}
</script>

<div
	class="w-full min-h-screen grid grid-cols-[auto_1fr] items-stretch border border-surface-200-800"
>
	<Navigation layout="sidebar" class="grid grid-rows-[auto_1fr_auto] gap-4">
		<Navigation.Header>
			<a
				href="/"
				class="btn-icon btn-icon-lg preset-filled-primary-500 "
			>
				<Logo class="size-6" />
			</a>
		</Navigation.Header>
		<Navigation.Content>
			<Navigation.Group>
				<Navigation.Menu>
					<a href="/dashboard" class={_anchorSidebar}>
						<HouseIcon class="size-4" />
						<span>Dashboard</span>
					</a>
					<a href="/projects" class={_anchorSidebar}>
						<DatabaseIcon class="size-4" />
						<span>Projects <span class="text-xs">(JSON)</span></span>
					</a>
				</Navigation.Menu>
			</Navigation.Group>
			{#each Object.entries(_linksSidebar) as [category, links]}
				<Navigation.Group>
					<Navigation.Label class="capitalize pl-2"
						>{category}</Navigation.Label
					>
					<Navigation.Menu>
						{#each links as link (link)}
							{@const Icon = link.icon}
							<a
								href={link.href}
								class={_anchorSidebar}
								title={link.label}
								aria-label={link.label}
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
				onclick={handleLogout}
				class={_anchorSidebar}
				title="Logout"
				aria-label="Logout"
			>
				<LogOutIcon class="size-4" />
				<span>Logout</span>
			</button>
		</Navigation.Footer>
	</Navigation>
	<!-- --- -->
	<div class="flex justify-center items-center flex-col">
		{@render children()}
	</div>
</div>
