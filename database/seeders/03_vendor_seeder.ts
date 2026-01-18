import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Vendor from '#models/vendor'

export default class extends BaseSeeder {
  async run() {
    await Vendor.updateOrCreateMany('uuid', [
      {
        uuid: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
        name: 'Acme Corp',
        email: 'contact@acme.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        statusId: 1,
        projectUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        isActive: true,
      },
      {
        uuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d',
        name: 'Globex Inc',
        email: 'info@globex.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        statusId: 2,
        projectUuid: 'e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b',
        isActive: true,
      },
    ])
  }
}
