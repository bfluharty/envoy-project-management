import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { access } from 'node:fs/promises'
import User from '#models/user'
import {
  buildUserAvatar,
  deleteUploadedAvatar,
  getUploadedAvatarDiskPath,
} from '#services/user_avatar_service'

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9l1cAAAAASUVORK5CYII=',
  'base64'
)

const TEST_EMAIL = 'avatar.test@example.com'
const TEST_PASSWORD = 'Password123!'

function pathExists(path: string) {
  return access(path).then(
    () => true,
    () => false
  )
}

async function loginAndGetCookieHeader(client: any) {
  const response = await client
    .post('/login')
    .form({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    .redirects(0)

  response.assertFound()

  // Reconstruct from raw Set-Cookie headers — response.cookies() parses
  // encrypted session values as objects, which serialize as "[object Object]".
  const setCookie = response.headers()['set-cookie'] ?? []
  const cookieHeader = (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((raw: string) => raw.split(';')[0])
    .join('; ')

  assert.ok(cookieHeader.length > 0, 'expected login to return a session cookie')
  return cookieHeader
}

test('buildUserAvatar prefers uploaded over google and falls back to initials', () => {
  const uploaded = buildUserAvatar({
    uuid: 'user-1',
    fullName: 'Alice Example',
    email: 'alice@example.com',
    uploadedAvatarPath: '/uploads/avatars/user-1/custom.png',
    googleAvatarUrl: 'https://example.com/google.png',
  } as any)

  assert.equal(uploaded.source, 'upload')
  assert.equal(uploaded.url, '/uploads/avatars/user-1/custom.png')
  assert.equal(uploaded.initials, 'AE')

  const google = buildUserAvatar({
    uuid: 'user-2',
    fullName: null,
    email: 'ryan@example.com',
    uploadedAvatarPath: null,
    googleAvatarUrl: 'https://example.com/google.png',
  } as any)

  assert.equal(google.source, 'google')
  assert.equal(google.url, '/account/avatar/google')
  assert.equal(google.initials, 'R')

  const generated = buildUserAvatar({
    uuid: 'user-3',
    fullName: '',
    email: 'envoy.ryan@example.com',
    uploadedAvatarPath: null,
    googleAvatarUrl: null,
  } as any)

  assert.equal(generated.source, 'generated')
  assert.equal(generated.url, null)
  assert.equal(generated.initials, 'ER')
})

test('account avatar upload and removal update the stored file', async ({ client }) => {
  const user = await User.create({
    fullName: 'Avatar Test User',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    isActive: true,
    entitlementId: 1,
  })

  try {
    const cookieHeader = await loginAndGetCookieHeader(client)

    const uploadResponse = await client
      .post('/account/avatar')
      .header('Cookie', cookieHeader)
      .file('avatar', PNG_BUFFER, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .redirects(0)

    uploadResponse.assertFound()
    uploadResponse.assertHeader('location', '/account')

    const uploadedUser = await User.findByOrFail('email', TEST_EMAIL)
    assert.ok(uploadedUser.uploadedAvatarPath)
    assert.match(uploadedUser.uploadedAvatarPath, /^\/uploads\/avatars\/.+\.png$/)

    const uploadedDiskPath = getUploadedAvatarDiskPath(uploadedUser.uploadedAvatarPath)
    assert.ok(uploadedDiskPath)
    assert.equal(await pathExists(uploadedDiskPath), true)

    const removeResponse = await client
      .delete('/account/avatar')
      .header('Cookie', cookieHeader)
      .redirects(0)

    removeResponse.assertFound()
    removeResponse.assertHeader('location', '/account')

    const removedUser = await User.findByOrFail('email', TEST_EMAIL)
    assert.equal(removedUser.uploadedAvatarPath, null)
    assert.equal(await pathExists(uploadedDiskPath), false)
  } finally {
    const freshUser = await User.findBy('email', TEST_EMAIL)
    if (freshUser?.uploadedAvatarPath) {
      await deleteUploadedAvatar(freshUser.uploadedAvatarPath)
    }
    await user.delete()
  }
})
