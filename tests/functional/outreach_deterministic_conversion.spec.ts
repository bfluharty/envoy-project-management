import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import axios from 'axios'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import Communication from '#models/communication'
import Message from '#models/message'
import OutreachDraft from '#models/outreach_draft'
import Project from '#models/project'
import ProjectPromptService from '#services/project_prompt_service'
import ProjectVendor from '#models/project_vendor'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import VendorConversation from '#models/vendor_conversation'
import VendorService from '#services/vendor_service'
import {
  draftReplyForInboundMessage,
  reviseOutreachDraft,
  reviseThreadReply,
} from '#services/project_outreach_service'

const PASSWORD = 'Password123!'

test.group('deterministic outreach conversion', (group) => {
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
      fullName: 'Deterministic Outreach User',
      email: `deterministic-outreach-${uuidv4()}@example.com`,
      password: PASSWORD,
      entitlementId: entitlement.id,
      isActive: true,
    })
  }

  async function createProjectWithVendor() {
    const user = await createConsumer()
    const project = await Project.create({
      title: 'Deterministic Outreach Project',
      description: 'Coordinate vendor availability.',
      userUuid: user.uuid,
      isActive: true,
    })
    const listing = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `deterministic-outreach-${uuidv4()}`,
      name: 'Deterministic Vendor',
      email: 'vendor@example.com',
      categories: ['Contractor'],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: { postcode: '23220' },
      sourcePayload: {},
    })
    const vendor = await VendorService.ensureUserVendorMapping(user.uuid, listing.uuid)
    assert.ok(vendor)
    const projectVendor = await ProjectVendor.create({
      projectUuid: project.uuid,
      vendorUuid: vendor.uuid,
      isActive: true,
    })

    await ProjectPromptService.savePromptData({
      projectUuid: project.uuid,
      agentType: 'OUTREACH',
      data: {
        outreachAgent: {
          title: 'Vendor Outreach Agent',
          description: 'Collects availability from project vendors.',
          goals: ['Confirm availability'],
          risks: ['Slow replies'],
          successCriteria: ['Vendor provides availability'],
          priorities: ['Availability first'],
          requiredFactsToCollect: ['Availability'],
          checklistDefinitionOfDone: ['Availability is known'],
        },
      },
      userUuid: user.uuid,
    })

    return { user, project, projectVendor }
  }

  async function createThread(user: User, projectVendor: ProjectVendor) {
    const conversation = await VendorConversation.create({
      channel: 'email',
      userId: user.id,
      vendorUuid: projectVendor.vendorUuid,
      projectVendorUuid: projectVendor.uuid,
    })
    const communication = await Communication.create({
      channel: 'email',
      projectVendorUuid: projectVendor.uuid,
    })

    return { conversation, communication }
  }

  async function createMessage(
    communication: Communication,
    conversation: VendorConversation,
    input: {
      direction: 'inbound' | 'outbound'
      subject: string
      body: string
      sentAt: string
    }
  ) {
    return Message.create({
      communicationUuid: communication.uuid,
      vendorConversationUuid: conversation.uuid,
      direction: input.direction,
      subject: input.subject,
      body: input.body,
      from: input.direction === 'inbound' ? 'vendor@example.com' : 'owner@example.com',
      to: input.direction === 'inbound' ? 'owner@example.com' : 'vendor@example.com',
      createdBy: 'test',
      sentTimestamp: DateTime.fromISO(input.sentAt),
      providerMessageId: null,
      messageIdHeader: null,
      referencesHeader: null,
      providerThreadId: null,
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

  function stubReasoningDrafts(
    buildData: (payload: any) => { subject: string | null; body: string }
  ) {
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
          message: buildData(payload).body,
          data: buildData(payload),
          readyForNextStep: true,
          missingFields: [],
          turn: {
            agentId: 'OUTREACH',
            userPrompt:
              payload.promptData.revisionInstructions ?? payload.promptData.latestVendorReply,
            modelResponse: buildData(payload).body,
            timestamp: '2026-07-05T12:00:00.000Z',
          },
        },
      }
    }) as typeof axios.post

    return { calls }
  }

  test('draft revision calls OUTREACH revision mode and saves response.data', async () => {
    const { user, project, projectVendor } = await createProjectWithVendor()
    const { conversation, communication } = await createThread(user, projectVendor)
    await createMessage(communication, conversation, {
      direction: 'outbound',
      subject: 'Original subject',
      body: 'Original body',
      sentAt: '2026-07-05T12:00:00.000Z',
    })
    const draft = await OutreachDraft.create({
      projectVendorUuid: projectVendor.uuid,
      vendorConversationUuid: conversation.uuid,
      subject: 'Original subject',
      body: 'Original body',
      status: 'draft',
      sentTimestamp: null,
      sentMessageUuid: null,
      lastError: null,
    })
    stubProjectInsights()
    const reasoning = stubReasoningDrafts(() => ({
      subject: null,
      body: 'Revised body from deterministic response data.',
    }))

    await reviseOutreachDraft(user, project.uuid, draft.uuid, 'Make it warmer', {
      subject: 'Original subject',
      body: 'Original body',
    })

    await draft.refresh()
    assert.equal(draft.subject, 'Original subject')
    assert.equal(draft.body, 'Revised body from deterministic response data.')
    const call = reasoning.calls[0]
    assert.equal(call.agentId, 'OUTREACH')
    assert.equal(call.promptData.mode, 'revision')
    assert.equal(call.promptData.vendor.name, 'Deterministic Vendor')
    assert.equal(call.promptData.draft.subject, 'Original subject')
    assert.equal(call.promptData.draft.body, 'Original body')
    assert.equal(call.promptData.revisionInstructions, 'Make it warmer')
    assert.equal(call.stakeholderDetails.name, 'Deterministic Outreach User')
    assert.match(call.recentTurns[0].modelResponse, /Original body/)
  })

  test('thread reply revision calls OUTREACH revision mode with vendor transcript', async () => {
    const { user, project, projectVendor } = await createProjectWithVendor()
    const { conversation, communication } = await createThread(user, projectVendor)
    await createMessage(communication, conversation, {
      direction: 'outbound',
      subject: 'Availability',
      body: 'Can you do Friday?',
      sentAt: '2026-07-05T12:00:00.000Z',
    })
    await createMessage(communication, conversation, {
      direction: 'inbound',
      subject: 'Re: Availability',
      body: 'Friday works.',
      sentAt: '2026-07-05T12:05:00.000Z',
    })
    stubProjectInsights()
    const reasoning = stubReasoningDrafts(() => ({
      subject: null,
      body: 'Thanks, Friday works on our side.',
    }))

    const result = await reviseThreadReply(
      user,
      project.uuid,
      conversation.uuid,
      'Make it concise',
      'Draft reply body'
    )

    assert.equal(result.revisedThreadUuid, conversation.uuid)
    assert.equal(result.revisedReplyBody, 'Thanks, Friday works on our side.')
    const call = reasoning.calls[0]
    assert.equal(call.agentId, 'OUTREACH')
    assert.equal(call.promptData.mode, 'revision')
    assert.equal(call.promptData.draft.body, 'Draft reply body')
    assert.equal(call.promptData.revisionInstructions, 'Make it concise')
    assert.match(call.recentTurns[0].modelResponse, /Can you do Friday/)
    assert.match(call.recentTurns[1].userPrompt, /Friday works/)
  })

  test('inbound vendor reply drafting calls OUTREACH vendor_reply mode and saves a thread draft', async () => {
    const { user, project, projectVendor } = await createProjectWithVendor()
    const { conversation, communication } = await createThread(user, projectVendor)
    await createMessage(communication, conversation, {
      direction: 'outbound',
      subject: 'Availability',
      body: 'Can you share availability?',
      sentAt: '2026-07-05T12:00:00.000Z',
    })
    await createMessage(communication, conversation, {
      direction: 'inbound',
      subject: 'Re: Availability',
      body: 'We are available next week.',
      sentAt: '2026-07-05T12:05:00.000Z',
    })
    stubProjectInsights()
    const reasoning = stubReasoningDrafts(() => ({
      subject: null,
      body: 'Thanks for confirming. What dates next week work best?',
    }))

    await draftReplyForInboundMessage(project.uuid, conversation, {
      subject: 'Re: Availability',
      body: 'We are available next week.',
    })

    const draft = await OutreachDraft.query()
      .where('vendor_conversation_uuid', conversation.uuid)
      .firstOrFail()
    assert.equal(draft.projectVendorUuid, projectVendor.uuid)
    assert.equal(draft.subject, 'Re: Availability')
    assert.equal(draft.body, 'Thanks for confirming. What dates next week work best?')
    assert.equal(draft.status, 'draft')
    const call = reasoning.calls[0]
    assert.equal(call.agentId, 'OUTREACH')
    assert.equal(call.promptData.mode, 'vendor_reply')
    assert.equal(call.promptData.latestVendorReply, 'We are available next week.')
    assert.equal(call.promptData.draft.body, 'N/A')
    assert.match(call.recentTurns[1].userPrompt, /We are available next week/)
  })
})
