import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Vendor from '#models/vendor'
import ProjectVendor from '#models/project_vendor'

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
        isActive: true,
      },
      {
        uuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d',
        name: 'Globex Inc',
        email: 'info@globex.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        statusId: 2,
        isActive: true,
      },
      {
        uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        name: 'V Madari',
        email: 'vmadari6117@gmail.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        statusId: 1,
        isActive: true,
      },
    ])

    // Associate vendors with projects via ProjectVendor mapping
    await ProjectVendor.updateOrCreateMany(
      ['projectUuid', 'vendorUuid'],
      [
        {
          projectUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          vendorUuid: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
        },
        {
          projectUuid: 'bc5ad890-4915-43e3-9b6f-33aea76dd2f6',
          vendorUuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d',
        },
        {
          projectUuid: '0e037e80-6922-441a-b413-887a856a286b',
          vendorUuid: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
        },
        {
          projectUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          vendorUuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        },
      ]
    )
  }
}
