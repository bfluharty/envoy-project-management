import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import axios from 'axios'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import OutreachDraft from '#models/outreach_draft'
import Project from '#models/project'
import ProjectPromptService from '#services/project_prompt_service'
import ProjectVendor from '#models/project_vendor'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import UserInboxConnection from '#models/user_inbox_connection'
import {
  encryptOauthToken,
  OAUTH_TOKEN_ENCRYPTION_VERSION,
} from '#services/oauth_token_encryption_service'
import VendorService from '#services/vendor_service'
import {
  generateInitialOutreachDrafts,
  retryInitialOutreachDraft,
} from '#services/project_outreach_service'
import { acceptConsentForTest } from '../helpers/user_consent.js'

const PASSWORD = 'Password123!'

test.group('initial outreach generation', (group) => {
  const restores: Array<() => void> = []

  group.setup(() => testUtils.db().truncate())
  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  async function createConsumer() {
    const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
    const user = await User.create({
      fullName: 'Initial Outreach User',
      email: `initial-outreach-${uuidv4()}@example.com`,
      password: PASSWORD,
      entitlementId: entitlement.id,
      isActive: true,
    })

    return acceptConsentForTest(user)
  }

  async function createActivePrimaryInbox(user: User) {
    return UserInboxConnection.create({
      userUuid: user.uuid,
      provider: 'gmail',
      email: user.email,
      accessToken: encryptOauthToken('access-token'),
      refreshToken: encryptOauthToken('refresh-token'),
      accessTokenExpiresAt: DateTime.utc().plus({ hour: 1 }),
      scopes:
        'openid https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      status: 'active',
      isPrimary: true,
      providerUserId: `google-${user.uuid}`,
      tokenEncryptionVersion: OAUTH_TOKEN_ENCRYPTION_VERSION,
      watchStatus: 'not_configured',
    })
  }

  async function attachVendor(user: User, project: Project, name: string, email: string | null) {
    const listing = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `initial-outreach-${uuidv4()}`,
      name,
      email,
      categories: ['Contractor'],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: { postcode: '23220' },
      sourcePayload: {},
    })
    const vendor = await VendorService.ensureUserVendorMapping(user.uuid, listing.uuid)
    assert.ok(vendor)

    return ProjectVendor.create({
      projectUuid: project.uuid,
      vendorUuid: vendor.uuid,
      isActive: true,
    })
  }

  function stubProjectInsights() {
    const original = ReasoningRequestContextService.getProjectInsights
    restores.push(() => {
      ReasoningRequestContextService.getProjectInsights = original
    })

    ReasoningRequestContextService.getProjectInsights =
      (async () => []) as typeof ReasoningRequestContextService.getProjectInsights
  }

  function stubReasoningDrafts() {
    const originalPost = axios.post
    const attempts = new Map<string, number>()
    const calls: any[] = []
    restores.push(() => {
      axios.post = originalPost
    })

    axios.post = (async (_url: string, payload: any) => {
      calls.push(payload)
      const vendorName = payload.promptData.vendor.name
      const attempt = (attempts.get(vendorName) ?? 0) + 1
      attempts.set(vendorName, attempt)

      if (vendorName === 'Retry Electric' && attempt === 1) {
        return {
          status: 200,
          data: {
            agentId: 'OUTREACH',
            data: {
              subject: 'Invalid first attempt',
              body: '',
            },
          },
        }
      }

      if (vendorName === 'Failing Plumbing') {
        return {
          status: 200,
          data: {
            agentId: 'OUTREACH',
            data: {
              subject: 'Invalid failed attempt',
              body: '',
            },
          },
        }
      }

      return {
        status: 200,
        data: {
          agentId: 'OUTREACH',
          data: {
            subject: `${vendorName} availability`,
            body: `Hi ${vendorName},\n\nCan you share availability?\n\nThanks,\nInitial Outreach User`,
          },
        },
      }
    }) as typeof axios.post

    return { attempts, calls }
  }

  test('retries vendor drafts once and saves failed vendors as error drafts', async () => {
    const user = await createConsumer()
    const project = await Project.create({
      title: 'Initial Outreach Project',
      description: 'Coordinate contractor availability.',
      userUuid: user.uuid,
      isActive: true,
    })
    const retryVendor = await attachVendor(user, project, 'Retry Electric', 'retry@example.com')
    const failingVendor = await attachVendor(user, project, 'Failing Plumbing', null)
    await ProjectPromptService.savePromptData({
      projectUuid: project.uuid,
      agentType: 'OUTREACH',
      data: {
        outreachAgent: {
          title: 'Contractor Outreach Agent',
          description: 'Collects availability from project vendors.',
          goals: ['Confirm availability'],
          risks: ['Vendor delays'],
          successCriteria: ['Vendor responds'],
          priorities: ['Availability first'],
          requiredFactsToCollect: ['Availability'],
          checklistDefinitionOfDone: ['Availability known'],
        },
      },
      userUuid: user.uuid,
    })
    stubProjectInsights()
    const reasoning = stubReasoningDrafts()

    const result = await generateInitialOutreachDrafts(user.uuid, project.uuid)

    assert.deepEqual(
      result.successful.map((draft) => draft.projectVendorUuid),
      [retryVendor.uuid]
    )
    assert.deepEqual(result.failed, [
      {
        projectVendorUuid: failingVendor.uuid,
        vendorName: 'Failing Plumbing',
        error: 'Reasoning engine did not return an outreach draft body',
      },
    ])
    assert.equal(reasoning.attempts.get('Retry Electric'), 2)
    assert.equal(reasoning.attempts.get('Failing Plumbing'), 2)
    assert.equal(
      reasoning.calls.every((call) => call.agentId === 'OUTREACH'),
      true
    )
    assert.equal(
      reasoning.calls.every((call) => call.stakeholderDetails.name === 'Initial Outreach User'),
      true
    )

    const drafts = await OutreachDraft.query()
      .whereIn('project_vendor_uuid', [retryVendor.uuid, failingVendor.uuid])
      .orderBy('project_vendor_uuid', 'asc')
    assert.equal(drafts.length, 2)
    const successDraft = drafts.find((draft) => draft.projectVendorUuid === retryVendor.uuid)
    const failedDraft = drafts.find((draft) => draft.projectVendorUuid === failingVendor.uuid)
    assert.equal(successDraft?.status, 'draft')
    assert.equal(successDraft?.subject, 'Retry Electric availability')
    assert.match(successDraft?.body ?? '', /Can you share availability/)
    assert.equal(failedDraft?.status, 'error')
    assert.equal(failedDraft?.lastError, 'Reasoning engine did not return an outreach draft body')
  })

  test('manually retries a failed initial outreach draft for the same vendor', async () => {
    const user = await createConsumer()
    const project = await Project.create({
      title: 'Manual Retry Outreach Project',
      description: 'Coordinate contractor availability.',
      userUuid: user.uuid,
      isActive: true,
    })
    const projectVendor = await attachVendor(
      user,
      project,
      'Retryable HVAC',
      'retryable@example.com'
    )
    await ProjectPromptService.savePromptData({
      projectUuid: project.uuid,
      agentType: 'OUTREACH',
      data: {
        outreachAgent: {
          title: 'Contractor Outreach Agent',
          description: 'Collects availability from project vendors.',
          goals: ['Confirm availability'],
          risks: ['Vendor delays'],
          successCriteria: ['Vendor responds'],
          priorities: ['Availability first'],
          requiredFactsToCollect: ['Availability'],
          checklistDefinitionOfDone: ['Availability known'],
        },
      },
      userUuid: user.uuid,
    })
    stubProjectInsights()

    const originalPost = axios.post
    const calls: any[] = []
    restores.push(() => {
      axios.post = originalPost
    })

    axios.post = (async (_url: string, payload: any) => {
      calls.push(payload)
      return {
        status: 200,
        data: {
          agentId: 'OUTREACH',
          data: {
            subject: 'Invalid failed attempt',
            body: '',
          },
        },
      }
    }) as typeof axios.post

    const failedResult = await generateInitialOutreachDrafts(user.uuid, project.uuid)
    assert.deepEqual(
      failedResult.failed.map((failure) => failure.projectVendorUuid),
      [projectVendor.uuid]
    )

    const failedDraft = await OutreachDraft.query()
      .where('project_vendor_uuid', projectVendor.uuid)
      .firstOrFail()
    assert.equal(failedDraft.status, 'error')

    axios.post = (async (_url: string, payload: any) => {
      calls.push(payload)
      return {
        status: 200,
        data: {
          agentId: 'OUTREACH',
          data: {
            subject: 'Retryable HVAC availability',
            body: 'Hi Retryable HVAC,\n\nCan you share availability?\n\nThanks,\nInitial Outreach User',
          },
        },
      }
    }) as typeof axios.post

    const state = await retryInitialOutreachDraft(user, project.uuid, failedDraft.uuid)

    await failedDraft.refresh()
    assert.equal(failedDraft.status, 'draft')
    assert.equal(failedDraft.subject, 'Retryable HVAC availability')
    assert.match(failedDraft.body, /Can you share availability/)
    assert.equal(failedDraft.lastError, null)
    assert.equal(state.cards.find((card) => card.draftUuid === failedDraft.uuid)?.status, 'draft')

    const retryCall = calls[calls.length - 1]
    assert.equal(retryCall.agentId, 'OUTREACH')
    assert.equal(retryCall.promptData.mode, 'initial_outreach')
    assert.equal(retryCall.promptData.vendor.name, 'Retryable HVAC')
    assert.equal(retryCall.stakeholderDetails.name, 'Initial Outreach User')
  })

  test('retry endpoint regenerates a failed initial outreach draft', async ({ client }) => {
    const user = await createConsumer()
    await createActivePrimaryInbox(user)
    const project = await Project.create({
      title: 'Endpoint Retry Outreach Project',
      description: 'Coordinate contractor availability.',
      userUuid: user.uuid,
      isActive: true,
    })
    const projectVendor = await attachVendor(
      user,
      project,
      'Endpoint Retry Electric',
      'endpoint-retry@example.com'
    )
    await ProjectPromptService.savePromptData({
      projectUuid: project.uuid,
      agentType: 'OUTREACH',
      data: {
        outreachAgent: {
          title: 'Contractor Outreach Agent',
          description: 'Collects availability from project vendors.',
          goals: ['Confirm availability'],
          risks: ['Vendor delays'],
          successCriteria: ['Vendor responds'],
          priorities: ['Availability first'],
          requiredFactsToCollect: ['Availability'],
          checklistDefinitionOfDone: ['Availability known'],
        },
      },
      userUuid: user.uuid,
    })
    stubProjectInsights()

    const originalPost = axios.post
    const calls: any[] = []
    restores.push(() => {
      axios.post = originalPost
    })

    axios.post = (async (_url: string, payload: any) => {
      calls.push(payload)
      return {
        status: 200,
        data: {
          agentId: 'OUTREACH',
          data: {
            subject: 'Invalid failed attempt',
            body: '',
          },
        },
      }
    }) as typeof axios.post

    await generateInitialOutreachDrafts(user.uuid, project.uuid)
    const failedDraft = await OutreachDraft.query()
      .where('project_vendor_uuid', projectVendor.uuid)
      .firstOrFail()
    assert.equal(failedDraft.status, 'error')

    axios.post = (async (_url: string, payload: any) => {
      calls.push(payload)
      return {
        status: 200,
        data: {
          agentId: 'OUTREACH',
          data: {
            subject: 'Endpoint Retry Electric availability',
            body: 'Hi Endpoint Retry Electric,\n\nCan you share availability?\n\nThanks,\nInitial Outreach User',
          },
        },
      }
    }) as typeof axios.post

    const response = await client
      .post(`/api/projects/${project.uuid}/outreach/drafts/${failedDraft.uuid}/retry`)
      .loginAs(user)

    response.assertStatus(200)
    await failedDraft.refresh()
    assert.equal(failedDraft.status, 'draft')
    assert.equal(failedDraft.subject, 'Endpoint Retry Electric availability')
    assert.equal(failedDraft.lastError, null)
    assert.equal(
      response
        .body()
        .cards.find((card: { draftUuid: string }) => card.draftUuid === failedDraft.uuid)?.status,
      'draft'
    )

    const retryCall = calls[calls.length - 1]
    assert.equal(retryCall.agentId, 'OUTREACH')
    assert.equal(retryCall.promptData.mode, 'initial_outreach')
    assert.equal(retryCall.promptData.vendor.name, 'Endpoint Retry Electric')
  })
})
