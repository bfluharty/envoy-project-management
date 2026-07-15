import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import OnboardingProjectController from '#controllers/web/onboarding_project_controller'
import OutreachDraft from '#models/outreach_draft'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import Vendor from '#models/vendor'
import VendorListing from '#models/vendor_listing'
import OnboardingDraftService from '#services/onboarding_draft_service'
import OnboardingProjectCompletionService from '#services/onboarding_project_completion_service'
import ProjectService from '#services/project_service'
import ProjectVendorAttachmentService from '#services/project_vendor_attachment_service'
import ProjectReasoningWorkflowService from '#services/project_reasoning_workflow_service'
import VendorService from '#services/vendor_service'
import { acceptConsentForTest } from '../helpers/user_consent.js'

const PASSWORD = 'Password123!'

async function createUser(role: 'CONSUMER' | 'VENDOR') {
  const entitlement = await UserEntitlement.findByOrFail('canonicalName', role)
  const user = await User.create({
    fullName: `${role} Completion User`,
    email: `${role.toLowerCase()}-completion-${uuidv4()}@example.com`,
    password: PASSWORD,
    entitlementId: entitlement.id,
    vendorApprovalStatus: role === 'VENDOR' ? 'PENDING' : null,
    isActive: true,
  })

  return acceptConsentForTest(user)
}

async function createSearchListing(email: string | null = null) {
  return VendorService.insertOrReuseSearchListing({
    fsqPlaceId: `onboarding-completion-${uuidv4()}`,
    name: `Onboarding Completion Vendor ${uuidv4()}`,
    email,
    categories: ['Contractor'],
    phoneNumber: null,
    website: null,
    dateRefreshed: null,
    location: { postcode: '23220' },
    sourcePayload: {},
  })
}

async function createAssociatedDraft(user: User, listings: VendorListing[]) {
  const result = await OnboardingDraftService.createDraft({
    projectDescription: 'I need contractors for a full restaurant renovation and buildout.',
    postalCode: '23220',
    anonymousSessionUuid: uuidv4(),
    recommendedVendorListingUuids: listings.map((listing) => listing.uuid),
  })
  await OnboardingDraftService.updateSelection(
    result.tokenUuid,
    listings.map((listing) => listing.uuid)
  )
  await OnboardingDraftService.associateDraftToUser(result.tokenUuid, user.uuid)
  return result.draft
}

const validProjectRequest = {
  title: 'Restaurant Renovation',
  description: 'I need contractors for a full restaurant renovation and buildout.',
  location: { postalCode: '23220', formatted_address: '23220' },
  goals: 'Open the renovated space safely and on schedule.',
}

