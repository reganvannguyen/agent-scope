import { isRecord } from '../codex/ProtocolTypes';
import type { AgentActivity, AgentActivityType } from './AgentModels';

export function mapAgentActivity(threadId: string, turnId: string | null, value: unknown, now = Date.now()): AgentActivity | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return undefined;
  const mapped = mapType(value);
  if (mapped === undefined) return undefined;
  const files = Array.isArray(value.changes) ? value.changes.flatMap(change => isRecord(change) && typeof change.path === 'string' ? [change.path] : []) : [];
  const command = typeof value.command === 'string' ? value.command : null;
  const server = typeof value.server === 'string' ? value.server : null;
  const tool = typeof value.tool === 'string' ? value.tool : null;
  return {
    id: `${threadId}:${value.id}`, threadId, turnId, itemId: value.id, type: mapped.type, label: mapped.label,
    startedAt: now, completedAt: null, status: 'active', command, cwd: typeof value.cwd === 'string' ? value.cwd : null,
    files, toolServer: server, toolName: tool, domain: null, evidence: []
  };
}

function mapType(value: Record<string, unknown>): { type: AgentActivityType; label: string } | undefined {
  if (value.type === 'reasoning') return { type: 'thinking', label: 'Thinking' };
  if (value.type === 'plan') return { type: 'planning', label: 'Planning' };
  if (value.type === 'commandExecution') {
    const command = typeof value.command === 'string' ? value.command : '';
    return isTestCommand(command) ? { type: 'testing', label: `Testing: ${safeLabel(command)}` } : { type: 'command', label: `Running: ${safeLabel(command)}` };
  }
  if (value.type === 'fileChange') {
    const count = Array.isArray(value.changes) ? value.changes.length : 0;
    return { type: 'editing', label: `Editing ${String(count)} file${count === 1 ? '' : 's'}` };
  }
  if (value.type === 'mcpToolCall' || value.type === 'dynamicToolCall') return { type: 'tool', label: `Using ${safeLabel(typeof value.tool === 'string' ? value.tool : 'tool')}` };
  if (value.type === 'webSearch') return { type: 'web', label: 'Searching the web' };
  if (value.type === 'collabAgentToolCall') {
    return value.tool === 'wait' ? { type: 'waiting', label: 'Waiting for agent' } : { type: 'delegating', label: 'Coordinating agents' };
  }
  if (value.type === 'agentMessage') return { type: 'responding', label: 'Writing response' };
  if (value.type === 'contextCompaction') return { type: 'thinking', label: 'Compacting context' };
  return undefined;
}

function isTestCommand(command: string): boolean { return /(?:^|\s)(?:pytest|vitest|jest|cargo\s+test|go\s+test|mvn\s+test|gradle\s+test|dotnet\s+test|npm\s+(?:run\s+)?test|pnpm\s+test|yarn\s+test)(?:\s|$)/iu.test(command); }
function safeLabel(value: string): string { return value.replace(/[\r\n\t]+/gu, ' ').trim().slice(0, 100) || 'activity'; }
