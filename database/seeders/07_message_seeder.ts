import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Message from '#models/message'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    await Message.updateOrCreateMany('uuid', [
      {
        uuid: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
        body: 'Test message 1',
        createdBy: 'alice@example.com',
        subject: 'Subject 1',
        from: 'alice@example.com',
        to: 'bob@example.com',
        cc: undefined,
        bcc: undefined,
        sentTimestamp: DateTime.now(),
        communicationUuid: '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
      },
      {
        uuid: '6f7a8b9c-0d1e-4f2a-3b4c-5d6e7f8a9b0c',
        body: 'Test message 2',
        createdBy: 'bob@example.com',
        subject: 'Subject 2',
        from: 'bob@example.com',
        to: 'alice@example.com',
        cc: undefined,
        bcc: undefined,
        sentTimestamp: DateTime.now(),
        communicationUuid: '4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a',
      },
    ])
  }
}
