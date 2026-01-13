import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Project from '#models/project'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    await Project.updateOrCreateMany('uuid', [
      {
        uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        title: 'Project Alpha',
        description: 'First project',
        location: { city: 'New York' },
        startDate: DateTime.fromISO('2026-01-01'),
        endDate: DateTime.fromISO('2026-06-01'),
        deadline: DateTime.fromISO('2026-05-01'),
        budgetAmount: 10000.0,
        budgetCurrencyId: 1,
        goals: 'Launch MVP',
        userUuid: 'b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f',
        isActive: true,
      },
      {
        uuid: 'e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b',
        title: 'Project Beta',
        description: 'Second project',
        location: { city: 'London' },
        startDate: DateTime.fromISO('2026-02-01'),
        endDate: DateTime.fromISO('2026-07-01'),
        deadline: DateTime.fromISO('2026-06-01'),
        budgetAmount: 20000.0,
        budgetCurrencyId: 2,
        goals: 'Expand Market',
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b4c',
        isActive: true,
      },
    ])
  }
}
