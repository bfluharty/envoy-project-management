import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import VendorConversation from '#models/vendor_conversation'
import OutreachDraft from '#models/outreach_draft'

export default class extends BaseSeeder {
  async run() {
    const ryan = await User.findByOrFail('email', 'envoyryan@gmail.com')

    const vendors = [
      {
        uuid: 'vc-apex-house-0001-0000-000000000001',
        projectVendorUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c52',
        vendorUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c51',
        subject: 'Kick-off: Custom Home Construction — Contract Discussion',
        body: `Hi Apex team,

I hope you're doing well. I'm reaching out to kick off contract discussions for our Custom Home Construction project — a 4-bedroom modern farmhouse on 1.2 acres in Austin's Hill Country.

Meridian Architecture Group has finalized the plans and we're ready to move into the permitting and build phase. Given Austin's typical 8–12 week permitting timeline, we'd like to get a signed contract in place as soon as possible to stay on track for our February 2027 completion target.

Could we schedule a call this week to walk through the scope, timeline, and contract terms? I'd also love to discuss any concerns on your end before we proceed.

Looking forward to working together on this.

Best,
Ryan`,
      },
      {
        uuid: 'vc-summ-house-0001-0000-000000000002',
        projectVendorUuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f82',
        vendorUuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f81',
        subject: 'Revised MEP Bid Request — Custom Home Construction',
        body: `Hi Summit MEP team,

Following up on our Custom Home Construction project in Austin Hill Country. We're moving into the contractor selection phase and would love to include your revised MEP bid in our evaluation.

Could you send the updated proposal by end of next week? We're targeting a March 2026 build start, so we're working on a tight timeline for vendor decisions.

Please let me know if you have any questions in the meantime.

Thanks,
Ryan`,
      },
    ]

    for (const v of vendors) {
      const convo = await VendorConversation.updateOrCreate(
        { projectVendorUuid: v.projectVendorUuid },
        {
          uuid: v.uuid,
          channel: 'email',
          userId: ryan.id,
          vendorUuid: v.vendorUuid,
          projectVendorUuid: v.projectVendorUuid,
        }
      )

      await OutreachDraft.updateOrCreate(
        { vendorConversationUuid: convo.uuid },
        {
          projectVendorUuid: v.projectVendorUuid,
          vendorConversationUuid: convo.uuid,
          subject: v.subject,
          body: v.body,
          status: 'draft',
          sentTimestamp: null,
          sentMessageUuid: null,
          lastError: null,
        }
      )
    }
  }
}
