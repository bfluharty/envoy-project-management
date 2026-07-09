import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProjectPrompt from '#models/project_prompt'

export default class extends BaseSeeder {
  async run() {
    const projectUuid = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e'
    const userUuid = 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41'

    await ProjectPrompt.updateOrCreateMany('uuid', [
      {
        uuid: '7f000000-0000-4000-8000-000000000001',
        projectUuid,
        agentType: 'PLANNING',
        data: {
          planningAgent: {
            title: 'Custom Home Outreach Project Manager',
            description:
              'A detail-oriented project manager coordinating vendor outreach for a custom home build in Austin Hill Country.',
            goals: [
              'Confirm which vendors should receive outreach before the build phase begins.',
              'Collect the missing schedule, scope, and proposal details needed to compare vendors.',
              'Prepare clear outreach instructions for each vendor conversation.',
            ],
            questions: [
              'Which attached vendors should be contacted first?',
              'Are there budget ranges, contract terms, or schedule constraints vendors should know?',
              'What facts must each vendor provide before you can make a decision?',
            ],
            risks: [
              'Permitting timelines may affect vendor availability.',
              'Incomplete scope details could lead to inconsistent proposals.',
              'Long vendor response times could delay contractor selection.',
            ],
          },
        },
        createdByUserUuid: userUuid,
        modifiedByUserUuid: userUuid,
      },
      {
        uuid: '7f000000-0000-4000-8000-000000000002',
        projectUuid,
        agentType: 'OUTREACH',
        data: {
          outreachAgent: {
            title: 'Custom Home Vendor Outreach Coordinator',
            description:
              'An outreach agent responsible for contacting attached construction vendors, gathering proposal details, and keeping vendor conversations moving toward a decision.',
            goals: [
              'Request availability, proposal timing, and next-step requirements from each attached vendor.',
              'Clarify scope assumptions, timeline risks, and any blockers to participation.',
              'Escalate only when stakeholder input is required to keep outreach moving.',
            ],
            risks: [
              'Vendors may need more complete plans before confirming pricing.',
              'Schedule constraints may conflict with the target build start.',
              'Contractor responses may omit comparable pricing or scope details.',
            ],
            successCriteria: [
              'Each attached vendor has responded or exhausted reasonable follow-up attempts.',
              'Required proposal, schedule, and scope details are collected for vendor comparison.',
            ],
            priorities: [
              'Keep messages concise and specific to the custom home build.',
              'Ask for only the facts needed to compare vendors and unblock next steps.',
            ],
            requiredFactsToCollect: [
              'Vendor availability for the target build schedule.',
              'Proposal or bid timing.',
              'Known scope exclusions, dependencies, or blockers.',
            ],
            checklistDefinitionOfDone: [
              'Vendor confirms availability or declines.',
              'Vendor provides proposal timing or requested next step.',
              'Any missing stakeholder decisions are escalated back to the user.',
            ],
          },
        },
        createdByUserUuid: userUuid,
        modifiedByUserUuid: userUuid,
      },
    ])
  }
}
