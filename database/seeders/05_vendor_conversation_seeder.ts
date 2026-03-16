import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Communication from '#models/communication'

export default class extends BaseSeeder {
  async run() {
    await Communication.updateOrCreateMany('uuid', [
      {
        uuid: '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
        channel: 'email',
        projectVendorUuid: 'f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      },
      {
        uuid: '4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a',
        channel: 'phone',
        projectVendorUuid: 'fc5ad890-4915-43e3-9b6f-33aea76dd2f6',
      },
    ])
  }
}
