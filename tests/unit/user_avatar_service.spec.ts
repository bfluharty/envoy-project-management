import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import {
  buildUserAvatar,
  getUploadedAvatarDiskPath,
  getUserInitials,
  serializeAuthenticatedUser,
  toUploadedAvatarPath,
} from '#services/user_avatar_service'

function user(overrides: Partial<any> = {}) {
  return {
    uuid: 'user-uuid',
    fullName: null,
    email: 'user@example.com',
    uploadedAvatarPath: null,
    googleAvatarUrl: null,
    ...overrides,
  } as any
}

test.group('getUserInitials', () => {
  test('two-letter initials from two-word name', () => {
    assert.equal(getUserInitials(user({ fullName: 'Alice Example' })), 'AE')
  })

  test('caps at two letters for long names', () => {
    assert.equal(getUserInitials(user({ fullName: 'Alice Beth Carol Example' })), 'AB')
  })

  test('single-word name yields single initial', () => {
    assert.equal(getUserInitials(user({ fullName: 'Cher' })), 'C')
  })

  test('whitespace-only name falls back to email-derived initials', () => {
    assert.equal(getUserInitials(user({ fullName: '   ', email: 'ryan.menner@example.com' })), 'RM')
  })

  test('null name falls back to email', () => {
    assert.equal(getUserInitials(user({ fullName: null, email: 'ryan@example.com' })), 'R')
  })

  test('email with dots and underscores produces multi-part initials', () => {
    assert.equal(getUserInitials(user({ fullName: null, email: 'envoy.ryan@example.com' })), 'ER')
  })

  test('email with no letters falls back to U', () => {
    assert.equal(getUserInitials(user({ fullName: null, email: '@example.com' })), 'U')
  })

  test('uppercases lowercase first letters', () => {
    assert.equal(getUserInitials(user({ fullName: 'alice example' })), 'AE')
  })
})

test.group('serializeAuthenticatedUser', () => {
  test('exposes uuid, fullName, email, and avatar', () => {
    const payload = serializeAuthenticatedUser(
      user({ fullName: 'Alice Example', email: 'alice@example.com' })
    )

    assert.equal(payload.uuid, 'user-uuid')
    assert.equal(payload.fullName, 'Alice Example')
    assert.equal(payload.email, 'alice@example.com')
    assert.equal(payload.avatar.source, 'generated')
    assert.equal(payload.avatar.initials, 'AE')
    assert.equal(payload.avatar.displayName, 'Alice Example')
  })

  test('normalizes whitespace-only fullName to null', () => {
    const payload = serializeAuthenticatedUser(user({ fullName: '   ' }))
    assert.equal(payload.fullName, null)
  })

  test('avatar reflects uploaded path when present', () => {
    const payload = serializeAuthenticatedUser(
      user({ uploadedAvatarPath: '/uploads/avatars/user-uuid/x.png' })
    )
    assert.equal(payload.avatar.source, 'upload')
    assert.equal(payload.avatar.url, '/uploads/avatars/user-uuid/x.png')
  })
})

test.group('toUploadedAvatarPath', () => {
  test('builds /uploads/avatars/<uuid>/<file>', () => {
    assert.equal(toUploadedAvatarPath('user-1', 'avatar.png'), '/uploads/avatars/user-1/avatar.png')
  })
})

test.group('getUploadedAvatarDiskPath', () => {
  test('returns null for null/undefined/empty input', () => {
    assert.equal(getUploadedAvatarDiskPath(null), null)
    assert.equal(getUploadedAvatarDiskPath(undefined), null)
    assert.equal(getUploadedAvatarDiskPath(''), null)
    assert.equal(getUploadedAvatarDiskPath('   '), null)
  })

  test('returns null when path is outside /uploads/avatars/', () => {
    assert.equal(getUploadedAvatarDiskPath('/etc/passwd'), null)
    assert.equal(getUploadedAvatarDiskPath('/uploads/other/x.png'), null)
  })

  test('normalizes a leading-slash-less path before checking prefix', () => {
    // getUploadUrl prepends '/', so 'uploads/avatars/x.png' is accepted
    const result = getUploadedAvatarDiskPath('uploads/avatars/x.png')
    assert.ok(result)
    assert.match(result!, /public\/uploads\/avatars\/x\.png$/)
  })

  test('returns a public-rooted disk path for a valid uploaded path', () => {
    const result = getUploadedAvatarDiskPath('/uploads/avatars/user-1/x.png')
    assert.ok(result, 'expected a path')
    assert.match(result!, /public\/uploads\/avatars\/user-1\/x\.png$/)
  })

  test('strips empty segments without escaping the uploads tree', () => {
    // Double slashes inside the prefix shouldn't let the path break out
    const result = getUploadedAvatarDiskPath('/uploads/avatars//user-1//x.png')
    assert.ok(result)
    assert.match(result!, /public\/uploads\/avatars\/user-1\/x\.png$/)
  })

  test('does not allow %2F or backslash to fake a prefix match', () => {
    // These don't start with the literal /uploads/avatars/ prefix
    assert.equal(getUploadedAvatarDiskPath('%2Fuploads%2Favatars%2Fx.png'), null)
    assert.equal(getUploadedAvatarDiskPath('\\uploads\\avatars\\x.png'), null)
  })
})

test.group('buildUserAvatar precedence', () => {
  test('returns generated source with null url when nothing set', () => {
    const a = buildUserAvatar(user({ fullName: 'Alice Example' }))
    assert.equal(a.source, 'generated')
    assert.equal(a.url, null)
    assert.equal(a.displayName, 'Alice Example')
  })

  test('prepends slash when uploaded path is relative', () => {
    const a = buildUserAvatar(user({ uploadedAvatarPath: 'uploads/avatars/x/y.png' }))
    assert.equal(a.source, 'upload')
    assert.equal(a.url, '/uploads/avatars/x/y.png')
  })
})
