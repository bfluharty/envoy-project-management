<script lang="ts">
  let { user } = $props<{ user: { fullName: string | null; email: string } }>()
</script>

<div class="flex items-center space-x-2">
  <div class="size-2 bg-primary-500 rounded-full motion-safe:animate-pulse" aria-hidden="true"></div>
  <p class="text-sm text-surface-600-400">
    Welcome, <span class="font-semibold text-surface-900-100">{user.fullName || user.email || 'User'}</span>
  </p>
</div>
