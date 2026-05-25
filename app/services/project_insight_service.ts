import ProjectInsight from '#models/project_insight'
import ProjectInsightStatus from '#models/project_insight_status'
import ProjectInsightType from '#models/project_insight_type'
import { CreateProjectInsightInput } from '../../types/request.js'

export default class ProjectInsightService {
  private static readonly DEFAULT_ACTIVE_INSIGHT_LIMIT = 30

  private static readonly ACTIVE_STATUS_CODE = 'ACTIVE'

  public static async getActiveInsightsByProject(projectUuid: string, limit?: number) {
    const activeStatus = await this.getStatusByCode(this.ACTIVE_STATUS_CODE)

    return ProjectInsight.query()
      .where('project_uuid', projectUuid)
      .andWhere('status_id', activeStatus.id)
      .andWhere('is_active', true)
      .preload('insightType')
      .preload('status')
      .orderBy('importance', 'desc')
      .orderBy('modified_timestamp', 'desc')
      .limit(limit ?? this.DEFAULT_ACTIVE_INSIGHT_LIMIT)
  }

  public static async createInsight(projectUuid: string, input: CreateProjectInsightInput) {
    const [insightType, activeStatus] = await Promise.all([
      this.getTypeByCode(input.insightType),
      this.getStatusByCode(input.insightStatus ?? this.ACTIVE_STATUS_CODE),
    ])

    return ProjectInsight.create({
      projectUuid,
      insightTypeId: insightType.id,
      statusId: activeStatus.id,
      insightText: input.insightText,
      importance: input.importance ?? 3,
      confidence: input.confidence ?? null,
      supersedesInsightUuid: input.supersedesInsightUuid ?? null,
    })
  }

  private static async getTypeByCode(code: string) {
    return ProjectInsightType.query().where('code', code).andWhere('is_active', true).firstOrFail()
  }

  private static async getStatusByCode(code: string) {
    return ProjectInsightStatus.query()
      .where('code', code)
      .andWhere('is_active', true)
      .firstOrFail()
  }
}
