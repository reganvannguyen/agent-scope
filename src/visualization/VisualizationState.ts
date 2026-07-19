import type { RuntimeAgentState } from '../agents/AgentModels';
import type { MatchingEvidence, MatchConfidence, ProjectActivityType } from '../project-map/ActivityMatchingModels';
import type { ProjectMap } from '../project-map/ProjectMapModels';

export interface AgentProjectConnection { id: string; agentThreadId: string; componentId: string; activityType: ProjectActivityType; confidence: MatchConfidence; state: 'current' | 'recent'; firstSeenAt: number; lastSeenAt: number; expiresAt: number | null; evidence: MatchingEvidence[] }
export interface ProjectComponentRuntimeState { componentId: string; activeAgentIds: string[]; recentAgentIds: string[]; activeActivityTypes: ProjectActivityType[]; recentlyTouchedFiles: string[]; completedChangeCount: number; failedChangeCount: number; declinedChangeCount: number; pendingApprovalCount: number; lastActivityAt: number | null }
export interface VisualizationState { agents: RuntimeAgentState; projectMap?: ProjectMap; connections: Record<string, AgentProjectConnection>; componentRuntime: Record<string, ProjectComponentRuntimeState>; unmappedActivityCount: number; demo: boolean }
export function initialVisualizationState(agents: RuntimeAgentState): VisualizationState { return { agents, connections: {}, componentRuntime: {}, unmappedActivityCount: 0, demo: false }; }
export function emptyComponentRuntime(componentId: string): ProjectComponentRuntimeState { return { componentId, activeAgentIds: [], recentAgentIds: [], activeActivityTypes: [], recentlyTouchedFiles: [], completedChangeCount: 0, failedChangeCount: 0, declinedChangeCount: 0, pendingApprovalCount: 0, lastActivityAt: null }; }
