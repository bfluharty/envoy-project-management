import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import User from '#models/user'

const PASSWORD = 'Password123!'

async function createTestUser(email: string) {
  await User.query().where('email', email).delete()
  return User.create({
    fullName: 'Auth Test User',
    email,
    password: PASSWORD,
    isActive: true,
    entitlementId: 1,
  })
}

function cookieHeader(response: any): string {
  // Reconstruct from raw Set-Cookie headers — response.cookies() parses
  // encrypted session values as objects, which serialize as "[object Object]".
  const setCookie = response.headers()['set-cookie'] ?? []
  return (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((raw: string) => raw.split(';')[0])
    .join('; ')
}

test.group('auth — login', () => {
  test('happy path: valid creds redirect to /dashboard with session cookie', async ({ client }) => {
    const email = 'auth.login.happy@example.com'
    const user = await createTestUser(email)

    try {
      const response = await client.post('/login').form({ email, password: PASSWORD }).redirects(0)

      response.assertFound()
      response.assertHeader('location', '/dashboard')
      assert.ok(cookieHeader(response).length > 0, 'expected a session cookie')
    } finally {
      await user.delete()
    }
  })

  test('sad path: wrong password re-renders login with error', async ({ client }) => {
    const email = 'auth.login.wrong@example.com'
    const user = await createTestUser(email)

    try {
      const response = await client
        .post('/login')
        .header('X-Inertia', 'true')
        .form({ email, password: 'WrongPassword!' })
        .redirects(0)

      response.assertStatus(200)
      response.assertBodyContains({
        component: 'auth/login',
        props: {
          flashMessage: { type: 'error', message: 'Invalid email or password' },
          errors: { email: ['Invalid credentials'] },
        },
      })
    } finally {
      await user.delete()
    }
  })
})

test.group('auth — logout', () => {
  test('authenticated POST /logout redirects to landing', async ({ client }) => {
    const email = 'auth.logout@example.com'
    const user = await createTestUser(email)

    try {
      const loginResponse = await client
        .post('/login')
        .form({ email, password: PASSWORD })
        .redirects(0)
      const cookies = cookieHeader(loginResponse)

      const response = await client.post('/logout').header('Cookie', cookies).redirects(0)

      response.assertFound()
      response.assertHeader('location', '/')
    } finally {
      await user.delete()
    }
  })
})

test.group('auth — guard + intended URL', () => {
  test('unauthenticated GET /account redirects to /login', async ({ client }) => {
    const response = await client.get('/account').header('Accept', 'text/html').redirects(0)

    response.assertFound()
    response.assertHeader('location', '/login')
  })

  test('intended URL: login returns user to original GET path', async ({ client }) => {
    const email = 'auth.intended@example.com'
    const user = await createTestUser(email)

    try {
      // 1. Hit a protected URL unauthenticated — middleware stores intended_url
      const guardResponse = await client.get('/account').header('Accept', 'text/html').redirects(0)
      guardResponse.assertHeader('location', '/login')
      const cookies = cookieHeader(guardResponse)

      // 2. Login with the captured session cookie
      const loginResponse = await client
        .post('/login')
        .header('Cookie', cookies)
        .form({ email, password: PASSWORD })
        .redirects(0)

      loginResponse.assertFound()
      loginResponse.assertHeader('location', '/account')
    } finally {
      await user.delete()
    }
  })

  test('intended URL: avatar proxy URL is ignored, falls back to /dashboard', async ({
    client,
  }) => {
    const email = 'auth.intended.avatar@example.com'
    const user = await createTestUser(email)

    try {
      const guardResponse = await client
        .get('/account/avatar/google')
        .header('Accept', 'text/html')
        .redirects(0)
      guardResponse.assertHeader('location', '/login')
      const cookies = cookieHeader(guardResponse)

      const loginResponse = await client
        .post('/login')
        .header('Cookie', cookies)
        .form({ email, password: PASSWORD })
        .redirects(0)

      loginResponse.assertFound()
      loginResponse.assertHeader('location', '/dashboard')
    } finally {
      await user.delete()
    }
  })
})
