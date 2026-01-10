import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  protected tableName = 'envoy_schema.vendor_statuses'

  async up() {
    this.defer(async () => {
      await db.table(this.tableName).insert([
        {
          title: 'New',
          canonical_name: 'NEW',
          created_by: 'Benjamin Fluharty',
          modified_by: 'Benjamin Fluharty',
          created_timestamp: new Date(),
          modified_timestamp: new Date(),
        },
        {
          title: 'In Progress',
          canonical_name: 'IN_PROGRESS',
          created_by: 'Benjamin Fluharty',
          modified_by: 'Benjamin Fluharty',
          created_timestamp: new Date(),
          modified_timestamp: new Date(),
        },
        {
          title: 'Attention Needed',
          canonical_name: 'ATTENTION_NEEDED',
          created_by: 'Benjamin Fluharty',
          modified_by: 'Benjamin Fluharty',
          created_timestamp: new Date(),
          modified_timestamp: new Date(),
        },
        {
          title: 'Ready',
          canonical_name: 'READY',
          created_by: 'Benjamin Fluharty',
          modified_by: 'Benjamin Fluharty',
          created_timestamp: new Date(),
          modified_timestamp: new Date(),
        },
      ])
    })
  }

  async down() {
    this.defer(async () => {
      await db
        .from(this.tableName)
        .whereIn('canonical_name', ['NEW', 'IN_PROGRESS', 'ATTENTION_NEEDED', 'READY'])
        .delete()
    })
  }
}
