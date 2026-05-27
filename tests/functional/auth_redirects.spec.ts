import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { resolvePostLoginRedirect } from '#controllers/web/auth_controller'

// function toCookieHeader(response: any) {
//   return Object.values(response.cookies())
//     .map((cookie: any) => `${cookie.name}=${cookie.value}`)
//     .join('; ')
// }

// async function loginWithCookie(client: any, cookieHeader: string) {
//   return client
//     .post('/login')
//     .header('Cookie', cookieHeader)
//     .form({
//       email: 'alice@example.com',
//       password: 'hashedpassword1',
//     })
//     .redirects(0)
// }

test('resolvePostLoginRedirect keeps real pages and blocks avatar proxy targets', () => {
  assert.equal(resolvePostLoginRedirect('/account'), '/account')
  assert.equal(resolvePostLoginRedirect('/account#email-accounts'), '/account#email-accounts')
  assert.equal(resolvePostLoginRedirect('/dashboard'), '/dashboard')
  assert.equal(resolvePostLoginRedirect('/account/avatar/google'), null)
  assert.equal(resolvePostLoginRedirect('/account/avatar/google?size=64'), null)
  assert.equal(resolvePostLoginRedirect(null), null)
})

// test('login returns the user to /account after auth middleware stores the intended URL', async ({
//   client,
// }) => {
//   const redirectResponse = await client.get('/account').redirects(0)

//   redirectResponse.assertFound()
//   redirectResponse.assertRedirectsTo('/login')

//   const loginResponse = await loginWithCookie(client, toCookieHeader(redirectResponse))

//   loginResponse.assertFound()
//   loginResponse.assertRedirectsTo('/account')
// })

// test('login ignores avatar proxy URLs captured as the intended target', async ({ client }) => {
//   const redirectResponse = await client.get('/account/avatar/google?size=64').redirects(0)

//   redirectResponse.assertFound()
//   redirectResponse.assertRedirectsTo('/login')

//   const loginResponse = await loginWithCookie(client, toCookieHeader(redirectResponse))

//   loginResponse.assertFound()
//   loginResponse.assertRedirectsTo('/dashboard')
// })
