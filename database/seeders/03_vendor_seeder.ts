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
        isActive: true,
        userUuid: 'b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f',
      },
      {
        uuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d',
        name: 'Globex Inc',
        email: 'info@globex.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        isActive: true,
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b4c',
      },
      {
        uuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c61',
        name: 'Globex Limited',
        email: 'vmadari6117@gmail.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        isActive: true,
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
      },
    ])

    // Associate vendors with projects via ProjectVendor mapping
    await ProjectVendor.updateOrCreateMany(
      ['projectUuid', 'vendorUuid'],
      [
        {
          uuid: 'f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          projectUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          vendorUuid: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
          statusId: 1,
          isActive: true,
        },
        {
          uuid: 'fc5ad890-4915-43e3-9b6f-33aea76dd2f6',
          projectUuid: 'bc5ad890-4915-43e3-9b6f-33aea76dd2f6',
          vendorUuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d',
          statusId: 2,
          isActive: true,
        },
        {
          uuid: 'fe037e80-6922-441a-b413-887a856a286b',
          projectUuid: '0e037e80-6922-441a-b413-887a856a286b',
          vendorUuid: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
          statusId: 1,
          isActive: true,
        },
        {
          uuid: 'fe037e80-6922-441a-b413-887a856a2861',
          projectUuid: 'a9b0c1d2-e3f4-4a6b-8c8d-9e0f1a2b3c4d',
          vendorUuid: '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c61',
          statusId: 1,
          isActive: true,
        },
      ]
    )
  }
}
