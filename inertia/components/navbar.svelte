<script lang="ts">
import { router, page, Link } from '@inertiajs/svelte'
import { HouseIcon, LogOutIcon } from '@lucide/svelte'
import Logo from './logo.svelte';

const props = $props<{ showGuestCta?: boolean }>();
const showGuestCta = $derived(props.showGuestCta ?? true);
const user = $derived($page.props.user);
const isDashboard = $derived($page.url.startsWith('/dashboard'));
const isLogin = $derived($page.url.startsWith('/login'));
const isRegister = $derived($page.url.startsWith('/register'));
let isLoggingOut = $state(false);

function handleLogout() {
  isLoggingOut = true
  router.post('/logout', {}, {
    onFinish: () => { isLoggingOut = false },
    onError: () => { isLoggingOut = false },
  })
}
</script>

<nav aria-label="Site" class="navbar bg-surface-100-900 border-b border-surface-200-800 px-4 sm:px-6 py-3 flex justify-between items-center w-full overflow-x-clip">
  <a href="/" aria-label="Home" class="inline-flex">
    <Logo class="size-6" />
  </a>
  <div class="navbar-end flex items-center ml-auto min-w-0">
    {#if user}
      <div class="flex items-center gap-2">
      <Link
        href="/dashboard"
        aria-current={isDashboard ? 'page' : undefined}
        class="btn btn-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {isDashboard ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
      >
        <HouseIcon class="size-4" />
        <span class="hidden sm:inline">Dashboard</span>
      </Link>
      <button
        onclick={handleLogout}
        disabled={isLoggingOut}
        class="btn btn-sm hover:preset-tonal transition-all duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        <LogOutIcon class="size-4" />
        <span class="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
      </button>
      </div>
    {:else if showGuestCta}
      <div class="flex flex-wrap justify-end gap-1.5">
      <a
        href="/login"
        aria-current={isLogin ? 'page' : undefined}
        class="btn btn-sm px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {isLogin ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
      >
        Sign In
      </a>
      <a
        href="/register"
        aria-current={isRegister ? 'page' : undefined}
        class="btn btn-sm px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {isRegister ? 'preset-filled-primary-500' : 'preset-outlined-primary-500'}"
      >
        Create Account
      </a>
      </div>
    {/if}
  </div>
</nav>
