import { BaseSeeder } from '@adonisjs/lucid/seeders'
import VendorConversation from '#models/vendor_conversation'

export default class extends BaseSeeder {
  async run() {
    await VendorConversation.updateOrCreateMany('uuid', [
      {
        uuid: '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
        channel: 'email',
        userId: 1,
        vendorUuid: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
      },
      {
        uuid: '4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a',
        channel: 'phone',
        userId: 2,
        vendorUuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d',
      },
    ])
  }
}
