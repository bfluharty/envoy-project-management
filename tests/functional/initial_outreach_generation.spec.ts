import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import OutreachDraft from '#models/outreach_draft'
import Project from '#models/project'
import ProjectPromptService from '#services/project_prompt_service'
import ProjectVendor from '#models/project_vendor'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import VendorService from '#services/vendor_service'
import { generateInitialOutreachDrafts } from '#services/project_outreach_service'

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
    return User.create({
      fullName: 'Initial Outreach User',
      email: `initial-outreach-${uuidv4()}@example.com`,
      password: PASSWORD,
      entitlementId: entitlement.id,
      isActive: true,
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
})
