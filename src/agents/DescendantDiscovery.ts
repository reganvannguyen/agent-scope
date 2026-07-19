import { isRecord } from '../codex/ProtocolTypes';
import type { RpcClient } from '../codex/RpcClient';
import type { ThreadRuntimeStatus } from './AgentModels';

export interface DiscoveredDescendant {
  threadId: string;
  parentThreadId: string | null;
  displayName: string | null;
  role: string | null;
  preview: string;
  status: ThreadRuntimeStatus;
  activeFlags: string[];
  cwd: string | null;
  model: string | null;
  createdAt: number;
  updatedAt: number;
}

export class DescendantDiscovery {
  private running = false;
  private generation = 0;
  public constructor(private readonly client: RpcClient) {}

  public cancel(): void { this.generation += 1; }

  public async list(rootThreadId: string): Promise<DiscoveredDescendant[]> {
    if (this.running) return [];
    this.running = true;
    const generation = this.generation;
    try {
      const descendants: DiscoveredDescendant[] = [];
      let cursor: string | null = null;
      do {
        const raw: unknown = await this.client.request<unknown>('thread/list', {
          cursor, ancestorThreadId: rootThreadId, sourceKinds: ['subAgent', 'subAgentReview', 'subAgentCompact', 'subAgentThreadSpawn', 'subAgentOther'],
          sortKey: 'created_at', sortDirection: 'asc', archived: false
        });
        if (generation !== this.generation) return [];
        if (!isRecord(raw) || !Array.isArray(raw.data) || (raw.nextCursor !== null && typeof raw.nextCursor !== 'string')) throw new Error('Invalid descendant thread/list response');
        for (const value of raw.data) { const parsed = parseDescendant(value); if (parsed !== undefined) descendants.push(parsed); }
        cursor = raw.nextCursor;
      } while (cursor !== null);
      return [...new Map(descendants.map(item => [item.threadId, item])).values()];
    } catch (error) {
      if (isUnsupported(error)) throw new DescendantApiUnsupportedError();
      throw error;
    } finally { this.running = false; }
  }
}

export class DescendantApiUnsupportedError extends Error {
  public constructor() { super('Descendant recovery is limited because this Codex App Server does not support ancestor thread filters. Live collaboration events remain available.'); this.name = 'DescendantApiUnsupportedError'; }
}

function parseDescendant(value: unknown): DiscoveredDescendant | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '' || typeof value.preview !== 'string' || typeof value.createdAt !== 'number' || typeof value.updatedAt !== 'number') return undefined;
  const parsedStatus = parseStatus(value.status);
  if (parsedStatus === undefined) return undefined;
  return { threadId: value.id, parentThreadId: typeof value.parentThreadId === 'string' ? value.parentThreadId : null, displayName: typeof value.agentNickname === 'string' ? value.agentNickname : typeof value.name === 'string' ? value.name : null, role: typeof value.agentRole === 'string' ? value.agentRole : null, preview: value.preview, status: parsedStatus.status, activeFlags: parsedStatus.flags, cwd: typeof value.cwd === 'string' ? value.cwd : null, model: typeof value.model === 'string' ? value.model : typeof value.modelProvider === 'string' ? value.modelProvider : null, createdAt: value.createdAt, updatedAt: value.updatedAt };
}
function parseStatus(value: unknown): { status: ThreadRuntimeStatus; flags: string[] } | undefined {
  if (!isRecord(value) || (value.type !== 'notLoaded' && value.type !== 'idle' && value.type !== 'active' && value.type !== 'systemError')) return undefined;
  return { status: value.type, flags: Array.isArray(value.activeFlags) ? value.activeFlags.filter((flag): flag is string => typeof flag === 'string') : [] };
}
function isUnsupported(error: unknown): boolean { const message = error instanceof Error ? error.message : String(error); return /(?:unsupported|unknown field|experimental|invalid params|method not found)/iu.test(message); }
