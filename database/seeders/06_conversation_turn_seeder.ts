import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ConversationTurn from '#models/conversation_turn'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    await ConversationTurn.updateOrCreateMany('uuid', [
      {
        uuid: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        timestamp: DateTime.now(),
        contents: {
          userPrompt: 'Hello',
          topic: 'greeting',
          actionExecutions: [],
          modelResponse: 'Hi there!',
          timestamp: new Date(),
        },
        conversationUuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
      },
      {
        uuid: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
        timestamp: DateTime.now(),
        contents: {
          userPrompt: 'Hi',
          topic: 'greeting',
          actionExecutions: [],
          modelResponse: 'Hello!',
          timestamp: new Date(),
        },
        conversationUuid: 'b9c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e',
      },

      // ── Custom Home Construction ──────────────────────────────
      {
        uuid: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e51',
        timestamp: DateTime.fromISO('2026-04-10T10:15:00'),
        contents: {
          userPrompt:
            'What should we nail down first to keep the build on track for the February 2027 deadline?',
          topic: 'Project Setup',
          actionExecutions: [{ action: 'Get Project Details', success: true }],
          modelResponse:
            'Given your February 2027 deadline, the most critical first step is locking in your general contractor — permitting timelines in Austin Hill Country can run 8–12 weeks, and GCs need signed contracts before they can pull permits. Who are you leaning toward? I see Apex General Contractors is listed as a contact.',
          timestamp: new Date('2026-04-10T10:15:30'),
        },
        conversationUuid: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
      },
      {
        uuid: 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f61',
        timestamp: DateTime.fromISO('2026-04-10T10:18:00'),
        contents: {
          userPrompt:
            "Yes, Apex is our top choice. Meridian Architecture has already finished the plans — they're ready to go. We're also still evaluating Premier Interior Design and Summit MEP hasn't sent their revised bid yet.",
          topic: 'Project Setup',
          actionExecutions: [{ action: 'Store Insight', success: true }],
          modelResponse:
            "Got it — I've noted that Meridian is ready, Apex is the preferred GC, Premier Interior is under evaluation, and Summit MEP's bid is pending. That's exactly the kind of vendor picture worth tracking. What's your biggest concern right now — Summit MEP's timeline, or getting Apex contracted first?",
          timestamp: new Date('2026-04-10T10:18:45'),
        },
        conversationUuid: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
      },
      {
        uuid: 'e3f4a5b6-c7d8-4e9f-0a1b-2c3d4e5f6a71',
        timestamp: DateTime.fromISO('2026-04-10T10:21:00'),
        contents: {
          userPrompt:
            'Apex first. Can you draft an outreach email to them to kick off contract discussions?',
          topic: 'Initial Outreach',
          actionExecutions: [
            { action: 'Get Project Details', success: true },
            { action: 'Draft Outreach Emails', success: true },
          ],
          modelResponse:
            "Done — I've drafted an outreach email to Apex General Contractors to open contract discussions for the Custom Home Construction project. You can review and send it from the Outreach tab. Want me to draft a follow-up to Summit MEP as well to nudge their revised bid?",
          timestamp: new Date('2026-04-10T10:22:10'),
        },
        conversationUuid: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
      },
      {
        uuid: 'f4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b81',
        timestamp: DateTime.fromISO('2026-04-10T10:23:00'),
        contents: {
          userPrompt:
            'Yes, draft one for Summit MEP too. Keep it short — just ask for the revised bid by end of next week.',
          topic: 'Initial Outreach',
          actionExecutions: [{ action: 'Draft Outreach Emails', success: true }],
          modelResponse:
            'Drafted. The email to Summit MEP Solutions is short and direct — it requests their revised MEP bid by end of next week and references the Custom Home Construction project. Check the Outreach tab to review both drafts before sending.',
          timestamp: new Date('2026-04-10T10:23:55'),
        },
        conversationUuid: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
      },

      // ── Restaurant Brand Launch ───────────────────────────────
      {
        uuid: 'a5b6c7d8-e9f0-4a1b-2c3d-4e5f6a7b8c91',
        timestamp: DateTime.fromISO('2026-04-15T14:30:00'),
        contents: {
          userPrompt:
            'We want the restaurant to feel elevated but approachable — think natural materials, warm lighting, open kitchen. The name is still TBD.',
          topic: 'Project Setup',
          actionExecutions: [{ action: 'Store Insight', success: true }],
          modelResponse:
            'That aesthetic direction — warm, tactile, open kitchen — is a strong foundation for both interior design and brand identity. Before you finalize a name, it helps to know: are you positioning around the chef, the sourcing story, or the neighborhood? That usually determines whether the name should feel personal (like a surname) or evocative (like a place or feeling).',
          timestamp: new Date('2026-04-15T14:31:00'),
        },
        conversationUuid: 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c',
      },
      {
        uuid: 'b6c7d8e9-f0a1-4b2c-3d4e-5f6a7b8c9d01',
        timestamp: DateTime.fromISO('2026-04-15T14:35:00'),
        contents: {
          userPrompt:
            "Definitely the sourcing story. We're partnering with three local farms and want that front and center.",
          topic: 'Project Setup',
          actionExecutions: [{ action: 'Store Insight', success: true }],
          modelResponse:
            "That's a compelling anchor — farm partnerships give you built-in storytelling for the menu, the interior, and every piece of marketing. Names like 'Field & Table', 'The Larder', or something tied to the specific region tend to land well for this positioning. Want me to help scope what the brand identity vendor needs to deliver, or are you ready to start reaching out to design studios?",
          timestamp: new Date('2026-04-15T14:36:00'),
        },
        conversationUuid: 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c',
      },

      // ── Office Headquarters Fit-Out ───────────────────────────
      {
        uuid: 'c7d8e9f0-a1b2-4c3d-4e5f-6a7b8c9d0e11',
        timestamp: DateTime.fromISO('2026-04-20T09:00:00'),
        contents: {
          userPrompt:
            'We need space for 60 people — mostly hybrid, so probably 40 desks plus collaboration zones. Big priority is a client-facing lounge and a proper boardroom.',
          topic: 'Project Setup',
          actionExecutions: [{ action: 'Store Insight', success: true }],
          modelResponse:
            "For 60 hybrid employees at roughly 40 desks, you're looking at a solid activity-based layout — dedicated focus areas, a few phone booths, and those collaboration zones. At 8,000 sq ft, you have enough room for a client lounge and a proper boardroom without crowding the work floor. What's the vibe you're going for — polished and corporate, or more creative and open?",
          timestamp: new Date('2026-04-20T09:01:00'),
        },
        conversationUuid: 'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d',
      },
    ])
  }
}
