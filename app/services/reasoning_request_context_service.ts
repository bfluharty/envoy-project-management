import ConversationTurn from '#models/conversation_turn'
import OutreachDraft from '#models/outreach_draft'
import Project from '#models/project'
import ProjectInsight from '#models/project_insight'
import ProjectVendor from '#models/project_vendor'
import ProjectInsightService from '#services/project_insight_service'
import type User from '#models/user'
import {
  AgentId,
  ProjectContext,
  ReasoningProjectInsight,
  ReasoningRecentTurn,
  StakeholderDetails,
} from '../../types/request.js'

export default class ReasoningRequestContextService {
  public static readonly ACTIVE_INSIGHT_LIMIT = 30
  public static readonly RECENT_TURN_LIMIT = 5

  public static async buildContext(projectUuid: string, conversationUuid: string) {
    const [projectInsights, recentTurns] = await Promise.all([
      this.getProjectInsights(projectUuid),
      this.getRecentTurns(conversationUuid),
    ])

    return {
      projectInsights,
      recentTurns,
    }
  }

  public static getStakeholderDetails(user: Pick<User, 'fullName'>): StakeholderDetails {
    return {
      name: user.fullName?.trim() || 'N/A',
    }
  }

  public static async buildProjectContext(
    project: Project,
    options: { descriptionFallback?: string | null } = {}
  ): Promise<ProjectContext> {
    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', project.uuid)
      .where('is_active', true)
      .preload('vendor', (q) => q.preload('vendorListing'))

    const projectVendorUuids = projectVendors.map((pv) => pv.uuid)
    const existingDrafts = projectVendorUuids.length
      ? await OutreachDraft.query()
          .whereIn('project_vendor_uuid', projectVendorUuids)
          .where('status', 'draft')
      : []

    const vendorEmailByPvUuid = new Map(
      projectVendors.map((pv) => [pv.uuid, pv.vendor.vendorListing.email ?? null])
    )

    return {
      uuid: project.uuid,
      name: project.title,
      description: project.description ?? options.descriptionFallback ?? null,
      location: project.location ?? null,
      startDate: project.startDate?.toISODate() ?? null,
      endDate: project.endDate?.toISODate() ?? null,
      deadline: project.deadline?.toISODate() ?? null,
      budgetAmount: project.budgetAmount ?? null,
      budgetCurrency: null,
      goals: project.goals ?? null,
      vendors: projectVendors.map((pv) => ({
        uuid: pv.uuid,
        name: pv.vendor.vendorListing.name,
        email: pv.vendor.vendorListing.email ?? null,
        category: pv.vendor.vendorListing.categories?.[0] ?? null,
        website: pv.vendor.vendorListing.website ?? null,
      })),
      existingDrafts: existingDrafts.map((draft) => ({
        draftUuid: draft.uuid,
        vendorEmail: vendorEmailByPvUuid.get(draft.projectVendorUuid) ?? null,
        subject: draft.subject,
      })),
      details: {
        location: project.location ?? 'N/A',
        startDate: project.startDate?.toISODate() ?? 'N/A',
        endDate: project.endDate?.toISODate() ?? 'N/A',
        deadline: project.deadline?.toISODate() ?? 'N/A',
        budgetAmount: project.budgetAmount ?? 'N/A',
        goals: project.goals ?? 'N/A',
      },
    }
  }

  public static async getProjectInsights(projectUuid: string): Promise<ReasoningProjectInsight[]> {
    const insights = await ProjectInsightService.getActiveInsightsByProject(
      projectUuid,
      this.ACTIVE_INSIGHT_LIMIT
    )

    return insights.map((insight) => this.toProjectInsightPayload(insight))
  }

  public static async getRecentTurns(conversationUuid: string): Promise<ReasoningRecentTurn[]> {
    const turns = await ConversationTurn.query()
      .where('conversation_uuid', conversationUuid)
      .orderBy('timestamp', 'desc')
      .orderBy('id', 'desc')
      .limit(this.RECENT_TURN_LIMIT)

    return turns
      .reverse()
      .filter((turn) => this.isAgentId(turn.contents?.agentId))
      .map((turn) => ({
        agentId: turn.contents.agentId,
        userPrompt: turn.contents.userPrompt ?? '',
        modelResponse: turn.contents.modelResponse ?? '',
        timestamp: turn.contents.timestamp ?? turn.timestamp.toISO() ?? new Date().toISOString(),
      }))
  }

  private static toProjectInsightPayload(insight: ProjectInsight): ReasoningProjectInsight {
    return {
      uuid: insight.uuid,
      type: insight.insightType.code.toLowerCase(),
      text: insight.insightText,
      importance: Number(insight.importance),
      confidence:
        insight.confidence === null || insight.confidence === undefined
          ? null
          : Number(insight.confidence),
    }
  }

  private static isAgentId(value: unknown): value is AgentId {
    return value === 'INTAKE' || value === 'PLANNING' || value === 'OUTREACH'
  }
}
