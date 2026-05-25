// To test, run 'node --test tests/functional/registration.spec.ts`

import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import User from '#models/user'

const NEW_EMAIL = 'registration.test.new@example.com'
const EXISTING_EMAIL = 'alice@example.com' // pre-seeded by 01_user_seeder.ts
const VALID_PASSWORD = 'Password123!'

test('registration happy path: new email creates account and redirects to login', async ({
  client,
}) => {
  await User.query().where('email', NEW_EMAIL).delete()

  try {
    const response = await client
      .post('/register')
      .form({
        fullName: 'New Test User',
        email: NEW_EMAIL,
        password: VALID_PASSWORD,
        passwordConfirmation: VALID_PASSWORD,
      })
      .redirects(0)

    response.assertFound()
    response.assertHeader('location', '/login')

    const created = await User.findBy('email', NEW_EMAIL)
    assert.ok(created, 'user record should exist in the database after successful registration')
  } finally {
    await User.query().where('email', NEW_EMAIL).delete()
  }
})

test('registration sad path: duplicate email re-renders the register page with an error message', async ({
  client,
}) => {
  const response = await client
    .post('/register')
    .header('X-Inertia', 'true')
    .form({
      fullName: 'Duplicate User',
      email: EXISTING_EMAIL,
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    })
    .redirects(0)

  response.assertStatus(200)
  response.assertBodyContains({
    component: 'auth/register',
    props: {
      flashMessage: {
        type: 'error',
        message: 'An account with that email already exists. Try signing in instead.',
      },
      errors: {
        email: 'An account with this email already exists.',
      },
    },
  })
})
