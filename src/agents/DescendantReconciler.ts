import type { AgentEvent } from './AgentEventReducer';
import type { RuntimeAgentState } from './AgentModels';
import type { DiscoveredDescendant } from './DescendantDiscovery';

export function descendantEvents(state: RuntimeAgentState, rootThreadId: string, descendants: DiscoveredDescendant[], at = Date.now()): AgentEvent[] {
  const events: AgentEvent[] = [];
  let unnamed = 0;
  for (const descendant of descendants) {
    if (descendant.threadId === rootThreadId) continue;
    if (descendant.displayName === null && descendant.role === null) unnamed += 1;
    const existing = state.agents[descendant.threadId];
    const delegatedTask = existing?.delegatedTask ?? (descendant.preview.trim() === '' ? null : descendant.preview.slice(0, 200));
    const displayName = descendant.displayName ?? descendant.role ?? shortTask(delegatedTask) ?? `Subagent ${String(unnamed)}`;
    events.push({ type: 'agentUpserted', threadId: descendant.threadId, rootThreadId, parentThreadId: descendant.parentThreadId, displayName, role: descendant.role, delegatedTask, cwd: descendant.cwd, model: descendant.model, historical: descendant.status === 'notLoaded', at });
    events.push({ type: 'threadStatusChanged', threadId: descendant.threadId, status: descendant.status, activeFlags: descendant.activeFlags, at });
  }
  return events;
}

export function orphanThreadIds(state: RuntimeAgentState): string[] {
  return Object.values(state.agents).filter(agent => !agent.isRoot && (agent.parentThreadId === null || state.agents[agent.parentThreadId] === undefined)).map(agent => agent.threadId);
}
function shortTask(value: string | null): string | null { return value === null ? null : value.replace(/\s+/gu, ' ').trim().slice(0, 48) || null; }
