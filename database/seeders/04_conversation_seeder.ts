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
      // Custom Home Construction
      {
        uuid: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
        timestamp: DateTime.now(),
        projectUuid: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
      },
      // Restaurant Brand Launch
      {
        uuid: 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c',
        timestamp: DateTime.now(),
        projectUuid: 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f',
      },
      // Office Headquarters Fit-Out
      {
        uuid: 'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d',
        timestamp: DateTime.now(),
        projectUuid: 'd3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a',
      },
    ])
  }
}
