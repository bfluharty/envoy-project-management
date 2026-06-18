import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProjectInsight from '#models/project_insight'
import ProjectInsightStatus from '#models/project_insight_status'
import ProjectInsightType from '#models/project_insight_type'

export default class extends BaseSeeder {
  async run() {
    const activeStatus = await ProjectInsightStatus.findByOrFail('code', 'ACTIVE')
    const projectFactType = await ProjectInsightType.findByOrFail('code', 'PROJECT_FACT')
    const projectConstraintType = await ProjectInsightType.findByOrFail(
      'code',
      'PROJECT_CONSTRAINT'
    )
    const riskType = await ProjectInsightType.findByOrFail('code', 'RISK_OR_BLOCKER')

    await ProjectInsight.updateOrCreateMany('uuid', [
      {
        uuid: '9a100000-0000-4000-8000-000000000001',
        projectUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        insightTypeId: projectFactType.id,
        statusId: activeStatus.id,
        insightText: 'Project Alpha is focused on launching an MVP.',
        importance: 4,
        confidence: 0.95,
        supersedesInsightUuid: null,
        supersededByInsightUuid: null,
      },
      {
        uuid: '9a100000-0000-4000-8000-000000000002',
        projectUuid: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
        insightTypeId: projectConstraintType.id,
        statusId: activeStatus.id,
        insightText: 'The custom home project needs a build timeline aligned with permitting.',
        importance: 5,
        confidence: 0.9,
        supersedesInsightUuid: null,
        supersededByInsightUuid: null,
      },
      {
        uuid: '9a100000-0000-4000-8000-000000000003',
        projectUuid: 'd3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a',
        insightTypeId: riskType.id,
        statusId: activeStatus.id,
        insightText: 'The office fit-out schedule depends on vendor availability and permitting.',
        importance: 4,
        confidence: 0.82,
        supersedesInsightUuid: null,
        supersededByInsightUuid: null,
      },
    ])
  }
}
