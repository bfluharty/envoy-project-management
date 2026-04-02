<script lang="ts">
  import UserAvatar, { type AvatarData } from './user_avatar.svelte'

  let {
    user,
  } = $props<{ user: { fullName: string | null; email: string; avatar?: AvatarData | null } }>()

  function getInitials(fullName: string | null, email: string) {
    const name = fullName?.trim()
    if (name) {
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    }

    return (email[0] || 'U').toUpperCase()
  }

  const resolvedAvatar = $derived(
    user.avatar ?? {
      url: null,
      source: 'generated',
      initials: getInitials(user.fullName, user.email),
      displayName: user.fullName || user.email || 'User',
    }
  )
</script>

<div class="flex items-center gap-3">
  <UserAvatar avatar={resolvedAvatar} size="md" testId="sidebar-user-avatar" />
  <div class="min-w-0">
    <p class="truncate text-sm font-semibold text-surface-900-100">
      {user.fullName || user.email || 'User'}
    </p>
    <p class="truncate text-xs text-surface-600-400">{user.email}</p>
  </div>
</div>
