import { isRecord } from '../codex/ProtocolTypes';
import type { AgentEvent } from './AgentEventReducer';

export function mapCollaborationItem(value: unknown, rootThreadId: string, at = Date.now()): AgentEvent[] {
  if (!isRecord(value) || (value.type !== 'collabAgentToolCall' && value.type !== 'collabToolCall') || typeof value.tool !== 'string' || typeof value.senderThreadId !== 'string' || value.senderThreadId.trim() === '') return [];
  const tool = normalizeTool(value.tool);
  if (tool === undefined) return [];
  const receivers = receiverIds(value);
  if (tool === 'spawnAgent') {
    const child = typeof value.newThreadId === 'string' && value.newThreadId.trim() !== '' ? value.newThreadId : receivers[0];
    if (child === undefined || child === value.senderThreadId) return [];
    const prompt = typeof value.prompt === 'string' && value.prompt.trim() !== '' ? value.prompt : null;
    return [{ type: 'agentUpserted', threadId: child, rootThreadId, parentThreadId: value.senderThreadId, displayName: shortName(prompt), delegatedTask: prompt, at }];
  }
  const events: AgentEvent[] = [];
  for (const receiver of receivers) {
    if (receiver === value.senderThreadId) continue;
    const status = collaborationStatus(tool, value.status, agentState(value, receiver));
    if (status !== undefined) events.push({ type: 'threadStatusChanged', threadId: receiver, status, at });
  }
  return events;
}

function receiverIds(value: Record<string, unknown>): string[] {
  const candidates = Array.isArray(value.receiverThreadIds) ? value.receiverThreadIds : [value.receiverThreadId];
  return [...new Set(candidates.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== ''))];
}
function normalizeTool(value: string): 'spawnAgent' | 'sendInput' | 'resumeAgent' | 'wait' | 'closeAgent' | undefined {
  const compact = value.replace(/_/gu, '').toLocaleLowerCase();
  return compact === 'spawnagent' ? 'spawnAgent' : compact === 'sendinput' ? 'sendInput' : compact === 'resumeagent' ? 'resumeAgent' : compact === 'wait' ? 'wait' : compact === 'closeagent' ? 'closeAgent' : undefined;
}
function collaborationStatus(tool: string, itemStatus: unknown, agentStatus: unknown): 'active' | 'idle' | 'systemError' | undefined {
  if (itemStatus === 'failed' || agentStatus === 'errored' || agentStatus === 'notFound') return 'systemError';
  if (agentStatus === 'completed' || agentStatus === 'shutdown' || tool === 'closeAgent') return 'idle';
  if (agentStatus === 'running' || agentStatus === 'pendingInit' || tool === 'resumeAgent' || tool === 'sendInput') return 'active';
  return undefined;
}
function agentState(value: Record<string, unknown>, id: string): unknown {
  if (!isRecord(value.agentsStates) || !isRecord(value.agentsStates[id])) return undefined;
  return value.agentsStates[id].status;
}
function shortName(prompt: string | null): string { return prompt === null ? 'Subagent' : prompt.replace(/\s+/gu, ' ').trim().slice(0, 48); }
