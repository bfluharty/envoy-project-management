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
      {
        uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c51',
        name: 'Apex General Contractors',
        email: 'projects@apexgc.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        isActive: true,
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
      },
      {
        uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d61',
        name: 'Meridian Architecture Group',
        email: 'hello@meridianarch.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        isActive: true,
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
      },
      {
        uuid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e71',
        name: 'Premier Interior Design',
        email: 'studio@premierid.com',
        createdBy: 'admin',
        modifiedBy: 'admin',
        isActive: true,
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
      },
      {
        uuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f81',
        name: 'Summit MEP Solutions',
        email: 'bids@summitmep.com',
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
        // Custom Home Construction vendors — varied statuses for demo richness
        {
          uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c52',
          projectUuid: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
          vendorUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c51', // Apex General Contractors
          statusId: 2, // In Progress
          isActive: true,
        },
        {
          uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d62',
          projectUuid: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
          vendorUuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d61', // Meridian Architecture Group
          statusId: 4, // Ready
          isActive: true,
        },
        {
          uuid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e72',
          projectUuid: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
          vendorUuid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e71', // Premier Interior Design
          statusId: 1, // New
          isActive: true,
        },
        {
          uuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f82',
          projectUuid: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
          vendorUuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f81', // Summit MEP Solutions
          statusId: 3, // Attention Needed
          isActive: true,
        },
      ]
    )
  }
}
