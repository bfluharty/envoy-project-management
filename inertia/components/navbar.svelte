<script lang="ts">
import { router, page } from '@inertiajs/svelte'
import { HouseIcon, LogOutIcon } from '@lucide/svelte'

const user = $derived($page.props.user);

function handleLogout() {
	router.post('/logout')
}
</script>

{#if user}
<nav class="navbar bg-surface-100-900 border-b border-surface-200-800 px-6 py-3 flex justify-between items-center w-full">
  <div class="flex items-center space-x-2">
    <div class="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
    <p class="text-sm text-light text-surface-200">
      Welcome, <span class="font-semibold text-surface-900-100">{user.fullName || user.email || 'User'}</span>
    </p>
  </div>
  <div class="navbar-end flex space-x-2 items-center">
      <a href="/dashboard" 
         class="btn btn-sm hover:preset-tonal-surface transition-all duration-200">
        <HouseIcon class="w-4 h-4" />
        <span>Dashboard</span>
      </a>
      <button onclick={handleLogout} 
              class="btn btn-sm hover:preset-tonal-surface transition-all duration-200">
        <LogOutIcon class="w-4 h-4 transition-transform duration-200" />
        <span>Logout</span>
      </button>
  </div>
</nav>
{/if}