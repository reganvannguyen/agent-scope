import type { AgentActivity, RuntimeAgent, RuntimeAgentState, ThreadRuntimeStatus } from './AgentModels';
import { activityStatus, mapThreadStatus } from './AgentStatusMapper';

export type AgentEvent =
  | { type: 'rootSelected'; threadId: string; title: string; cwd: string | null; model?: string | null; historical?: boolean; at: number }
  | { type: 'agentUpserted'; threadId: string; rootThreadId: string; parentThreadId: string | null; displayName: string; role?: string | null; delegatedTask?: string | null; cwd?: string | null; model?: string | null; historical?: boolean; at: number }
  | { type: 'threadStatusChanged'; threadId: string; status: ThreadRuntimeStatus; activeFlags?: string[]; at: number }
  | { type: 'turnStarted'; threadId: string; turnId: string; at: number }
  | { type: 'activityStarted'; activity: AgentActivity; at: number }
  | { type: 'activityCompleted'; threadId: string; activityId: string; outcome: 'completed' | 'failed' | 'declined'; at: number }
  | { type: 'turnCompleted'; threadId: string; outcome: 'completed' | 'interrupted' | 'failed'; at: number }
  | { type: 'approvalChanged'; threadId: string; pending: boolean; input?: boolean; at: number }
  | { type: 'disconnected'; at: number };

export function reduceAgentEvent(state: RuntimeAgentState, event: AgentEvent): RuntimeAgentState {
  const next: RuntimeAgentState = { ...state, agents: { ...state.agents }, hierarchyEdges: { ...state.hierarchyEdges } };
  if (event.type === 'rootSelected') {
    const existing = next.agents[event.threadId];
    next.rootThreadId = event.threadId;
    next.agents = {};
    next.hierarchyEdges = {};
    next.agents[event.threadId] = existing === undefined ? createAgent(event.threadId, event.threadId, null, event.title, true, event.at, event.cwd, event.model ?? null, event.historical ?? false) : { ...existing, displayName: event.title, cwd: event.cwd, isHistorical: event.historical ?? false, updatedAt: event.at };
    return next;
  }
  if (event.type === 'agentUpserted') {
    const existing = next.agents[event.threadId];
    next.agents[event.threadId] = existing === undefined
      ? createAgent(event.threadId, event.rootThreadId, event.parentThreadId, event.displayName, false, event.at, event.cwd ?? null, event.model ?? null, event.historical ?? false, event.role ?? null, event.delegatedTask ?? null)
      : { ...existing, parentThreadId: event.parentThreadId, displayName: event.displayName, role: event.role ?? existing.role, delegatedTask: event.delegatedTask ?? existing.delegatedTask, cwd: event.cwd ?? existing.cwd, model: event.model ?? existing.model, updatedAt: event.at };
    if (event.parentThreadId !== null) {
      const id = hierarchyId(event.parentThreadId, event.threadId);
      next.hierarchyEdges[id] = { id, parentThreadId: event.parentThreadId, childThreadId: event.threadId, delegatedTask: event.delegatedTask ?? null, createdAt: event.at };
    }
    return next;
  }
  if (event.type === 'disconnected') {
    for (const [id, agent] of Object.entries(next.agents)) next.agents[id] = { ...agent, status: 'disconnected', updatedAt: event.at };
    return next;
  }
  const threadId = event.type === 'activityStarted' ? event.activity.threadId : event.threadId;
  const agent = next.agents[threadId];
  if (agent === undefined) return state;
  if (event.type === 'threadStatusChanged') {
    const activeFlags = event.activeFlags ?? [];
    next.agents[event.threadId] = { ...agent, threadStatus: event.status, activeFlags, status: mapThreadStatus(event.status, activeFlags, agent.isRoot, agent.completedAt !== null), error: event.status === 'systemError' ? agent.error ?? 'Thread failed' : agent.error, updatedAt: event.at };
  } else if (event.type === 'turnStarted') {
    next.agents[event.threadId] = { ...agent, activeTurnId: event.turnId, activeSince: event.at, completedAt: null, error: null, status: 'thinking', updatedAt: event.at };
  } else if (event.type === 'activityStarted') {
    next.agents[threadId] = { ...agent, currentActivity: event.activity, status: activityStatus(event.activity.type), updatedAt: event.at };
  } else if (event.type === 'activityCompleted') {
    const activity = agent.currentActivity?.id === event.activityId ? { ...agent.currentActivity, status: event.outcome, completedAt: event.at } : undefined;
    const recent = activity === undefined ? agent.recentActivities : [activity, ...agent.recentActivities].slice(0, state.maxRecentActivities);
    next.agents[event.threadId] = { ...agent, currentActivity: activity === undefined ? agent.currentActivity : null, recentActivities: recent, status: activity?.status === 'failed' ? 'failed' : mapThreadStatus(agent.threadStatus ?? 'idle', agent.activeFlags, agent.isRoot, agent.completedAt !== null), error: activity?.status === 'failed' ? activity.label : agent.error, updatedAt: event.at };
  } else if (event.type === 'turnCompleted') {
    const current = agent.currentActivity === null ? null : { ...agent.currentActivity, status: event.outcome === 'failed' ? 'failed' as const : 'completed' as const, completedAt: event.at };
    const recent = current === null ? agent.recentActivities : [current, ...agent.recentActivities].slice(0, state.maxRecentActivities);
    const status = event.outcome === 'failed' ? 'failed' : agent.isRoot ? 'idle' : event.outcome === 'interrupted' ? 'interrupted' : 'completed';
    next.agents[event.threadId] = { ...agent, currentActivity: null, recentActivities: recent, activeTurnId: null, activeSince: null, completedAt: agent.isRoot ? null : event.at, threadStatus: 'idle', activeFlags: [], status, error: event.outcome === 'failed' ? agent.error ?? 'Turn failed' : null, updatedAt: event.at };
  } else {
    next.agents[event.threadId] = { ...agent, status: event.pending ? event.input === true ? 'waiting-input' : 'waiting-approval' : mapThreadStatus(agent.threadStatus ?? 'idle', [], agent.isRoot, agent.completedAt !== null), activeFlags: event.pending ? [event.input === true ? 'waitingOnUserInput' : 'waitingOnApproval'] : [], updatedAt: event.at };
  }
  return next;
}

function createAgent(threadId: string, rootThreadId: string, parentThreadId: string | null, displayName: string, isRoot: boolean, at: number, cwd: string | null, model: string | null, historical: boolean, role: string | null = null, delegatedTask: string | null = null): RuntimeAgent {
  return { id: threadId, threadId, parentThreadId, rootThreadId, displayName, role, delegatedTask, status: historical ? 'idle' : 'idle', threadStatus: 'idle', activeFlags: [], currentActivity: null, recentActivities: [], activeTurnId: null, model, cwd, createdAt: at, updatedAt: at, activeSince: null, completedAt: null, error: null, isRoot, isHistorical: historical };
}
function hierarchyId(parent: string, child: string): string { return `hierarchy:${parent}:${child}`; }
