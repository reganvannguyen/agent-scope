import { mapAgentActivity } from '../agents/AgentActivityMapper';
import { reduceAgentEvent } from '../agents/AgentEventReducer';
import { mapCollaborationItem } from '../agents/CollaborationEventMapper';
import type { RuntimeAgent, RuntimeAgentState } from '../agents/AgentModels';
import { initialRuntimeAgentState } from '../agents/AgentModels';
import { isRecord } from '../codex/ProtocolTypes';
import type { ThreadDetail } from '../state/AppState';
import { matchActivity } from '../project-map/ActivityConnectionMapper';
import type { ProjectMap } from '../project-map/ProjectMapModels';
import { reduceVisualization, type TrailSettings } from './VisualizationReducer';
import { initialVisualizationState, type AgentProjectConnection, type ProjectComponentRuntimeState, type VisualizationState } from './VisualizationState';

export interface VisualizationSnapshot { agents: Record<string, RuntimeAgent>; hierarchyEdges: RuntimeAgentState['hierarchyEdges']; projectMap?: ProjectMap; connections: Record<string, AgentProjectConnection>; componentRuntime: Record<string, ProjectComponentRuntimeState>; unmappedActivityCount: number; demo: boolean }

export class VisualizationCoordinator {
  private state: VisualizationState = initialVisualizationState(initialRuntimeAgentState());
  public constructor(private readonly roots: string[], private readonly settings: TrailSettings) {}
  public get snapshot(): VisualizationSnapshot { return { agents: this.state.agents.agents, hierarchyEdges: this.state.agents.hierarchyEdges, ...(this.state.projectMap === undefined ? {} : { projectMap: this.state.projectMap }), connections: this.state.connections, componentRuntime: this.state.componentRuntime, unmappedActivityCount: this.state.unmappedActivityCount, demo: this.state.demo }; }
  public get agentState(): RuntimeAgentState { return this.state.agents; }
  public selectRoot(thread: ThreadDetail, at = Date.now()): void { const agents = reduceAgentEvent(initialRuntimeAgentState(), { type: 'rootSelected', threadId: thread.id, title: thread.title, cwd: thread.cwd, model: thread.model ?? null, historical: !thread.resumed, at }); const projectMap = this.state.projectMap; this.state = { ...initialVisualizationState(agents), ...(projectMap === undefined ? {} : { projectMap }), componentRuntime: this.state.componentRuntime }; }
  public applyAgentEvents(events: Parameters<typeof reduceAgentEvent>[1][]): void { let agents = this.state.agents; for (const event of events) agents = reduceAgentEvent(agents, event); this.state = reduceVisualization(this.state, { type: 'agentsReplaced', agents }, this.settings); }
  public loadProjectMap(map: ProjectMap): void { this.state = reduceVisualization(this.state, { type: 'projectMapLoaded', map }, this.settings); }
  public approval(threadId: string, pending: boolean, input = false, at = Date.now()): void { this.applyAgentEvents([{ type: 'approvalChanged', threadId, pending, input, at }]); }
  public disconnected(at = Date.now()): void { this.applyAgentEvents([{ type: 'disconnected', at }]); }
  public expire(at = Date.now()): void { this.state = reduceVisualization(this.state, { type: 'expire', at }, this.settings); }
  public setDemo(active: boolean): void { this.state = reduceVisualization(this.state, { type: 'demoChanged', active }, this.settings); }
  public notification(method: string, params: unknown, at = Date.now()): void {
    if (!isRecord(params) || typeof params.threadId !== 'string') return;
    const threadId = params.threadId;
    if (method === 'thread/status/changed' && isRecord(params.status) && typeof params.status.type === 'string') {
      const status = params.status.type; if (status === 'notLoaded' || status === 'idle' || status === 'active' || status === 'systemError') this.applyAgentEvents([{ type: 'threadStatusChanged', threadId, status, activeFlags: Array.isArray(params.status.activeFlags) ? params.status.activeFlags.filter((item): item is string => typeof item === 'string') : [], at }]);
      return;
    }
    if (method === 'turn/started' && isRecord(params.turn) && typeof params.turn.id === 'string') { this.applyAgentEvents([{ type: 'turnStarted', threadId, turnId: params.turn.id, at }]); return; }
    if (method === 'turn/completed' && isRecord(params.turn)) { const status = params.turn.status; this.applyAgentEvents([{ type: 'turnCompleted', threadId, outcome: status === 'failed' ? 'failed' : status === 'interrupted' ? 'interrupted' : 'completed', at }]); this.state = reduceVisualization(this.state, { type: 'activityEnded', agentThreadId: threadId, outcome: status === 'failed' ? 'failed' : 'completed', at }, this.settings); return; }
    if ((method === 'item/started' || method === 'item/completed') && isRecord(params.item)) {
      const root = this.state.agents.rootThreadId; if (root !== null && params.item.type === 'collabAgentToolCall') this.applyAgentEvents(mapCollaborationItem(params.item, root, at));
      const turnId = typeof params.turnId === 'string' ? params.turnId : null; const activity = mapAgentActivity(threadId, turnId, params.item, at);
      if (activity === undefined) return;
      if (method === 'item/started') { this.applyAgentEvents([{ type: 'activityStarted', activity, at }]); const matches = matchActivity(params.item, this.roots, this.state.projectMap?.components ?? []); this.state = reduceVisualization(this.state, matches.length === 0 ? { type: 'unmappedActivity' } : { type: 'activityMatched', agentThreadId: threadId, matches, at }, this.settings); }
      else { const outcome = itemOutcome(params.item); this.applyAgentEvents([{ type: 'activityCompleted', threadId, activityId: activity.id, outcome, at }]); this.state = reduceVisualization(this.state, { type: 'activityEnded', agentThreadId: threadId, outcome, files: activity.files, at }, this.settings); }
    }
  }
}

function itemOutcome(value: Record<string, unknown>): 'completed' | 'failed' | 'declined' { const status = value.status; return status === 'failed' ? 'failed' : status === 'declined' ? 'declined' : 'completed'; }
