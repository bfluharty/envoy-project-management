<script lang="ts">
import { FolderIcon, HouseIcon, SettingsIcon } from "@lucide/svelte";
import Logo from './logo.svelte';
import { Navigation } from "@skeletonlabs/skeleton-svelte";

const { children } = $props();

const _linksSidebar = {
	projects: [
		{ label: "Weekend Plans", href: "/projects/1", icon: FolderIcon },
		{ label: "Recipe Ideas", href: "/projects/2", icon: FolderIcon },
		{ label: "Travel Advice", href: "/projects/3", icon: FolderIcon },
		{ label: "Book Recommendations", href: "/projects/4", icon: FolderIcon },
		{ label: "Workout Tips", href: "/projects/5", icon: FolderIcon },
	],
};

const _anchorSidebar = "btn hover:preset-tonal justify-start px-2 w-full";
</script>

<div
	class="w-full min-h-screen grid grid-cols-[auto_1fr] items-stretch border border-surface-200-800"
>
	<Navigation layout="sidebar" class="grid grid-rows-[auto_1fr_auto] gap-4">
		<Navigation.Header>
			<a
				href="https://www.skeleton.dev"
				class="btn-icon btn-icon-lg preset-filled-primary-500"
			>
				<Logo class="size-6" />
			</a>
		</Navigation.Header>
		<Navigation.Content>
			<Navigation.Group>
				<Navigation.Menu>
					<a href="/" class={_anchorSidebar}>
						<HouseIcon class="size-4" />
						<span>Dashboard</span>
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
			<a
				href="/"
				class={_anchorSidebar}
				title="Settings"
				aria-label="Settings"
			>
				<SettingsIcon class="size-4" />
				<span>Settings</span>
			</a>
		</Navigation.Footer>
	</Navigation>
	<!-- --- -->
	<div class="flex justify-center items-center flex-col">
		{@render children()}
	</div>
</div>
