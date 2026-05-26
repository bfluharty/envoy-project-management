import ConversationTurn from '#models/conversation_turn'
import ProjectInsight from '#models/project_insight'
import ProjectInsightService from '#services/project_insight_service'
import {
  ReasoningActionMetadata,
  ReasoningProjectInsight,
  ReasoningRecentTurn,
} from '../../types/request.js'
import { ActionExecution } from '../../types/turn.js'

export default class ReasoningRequestContextService {
  public static readonly ACTIVE_INSIGHT_LIMIT = 30
  public static readonly RECENT_TURN_LIMIT = 5

  public static async buildContext(projectUuid: string, conversationUuid: string) {
    const [projectInsights, recentTurns] = await Promise.all([
      this.getProjectInsights(projectUuid),
      this.getRecentTurns(conversationUuid),
    ])

    return {
      project_insights: projectInsights,
      recent_turns: recentTurns,
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

    return turns.reverse().map((turn) => ({
      user_message: turn.contents?.userPrompt ?? '',
      assistant_response: turn.contents?.modelResponse ?? '',
      action_metadata: (turn.contents?.actionExecutions ?? []).map((actionExecution) =>
        this.toActionMetadata(actionExecution)
      ),
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

  private static toActionMetadata(actionExecution: ActionExecution): ReasoningActionMetadata {
    return {
      action: actionExecution.action,
      success: actionExecution.success,
      error: actionExecution.error ?? null,
    }
  }
}
