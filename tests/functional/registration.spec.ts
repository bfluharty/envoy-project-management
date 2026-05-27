// To test, run 'node ace test --files="tests/functional/registration.spec.ts"`

import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'

const NEW_EMAIL = 'registration.test.new@example.com'
const DUPLICATE_EMAIL = 'registration.test.existing@example.com'
const VALID_PASSWORD = 'Password123!'

test.group('registration', (group) => {
  group.setup(() => testUtils.db().migrate())

  test('happy path: new email creates account and redirects to login', async ({ client }) => {
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

  test('sad path: duplicate email re-renders the register page with an error message', async ({
    client,
  }) => {
    await User.create({
      fullName: 'Existing User',
      email: DUPLICATE_EMAIL,
      password: VALID_PASSWORD,
      isActive: true,
      entitlementId: 1,
    })

    try {
      const response = await client
        .post('/register')
        .header('X-Inertia', 'true')
        .form({
          fullName: 'Duplicate User',
          email: DUPLICATE_EMAIL,
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
            message: 'Something went wrong. Please try again.',
          },
        },
      })
    } finally {
      await User.query().where('email', DUPLICATE_EMAIL).delete()
    }
  })
})
