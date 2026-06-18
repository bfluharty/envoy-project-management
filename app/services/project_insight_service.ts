import Project from '#models/project'
import ProjectInsight from '#models/project_insight'
import ProjectInsightStatus from '#models/project_insight_status'
import ProjectInsightType from '#models/project_insight_type'
import {
  ApplyProjectInsightChangesInput,
  ApplyProjectInsightChangesResult,
  ProjectInsightInput,
  ProjectInsightStatusCode,
} from '../../types/project_insight.js'

export class ProjectInsightValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectInsightValidationError'
  }
}

export class ProjectInsightProjectNotFoundError extends Error {
  constructor(projectUuid: string) {
    super(`Project not found: ${projectUuid}`)
    this.name = 'ProjectInsightProjectNotFoundError'
  }
}

export default class ProjectInsightService {
  private static readonly DEFAULT_ACTIVE_INSIGHT_LIMIT = 30

  public static async getActiveInsightsByProject(projectUuid: string, limit?: number) {
    const activeStatus = await this.getStatusByCode(ProjectInsightStatusCode.Active)

    return ProjectInsight.query()
      .where('project_uuid', projectUuid)
      .andWhere('status_id', activeStatus.id)
      .preload('insightType')
      .preload('status')
      .orderBy('importance', 'desc')
      .orderBy('modified_timestamp', 'desc')
      .limit(limit ?? this.DEFAULT_ACTIVE_INSIGHT_LIMIT)
  }

  public static async applyExtractedChanges(
    projectUuid: string,
    input: ApplyProjectInsightChangesInput
  ): Promise<ApplyProjectInsightChangesResult> {
    const result: ApplyProjectInsightChangesResult = {
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
    }

    for (const newInsight of input.newInsights ?? []) {
      const created = await this.createInsightUnlessDuplicate(projectUuid, newInsight)

      if (created.wasCreated) {
        result.created_count += 1
      } else {
        result.skipped_count += 1
      }
    }

    for (const update of input.updates ?? []) {
      const existingInsight = await ProjectInsight.query()
        .where('project_uuid', projectUuid)
        .andWhere('uuid', update.existingInsightUuid)
        .first()

      if (!existingInsight) {
        result.skipped_count += 1
        continue
      }

      let replacementInsightUuid: string | null = null

      const status = await this.getStatusByCode(update.operation)

      if (status.code === ProjectInsightStatusCode.Superseded && update.replacementInsight) {
        const replacement = await this.createInsightUnlessDuplicate(projectUuid, {
          ...update.replacementInsight,
          supersedesInsightUuid: existingInsight.uuid,
        })

        if (replacement.insight.uuid === existingInsight.uuid) {
          throw new ProjectInsightValidationError(
            `Superseding replacement insight must differ from existing insight: ${existingInsight.uuid}`
          )
        }

        replacementInsightUuid = replacement.insight.uuid

        if (replacement.wasCreated) {
          result.created_count += 1
        } else {
          result.skipped_count += 1

          if (!replacement.insight.supersedesInsightUuid) {
            replacement.insight.supersedesInsightUuid = existingInsight.uuid
            await replacement.insight.save()
          }
        }
      }

      existingInsight.statusId = status.id

      if (status.code === ProjectInsightStatusCode.Superseded) {
        existingInsight.supersededByInsightUuid = replacementInsightUuid
      }

      await existingInsight.save()
      result.updated_count += 1
    }

    return result
  }

  public static async ensureActiveProjectExists(projectUuid: string) {
    const project = await Project.query()
      .where('uuid', projectUuid)
      .andWhere('is_active', true)
      .first()

    if (!project) {
      throw new ProjectInsightProjectNotFoundError(projectUuid)
    }

    return project
  }

  private static async createInsightUnlessDuplicate(
    projectUuid: string,
    input: ProjectInsightInput
  ) {
    const [insightType, activeStatus] = await Promise.all([
      this.getTypeByCode(input.insightType),
      this.getStatusByCode(ProjectInsightStatusCode.Active),
    ])
    const normalizedText = this.normalizeInsightText(input.insightText)
    const duplicate = await this.findDuplicateActiveInsight(
      projectUuid,
      insightType.id,
      activeStatus.id,
      normalizedText
    )

    if (duplicate) {
      return { insight: duplicate, wasCreated: false }
    }

    const insight = await ProjectInsight.create({
      projectUuid,
      insightTypeId: insightType.id,
      statusId: activeStatus.id,
      insightText: input.insightText,
      importance: input.importance ?? 3,
      confidence: input.confidence ?? null,
      supersedesInsightUuid: input.supersedesInsightUuid ?? null,
    })

    return { insight, wasCreated: true }
  }

  private static async findDuplicateActiveInsight(
    projectUuid: string,
    insightTypeId: number,
    activeStatusId: number,
    normalizedText: string
  ) {
    const activeInsights = await ProjectInsight.query()
      .where('project_uuid', projectUuid)
      .andWhere('insight_type_id', insightTypeId)
      .andWhere('status_id', activeStatusId)

    return (
      activeInsights.find(
        (insight) => this.normalizeInsightText(insight.insightText) === normalizedText
      ) ?? null
    )
  }

  private static normalizeInsightText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  private static normalizeCode(code: string) {
    return code.trim().toUpperCase()
  }

  private static async getTypeByCode(code: string) {
    const normalizedCode = this.normalizeCode(code)
    const insightType = await ProjectInsightType.query()
      .where('code', normalizedCode)
      .andWhere('is_active', true)
      .first()

    if (!insightType) {
      throw new ProjectInsightValidationError(`Unknown insight type: ${code}`)
    }

    return insightType
  }

  private static async getStatusByCode(code: string) {
    const normalizedCode = this.normalizeCode(code)
    const status = await ProjectInsightStatus.query()
      .where('code', normalizedCode)
      .andWhere('is_active', true)
      .first()

    if (!status) {
      throw new ProjectInsightValidationError(`Unknown insight status: ${code}`)
    }

    return status
  }
}
