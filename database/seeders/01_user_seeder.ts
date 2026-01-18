import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    // Create test users with properly hashed passwords
    await User.updateOrCreateMany('email', [
      {
        uuid: 'b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f',
        fullName: 'Alice Example',
        email: 'alice@example.com',
        password: 'hashedpassword1', // This will be automatically hashed by AdonisJS
        isActive: true,
        entitlementId: 1,
      },
      {
        uuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b4c',
        fullName: 'Bob Example',
        email: 'bob@example.com',
        password: 'hashedpassword2', // This will be automatically hashed by AdonisJS
        isActive: true,
        entitlementId: 2,
      },
    ])
  }
}