test.group('onboarding project completion', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('requires a consumer account for both completion routes', async ({ client }) => {
    const vendorUser = await createUser('VENDOR')

    const showResponse = await client.get('/onboarding/project').loginAs(vendorUser)
    showResponse.assertStatus(403)

    const storeResponse = await client
      .post('/onboarding/project')
      .loginAs(vendorUser)
      .json(validProjectRequest)
    storeResponse.assertStatus(403)
  })

  test('shows prefilled state with canonical selected listings, including no-email listings', async () => {
    const consumer = await createUser('CONSUMER')
    const superseded = await createSearchListing('superseded@example.com')
    const noEmail = await createSearchListing(null)
    const canonical = await VendorListing.create({
      name: 'Canonical Claimed Vendor',
      email: 'canonical@example.com',
      originator: 'VENDOR',
      claimStatus: 'CLAIMED',
      claimedByUserUuid: consumer.uuid,
      isActive: true,
    })
    await createAssociatedDraft(consumer, [superseded, noEmail])
    superseded.supersededByVendorListingUuid = canonical.uuid
    await superseded.save()

    const rendered: Array<{ component: string; props: any }> = []
    await new OnboardingProjectController().show({
      auth: { getUserOrFail: () => consumer },
      inertia: {
        render: (component: string, props: any) => {
          rendered.push({ component, props })
          return rendered[0]
        },
      },
      response: {},
    } as any)

    assert.equal(rendered[0].component, 'onboarding/project')
    assert.equal(rendered[0].props.state, 'active')
    assert.equal(
      rendered[0].props.project.description,
      'I need contractors for a full restaurant renovation and buildout.'
    )
    assert.equal(rendered[0].props.project.location.postalCode, '23220')
    const selectedVendors = rendered[0].props.selectedVendors
    assert.deepEqual(
      selectedVendors.map((vendor: any) => vendor.vendorListingUuid),
      [canonical.uuid, noEmail.uuid]
    )
    assert.equal(selectedVendors[1].hasEmail, false)
    assert.equal('email' in selectedVendors[1], false)
  })

  test('creates and consumes exactly once without accepting an onboarding token', async ({
    client,
  }) => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing(null)
    const draft = await createAssociatedDraft(consumer, [listing])
    const outreachDraftCountBefore = await OutreachDraft.query()
      .count('* as total')
      .then((rows) => Number(rows[0].$extras.total))

    const validationResponse = await client
      .post('/onboarding/project')
      .loginAs(consumer)
      .json({ ...validProjectRequest, title: '' })
    validationResponse.assertStatus(422)

    const tokenResponse = await client
      .post('/onboarding/project')
      .loginAs(consumer)
      .json({ ...validProjectRequest, onboardingToken: draft.tokenUuid })
    tokenResponse.assertStatus(422)

    const firstResponse = await client
      .post('/onboarding/project')
      .loginAs(consumer)
      .json(validProjectRequest)
      .redirects(0)
    firstResponse.assertFound()

    await draft.refresh()
    assert.equal(draft.status, 'CONSUMED')
    assert.equal(draft.consumedByUserUuid, consumer.uuid)
    assert.ok(draft.consumedProjectUuid)
    firstResponse.assertHeader('location', `/projects/${draft.consumedProjectUuid}`)

    const secondResponse = await client
      .post('/onboarding/project')
      .loginAs(consumer)
      .json(validProjectRequest)
      .redirects(0)
    secondResponse.assertFound()
    secondResponse.assertHeader('location', `/projects/${draft.consumedProjectUuid}`)

    const showRecoveryResponse = await client
      .get('/onboarding/project')
      .loginAs(consumer)
      .redirects(0)
    showRecoveryResponse.assertFound()
    showRecoveryResponse.assertHeader('location', `/projects/${draft.consumedProjectUuid}`)

    assert.equal(
      await Project.query()
        .where('user_uuid', consumer.uuid)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      1
    )
    await listing.refresh()
    assert.equal(listing.ownerUserUuid, consumer.uuid)
    assert.equal(listing.originator, 'SEARCH')
    assert.ok(
      await Vendor.query()
        .where('user_uuid', consumer.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .where('is_active', true)
        .first()
    )
    assert.equal(
      await ProjectVendor.query()
        .where('project_uuid', draft.consumedProjectUuid!)
        .where('is_active', true)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      1
    )
    assert.equal(
      await OutreachDraft.query()
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      outreachDraftCountBefore
    )
  })

  test('renders authenticated expiry recovery and blocks project creation', async ({ client }) => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing(null)
    const draft = await createAssociatedDraft(consumer, [listing])
    draft.expiresAt = DateTime.utc().minus({ minute: 1 })
    await draft.save()

    const rendered: Array<{ component: string; props: any }> = []
    await new OnboardingProjectController().show({
      auth: { getUserOrFail: () => consumer },
      inertia: {
        render: (component: string, props: any) => {
          rendered.push({ component, props })
          return rendered[0]
        },
      },
      response: {},
    } as any)
    assert.equal(rendered[0].component, 'onboarding/project')
    assert.equal(rendered[0].props.state, 'expired')
    assert.deepEqual(rendered[0].props.recovery, {
      dashboardUrl: '/dashboard',
      vendorSearchUrl: '/',
    })

    const storeResponse = await client
      .post('/onboarding/project')
      .loginAs(consumer)
      .json(validProjectRequest)
      .redirects(0)
    storeResponse.assertFound()
    storeResponse.assertHeader('location', '/onboarding/project')
    assert.equal(await Project.findBy('userUuid', consumer.uuid), null)
  })

  test('rolls back the project, ownership, mappings, and draft when attachment fails', async () => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing(null)
    const draft = await createAssociatedDraft(consumer, [listing])
    const originalCreate = ProjectVendor.create
    ProjectVendor.create = (async () => {
      throw new Error('forced onboarding attachment failure')
    }) as typeof ProjectVendor.create

    try {
      await assert.rejects(
        () =>
          OnboardingProjectCompletionService.completeProject(consumer.uuid, validProjectRequest),
        /forced onboarding attachment failure/
      )
    } finally {
      ProjectVendor.create = originalCreate
    }

    await draft.refresh()
    await listing.refresh()
    assert.equal(draft.status, 'ACTIVE')
    assert.equal(draft.consumedProjectUuid, null)
    assert.equal(listing.ownerUserUuid, null)
    assert.equal(await Project.findBy('userUuid', consumer.uuid), null)
    assert.equal(
      await Vendor.query()
        .where('user_uuid', consumer.uuid)
        .where('vendor_listing_uuid', listing.uuid)
        .first(),
      null
    )
  })

  test('skips unavailable selections and commits the remaining project links with a warning', async () => {
    const consumer = await createUser('CONSUMER')
    const availableListing = await createSearchListing('available-partial@example.com')
    const unavailableListing = await createSearchListing('unavailable-partial@example.com')
    const draft = await createAssociatedDraft(consumer, [availableListing, unavailableListing])
    unavailableListing.isActive = false
    await unavailableListing.save()

    const result = await OnboardingProjectCompletionService.completeProject(
      consumer.uuid,
      validProjectRequest
    )

    assert.equal(result.status, 'CREATED')
    if (result.status !== 'CREATED') return
    assert.equal(result.linkedVendorCount, 1)
    assert.deepEqual(result.unavailableVendorListingUuids, [unavailableListing.uuid])
    assert.equal(result.warnings?.length, 1)
    await draft.refresh()
    assert.equal(draft.status, 'CONSUMED')
    assert.ok(draft.consumedProjectUuid)
    assert.ok(
      await Vendor.query()
        .where('user_uuid', consumer.uuid)
        .where('vendor_listing_uuid', availableListing.uuid)
        .first()
    )
    assert.equal(
      await Vendor.query()
        .where('user_uuid', consumer.uuid)
        .where('vendor_listing_uuid', unavailableListing.uuid)
        .first(),
      null
    )
  })

  test('performs no reasoning or other external intake work during completion', async () => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing('no-external-work@example.com')
    await createAssociatedDraft(consumer, [listing])
    const originalRunIntake = ProjectReasoningWorkflowService.runIntakeForProject
    let callCount = 0
    ProjectReasoningWorkflowService.runIntakeForProject = (async () => {
      callCount += 1
      throw new Error('onboarding completion must not call reasoning')
    }) as typeof ProjectReasoningWorkflowService.runIntakeForProject

    try {
      const result = await OnboardingProjectCompletionService.completeProject(
        consumer.uuid,
        validProjectRequest
      )
      assert.equal(result.status, 'CREATED')
      assert.equal(callCount, 0)
    } finally {
      ProjectReasoningWorkflowService.runIntakeForProject = originalRunIntake
    }
  })

  test('passes the project transaction client to the shared attachment service', async () => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing('transaction@example.com')
    await createAssociatedDraft(consumer, [listing])
    const originalCreateProject = ProjectService.createProjectInTransaction
    const originalAttach = ProjectVendorAttachmentService.attachListingsInTransaction
    let projectTransaction: unknown
    let attachmentTransaction: unknown

    ProjectService.createProjectInTransaction = (async (userUuid, request, trx) => {
      projectTransaction = trx
      return originalCreateProject.call(ProjectService, userUuid, request, trx)
    }) as typeof ProjectService.createProjectInTransaction
    ProjectVendorAttachmentService.attachListingsInTransaction = (async (
      userUuid,
      projectUuid,
      listingUuids,
      trx
    ) => {
      attachmentTransaction = trx
      return originalAttach.call(
        ProjectVendorAttachmentService,
        userUuid,
        projectUuid,
        listingUuids,
        trx
      )
    }) as typeof ProjectVendorAttachmentService.attachListingsInTransaction

    try {
      const result = await OnboardingProjectCompletionService.completeProject(
        consumer.uuid,
        validProjectRequest
      )
      assert.equal(result.status, 'CREATED')
      assert.ok(projectTransaction)
      assert.equal(attachmentTransaction, projectTransaction)
    } finally {
      ProjectService.createProjectInTransaction = originalCreateProject
      ProjectVendorAttachmentService.attachListingsInTransaction = originalAttach
    }
  })

  test('concurrent completion requests return one project', async () => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing('concurrent@example.com')
    const draft = await createAssociatedDraft(consumer, [listing])

    const results = await Promise.all([
      OnboardingProjectCompletionService.completeProject(consumer.uuid, validProjectRequest),
      OnboardingProjectCompletionService.completeProject(consumer.uuid, validProjectRequest),
    ])

    assert.deepEqual(results.map((result) => result.status).sort(), ['ALREADY_CONSUMED', 'CREATED'])
    await draft.refresh()
    assert.equal(new Set(results.map((result) => result.projectUuid)).size, 1)
    assert.equal(results[0].projectUuid, draft.consumedProjectUuid)
    assert.equal(
      await Project.query()
        .where('user_uuid', consumer.uuid)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      1
    )
  })

  test('returns a clear recovery error for a consumed draft without a project UUID', async ({
    client,
  }) => {
    const consumer = await createUser('CONSUMER')
    const listing = await createSearchListing('recovery@example.com')
    const draft = await createAssociatedDraft(consumer, [listing])
    draft.status = 'CONSUMED'
    draft.consumedByUserUuid = consumer.uuid
    draft.consumedProjectUuid = null
    await draft.save()

    const response = await client.get('/onboarding/project').loginAs(consumer)
    response.assertStatus(409)
    response.assertBodyContains({
      error: 'Onboarding completion could not recover the created project',
    })
  })
})
