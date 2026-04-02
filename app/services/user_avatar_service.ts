import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/bodyparser'
import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import type User from '#models/user'

export type UserAvatarSource = 'upload' | 'google' | 'generated'

export interface UserAvatar {
  url: string | null
  source: UserAvatarSource
  initials: string
  displayName: string
}

export interface AuthenticatedUserPayload {
  uuid: string
  fullName: string | null
  email: string
  avatar: UserAvatar
}

const AVATAR_UPLOADS_PREFIX = '/uploads/avatars/'
const GOOGLE_AVATAR_PROXY_PATH = '/account/avatar/google'

type AvatarUserLike = Pick<
  User,
  'uuid' | 'fullName' | 'email' | 'googleAvatarUrl' | 'uploadedAvatarPath'
>

function normalizePath(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getUploadUrl(uploadedAvatarPath: string | null | undefined): string | null {
  const normalizedPath = normalizePath(uploadedAvatarPath)
  if (!normalizedPath) {
    return null
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

function getDisplayName(user: Pick<AvatarUserLike, 'fullName' | 'email'>): string {
  const fullName = normalizePath(user.fullName)
  if (fullName) {
    return fullName
  }

  return user.email.split('@')[0] || user.email
}

export function getUserInitials(user: Pick<AvatarUserLike, 'fullName' | 'email'>): string {
  const fullName = normalizePath(user.fullName)
  if (fullName) {
    const initials = fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')

    if (initials) {
      return initials
    }
  }

  const emailName = user.email.split('@')[0]?.replace(/[^a-zA-Z0-9]+/g, ' ') ?? ''
  const emailInitials = emailName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return emailInitials || 'U'
}

export function buildUserAvatar(user: AvatarUserLike): UserAvatar {
  const uploadedAvatarUrl = getUploadUrl(user.uploadedAvatarPath)
  const googleAvatarUrl = normalizePath(user.googleAvatarUrl)

  if (uploadedAvatarUrl) {
    return {
      url: uploadedAvatarUrl,
      source: 'upload',
      initials: getUserInitials(user),
      displayName: getDisplayName(user),
    }
  }

  if (googleAvatarUrl) {
    return {
      url: GOOGLE_AVATAR_PROXY_PATH,
      source: 'google',
      initials: getUserInitials(user),
      displayName: getDisplayName(user),
    }
  }

  return {
    url: null,
    source: 'generated',
    initials: getUserInitials(user),
    displayName: getDisplayName(user),
  }
}

export function serializeAuthenticatedUser(user: AvatarUserLike): AuthenticatedUserPayload {
  return {
    uuid: user.uuid,
    fullName: normalizePath(user.fullName),
    email: user.email,
    avatar: buildUserAvatar(user),
  }
}

export function getAvatarUploadDirectory(userUuid: string): string {
  return app.makePath('public', 'uploads', 'avatars', userUuid)
}

export function toUploadedAvatarPath(userUuid: string, fileName: string): string {
  return `${AVATAR_UPLOADS_PREFIX}${userUuid}/${fileName}`
}

export function getUploadedAvatarDiskPath(uploadedAvatarPath: string | null | undefined): string | null {
  const normalizedPath = getUploadUrl(uploadedAvatarPath)
  if (!normalizedPath || !normalizedPath.startsWith(AVATAR_UPLOADS_PREFIX)) {
    return null
  }

  const publicSegments = normalizedPath.replace(/^\//, '').split('/').filter(Boolean)
  if (publicSegments.length === 0) {
    return null
  }

  return app.makePath('public', ...publicSegments)
}

export async function storeUploadedAvatar(user: Pick<AvatarUserLike, 'uuid'>, file: MultipartFile) {
  const extension = file.extname || 'bin'
  const fileName = `${randomUUID()}.${extension}`

  await file.move(getAvatarUploadDirectory(user.uuid), {
    name: fileName,
    overwrite: true,
  })

  return {
    fileName,
    uploadedAvatarPath: toUploadedAvatarPath(user.uuid, fileName),
  }
}

export async function deleteUploadedAvatar(uploadedAvatarPath: string | null | undefined) {
  const diskPath = getUploadedAvatarDiskPath(uploadedAvatarPath)
  if (!diskPath) {
    return
  }

  try {
    await unlink(diskPath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}
