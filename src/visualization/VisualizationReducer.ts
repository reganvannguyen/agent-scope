import type { RuntimeAgentState } from '../agents/AgentModels';
import type { ComponentMatch } from '../project-map/ActivityMatchingModels';
import type { ProjectMap } from '../project-map/ProjectMapModels';
import { emptyComponentRuntime, type AgentProjectConnection, type VisualizationState } from './VisualizationState';

export interface TrailSettings { durationSeconds: number; showInferred: boolean; maxRecentPerAgent: number }
export type VisualizationEvent =
  | { type: 'agentsReplaced'; agents: RuntimeAgentState }
  | { type: 'projectMapLoaded'; map: ProjectMap }
  | { type: 'activityMatched'; agentThreadId: string; matches: ComponentMatch[]; at: number }
  | { type: 'activityEnded'; agentThreadId: string; outcome: 'completed' | 'failed' | 'declined'; files?: string[]; at: number }
  | { type: 'approvalChanged'; componentId: string; delta: 1 | -1; at: number }
  | { type: 'expire'; at: number }
  | { type: 'unmappedActivity' }
  | { type: 'demoChanged'; active: boolean };

export function reduceVisualization(state: VisualizationState, event: VisualizationEvent, settings: TrailSettings): VisualizationState {
  if (event.type === 'agentsReplaced') return { ...state, agents: event.agents };
  if (event.type === 'projectMapLoaded') return { ...state, projectMap: event.map, componentRuntime: aggregate(state.connections, event.map, state.componentRuntime) };
  if (event.type === 'unmappedActivity') return { ...state, unmappedActivityCount: state.unmappedActivityCount + 1 };
  if (event.type === 'demoChanged') return { ...state, demo: event.active };
  if (event.type === 'approvalChanged') {
    const previous = state.componentRuntime[event.componentId] ?? emptyComponentRuntime(event.componentId);
    return { ...state, componentRuntime: { ...state.componentRuntime, [event.componentId]: { ...previous, pendingApprovalCount: Math.max(0, previous.pendingApprovalCount + event.delta), lastActivityAt: event.at } } };
  }
  let connections = { ...state.connections };
  if (event.type === 'activityMatched') {
    for (const match of event.matches) {
      if (match.confidence === 'inferred' && !settings.showInferred) continue;
      const id = connectionId(event.agentThreadId, match.componentId, match.activityType); const previous = connections[id];
      connections[id] = { id, agentThreadId: event.agentThreadId, componentId: match.componentId, activityType: match.activityType, confidence: previous?.confidence === 'confirmed' ? 'confirmed' : match.confidence, state: 'current', firstSeenAt: previous?.firstSeenAt ?? event.at, lastSeenAt: event.at, expiresAt: null, evidence: dedupeEvidence([...(previous?.evidence ?? []), ...match.evidence]) };
    }
  } else if (event.type === 'activityEnded') {
    for (const [id, connection] of Object.entries(connections)) if (connection.agentThreadId === event.agentThreadId && connection.state === 'current') connections[id] = { ...connection, state: 'recent', lastSeenAt: event.at, expiresAt: settings.durationSeconds === 0 ? event.at : event.at + settings.durationSeconds * 1_000 };
    connections = limitRecent(connections, event.agentThreadId, settings.maxRecentPerAgent);
  } else {
    connections = Object.fromEntries(Object.entries(connections).filter(([, connection]) => connection.state === 'current' || connection.expiresAt === null || connection.expiresAt > event.at));
  }
  const runtime = aggregate(connections, state.projectMap, state.componentRuntime);
  if (event.type === 'activityEnded') {
    for (const connection of Object.values(connections).filter(item => item.agentThreadId === event.agentThreadId)) {
      const previous = runtime[connection.componentId] ?? emptyComponentRuntime(connection.componentId);
      runtime[connection.componentId] = { ...previous, recentlyTouchedFiles: [...new Set([...previous.recentlyTouchedFiles, ...(event.files ?? [])])].slice(-20), completedChangeCount: previous.completedChangeCount + (event.outcome === 'completed' && connection.activityType === 'editing' ? 1 : 0), failedChangeCount: previous.failedChangeCount + (event.outcome === 'failed' && connection.activityType === 'editing' ? 1 : 0), declinedChangeCount: previous.declinedChangeCount + (event.outcome === 'declined' && connection.activityType === 'editing' ? 1 : 0), lastActivityAt: event.at };
    }
  }
  return { ...state, connections, componentRuntime: runtime };
}

function aggregate(connections: Record<string, AgentProjectConnection>, map: ProjectMap | undefined, previous: VisualizationState['componentRuntime']): VisualizationState['componentRuntime'] {
  const result: VisualizationState['componentRuntime'] = {};
  for (const component of map?.components ?? []) { const prior = previous[component.id] ?? emptyComponentRuntime(component.id); result[component.id] = { ...prior, activeAgentIds: [], recentAgentIds: [], activeActivityTypes: [] }; }
  for (const connection of Object.values(connections)) { const prior = result[connection.componentId] ?? previous[connection.componentId] ?? emptyComponentRuntime(connection.componentId); result[connection.componentId] = { ...prior, activeAgentIds: connection.state === 'current' ? [...new Set([...prior.activeAgentIds, connection.agentThreadId])] : prior.activeAgentIds, recentAgentIds: connection.state === 'recent' ? [...new Set([...prior.recentAgentIds, connection.agentThreadId])] : prior.recentAgentIds, activeActivityTypes: connection.state === 'current' ? [...new Set([...prior.activeActivityTypes, connection.activityType])] : prior.activeActivityTypes, lastActivityAt: connection.lastSeenAt }; }
  return result;
}
function connectionId(agent: string, component: string, activity: string): string { return `activity:${agent}:${component}:${activity}`; }
function dedupeEvidence(values: AgentProjectConnection['evidence']): AgentProjectConnection['evidence'] { return [...new Map(values.map(item => [JSON.stringify(item), item])).values()].slice(-20); }
function limitRecent(values: Record<string, AgentProjectConnection>, agent: string, limit: number): Record<string, AgentProjectConnection> { const recent = Object.values(values).filter(item => item.agentThreadId === agent && item.state === 'recent').sort((a, b) => b.lastSeenAt - a.lastSeenAt); const remove = new Set(recent.slice(limit).map(item => item.id)); return Object.fromEntries(Object.entries(values).filter(([id]) => !remove.has(id))); }
