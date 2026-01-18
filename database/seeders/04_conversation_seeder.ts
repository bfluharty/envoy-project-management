import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Conversation from '#models/conversation'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    await Conversation.updateOrCreateMany('uuid', [
      {
        uuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
        timestamp: DateTime.now(),
        projectUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      },
      {
        uuid: 'b9c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e',
        timestamp: DateTime.now(),
        projectUuid: 'e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b',
      },
    ])
  }
}
