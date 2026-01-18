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
    ])
  }
}
