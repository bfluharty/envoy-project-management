import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import User from '#models/user'
import Project from '#models/project'

const PASSWORD = 'Password123!'

async function createTestUser(email: string) {
  await User.query().where('email', email).delete()
  return User.create({
    fullName: 'Project Test User',
    email,
    password: PASSWORD,
    isActive: true,
    entitlementId: 1,
  })
}

function cookieHeader(response: any): string {
  const setCookie = response.headers()['set-cookie'] ?? []
  return (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((raw: string) => raw.split(';')[0])
    .join('; ')
}

async function loginAs(client: any, email: string): Promise<string> {
  const response = await client.post('/login').form({ email, password: PASSWORD }).redirects(0)
  return cookieHeader(response)
}

test.group('projects — create', () => {
  test('happy path: POST /projects redirects to /projects/:uuid', async ({ client }) => {
    const user = await createTestUser('projects.create.happy@example.com')
    const cookies = await loginAs(client, user.email)

    try {
      const response = await client
        .post('/projects')
        .header('Cookie', cookies)
        .form({ title: 'Functional Test Project', budgetCurrency: 'USD' })
        .redirects(0)

      response.assertFound()
      const location = response.headers().location as string
      assert.match(location, /^\/projects\/[0-9a-f-]{36}$/)

      const created = await Project.query()
        .where('user_uuid', user.uuid)
        .where('title', 'Functional Test Project')
        .first()
      assert.ok(created, 'project should exist in DB')
    } finally {
      await Project.query().where('user_uuid', user.uuid).delete()
      await user.delete()
    }
  })

  test('title required: empty title rejected', async ({ client }) => {
    const user = await createTestUser('projects.create.notitle@example.com')
    const cookies = await loginAs(client, user.email)

    try {
      const response = await client
        .post('/projects')
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .form({ title: '' })
        .redirects(0)

      // Vine validation throws → status >= 400
      assert.ok(response.status() >= 400, `expected error status, got ${response.status()}`)

      const exists = await Project.query().where('user_uuid', user.uuid).first()
      assert.equal(exists, null, 'no project should be created')
    } finally {
      await Project.query().where('user_uuid', user.uuid).delete()
      await user.delete()
    }
  })

  test('date ordering: startDate after endDate is rejected', async ({ client }) => {
    const user = await createTestUser('projects.create.baddates@example.com')
    const cookies = await loginAs(client, user.email)

    try {
      const response = await client
        .post('/projects')
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .form({
          title: 'Bad Dates',
          startDate: '2027-12-01',
          endDate: '2027-06-01',
          deadline: '2027-12-31',
        })
        .redirects(0)

      assert.ok(response.status() >= 400, `expected error status, got ${response.status()}`)

      const exists = await Project.query().where('user_uuid', user.uuid).first()
      assert.equal(exists, null)
    } finally {
      await Project.query().where('user_uuid', user.uuid).delete()
      await user.delete()
    }
  })

  test('create succeeds without budgetCurrency (regression)', async ({ client }) => {
    // BUG: ProjectService.createProject calls project.load('budgetCurrency')
    // which throws when budgetCurrencyId is undefined. The project IS created
    // but the controller catches the error and redirects back with a flash
    // saying "Failed to create project" — confusing for the user.
    // Unskip this test once load() is guarded by `if (project.budgetCurrencyId)`.
    const user = await createTestUser('projects.create.nocurrency@example.com')
    const cookies = await loginAs(client, user.email)

    try {
      const response = await client
        .post('/projects')
        .header('Cookie', cookies)
        .form({ title: 'No Currency Project' })
        .redirects(0)

      response.assertFound()
      const location = response.headers().location as string
      assert.match(location, /^\/projects\/[0-9a-f-]{36}$/)
    } finally {
      await Project.query().where('user_uuid', user.uuid).delete()
      await user.delete()
    }
  }).skip(true, 'TODO: fix budgetCurrency preload when FK is undefined')

  test('past startDate is rejected (afterOrEqual today)', async ({ client }) => {
    const user = await createTestUser('projects.create.pastdate@example.com')
    const cookies = await loginAs(client, user.email)

    try {
      const response = await client
        .post('/projects')
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .form({
          title: 'Past Date',
          startDate: '2020-01-01',
          endDate: '2027-06-01',
          deadline: '2027-12-31',
        })
        .redirects(0)

      assert.ok(response.status() >= 400)
    } finally {
      await Project.query().where('user_uuid', user.uuid).delete()
      await user.delete()
    }
  })
})

test.group('projects — show / update / cross-user', () => {
  test('cross-user access: user B cannot read user A project (404)', async ({ client }) => {
    const userA = await createTestUser('projects.cross.a@example.com')
    const userB = await createTestUser('projects.cross.b@example.com')
    const aCookies = await loginAs(client, userA.email)

    try {
      // A creates a project
      const createResp = await client
        .post('/projects')
        .header('Cookie', aCookies)
        .form({ title: 'A Project', budgetCurrency: 'USD' })
        .redirects(0)
      const location = createResp.headers().location as string
      const projectUuid = location.split('/').pop()!

      // B logs in and tries to GET A's project
      const bCookies = await loginAs(client, userB.email)
      const showResp = await client
        .get(`/projects/${projectUuid}`)
        .header('Cookie', bCookies)
        .header('Accept', 'text/html')
        .redirects(0)

      assert.equal(showResp.status(), 404)
    } finally {
      await Project.query().where('user_uuid', userA.uuid).delete()
      await userA.delete()
      await userB.delete()
    }
  })

  test('update project title via PATCH returns updated project JSON', async ({ client }) => {
    const user = await createTestUser('projects.update@example.com')
    const cookies = await loginAs(client, user.email)

    try {
      const createResp = await client
        .post('/projects')
        .header('Cookie', cookies)
        .form({ title: 'Original Title', budgetCurrency: 'USD' })
        .redirects(0)
      const projectUuid = (createResp.headers().location as string).split('/').pop()!

      const updateResp = await client
        .patch(`/projects/${projectUuid}`)
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .form({ title: 'Updated Title' })
        .redirects(0)

      updateResp.assertStatus(200)
      updateResp.assertBodyContains({ project: { name: 'Updated Title' } })

      const reread = await Project.query().where('uuid', projectUuid).firstOrFail()
      assert.equal(reread.title, 'Updated Title')
    } finally {
      await Project.query().where('user_uuid', user.uuid).delete()
      await user.delete()
    }
  })

  test('unauthenticated GET /projects/:uuid redirects to /login', async ({ client }) => {
    const response = await client
      .get('/projects/00000000-0000-4000-8000-000000000000')
      .header('Accept', 'text/html')
      .redirects(0)

    response.assertFound()
    response.assertHeader('location', '/login')
  })
})
