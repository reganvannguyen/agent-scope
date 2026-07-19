import { isRecord } from './ProtocolTypes';
import type { RpcClient } from './RpcClient';
import type { ConversationItem, ConversationTurn, ThreadDetail, ThreadSummary } from '../state/AppState';

export interface ThreadPage { threads: ThreadSummary[]; nextCursor: string | null; }
export interface ResumedThread { thread: ThreadDetail; model: string; effort?: string; }

export class ThreadService {
  public constructor(private readonly client: RpcClient, private readonly cwd?: string) {}

  public async list(cursor: string | null = null): Promise<ThreadPage> {
    const raw = await this.client.request<unknown>('thread/list', {
      cursor, cwd: this.cwd ?? null, sortKey: 'updated_at', sortDirection: 'desc', archived: false
    });
    if (!isRecord(raw) || !Array.isArray(raw.data) || (raw.nextCursor !== null && typeof raw.nextCursor !== 'string')) {
      throw new Error('Invalid thread/list response');
    }
    return { threads: raw.data.flatMap(value => { const item = parseSummary(value); return item === undefined ? [] : [item]; }), nextCursor: raw.nextCursor };
  }

  public async read(threadId: string): Promise<ThreadDetail> {
    requireId(threadId);
    const raw = await this.client.request<unknown>('thread/read', { threadId, includeTurns: true });
    const thread = isRecord(raw) ? parseThread(raw.thread, false) : undefined;
    if (thread === undefined) throw new Error('Invalid thread/read response');
    return thread;
  }

  public async start(model?: string): Promise<ThreadDetail> {
    const params: Record<string, unknown> = { cwd: this.cwd ?? null, experimentalRawEvents: false };
    if (model !== undefined) params.model = model;
    const raw = await this.client.request<unknown>('thread/start', params);
    const thread = isRecord(raw) ? parseThread(raw.thread, true) : undefined;
    if (thread === undefined) throw new Error('Invalid thread/start response');
    return thread;
  }

  public async resume(thread: ThreadDetail): Promise<ResumedThread> {
    if (thread.status === 'active') throw new Error('ACTIVE_THREAD_CONFIRMATION_REQUIRED');
    return this.resumeConfirmed(thread.id);
  }

  public async resumeConfirmed(threadId: string): Promise<ResumedThread> {
    requireId(threadId);
    const raw = await this.client.request<unknown>('thread/resume', { threadId, cwd: this.cwd ?? null });
    if (!isRecord(raw) || typeof raw.model !== 'string') throw new Error('Invalid thread/resume response');
    const thread = parseThread(raw.thread, true);
    if (thread === undefined) throw new Error('Invalid resumed thread data');
    const result: ResumedThread = { thread: { ...thread, model: raw.model }, model: raw.model };
    if (typeof raw.reasoningEffort === 'string') {
      result.effort = raw.reasoningEffort;
      result.thread.effort = raw.reasoningEffort;
    }
    return result;
  }
}

function parseThread(value: unknown, resumed: boolean): ThreadDetail | undefined {
  const summary = parseSummary(value);
  if (summary === undefined || !isRecord(value) || !Array.isArray(value.turns)) return undefined;
  return { ...summary, turns: value.turns.flatMap(turn => { const parsed = normalizeTurn(turn); return parsed === undefined ? [] : [parsed]; }), resumed };
}

function parseSummary(value: unknown): ThreadSummary | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.preview !== 'string' ||
      typeof value.cwd !== 'string' || typeof value.updatedAt !== 'number') return undefined;
  const status = parseThreadStatus(value.status);
  if (status === undefined) return undefined;
  return {
    id: value.id, title: typeof value.name === 'string' && value.name.trim() !== '' ? value.name : firstLine(value.preview),
    preview: value.preview, cwd: value.cwd, status, updatedAt: value.updatedAt
  };
}

export function normalizeTurn(value: unknown): ConversationTurn | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.status !== 'string' || !Array.isArray(value.items)) return undefined;
  const turn: ConversationTurn = { id: value.id, status: value.status, items: value.items.flatMap(item => { const parsed = normalizeItem(item); return parsed === undefined ? [] : [parsed]; }) };
  if (isRecord(value.error) && typeof value.error.message === 'string') turn.error = value.error.message;
  if (typeof value.startedAt === 'number') turn.startedAt = value.startedAt;
  if (typeof value.completedAt === 'number') turn.completedAt = value.completedAt;
  return turn;
}

export function normalizeItem(value: unknown): ConversationItem | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return undefined;
  if (value.type === 'userMessage' && Array.isArray(value.content)) {
    return { id: value.id, type: value.type, text: value.content.flatMap(input => isRecord(input) && input.type === 'text' && typeof input.text === 'string' ? [input.text] : []).join('\n') };
  }
  if ((value.type === 'agentMessage' || value.type === 'plan') && typeof value.text === 'string') return { id: value.id, type: value.type, text: value.text };
  if (value.type === 'reasoning') {
    const item: ConversationItem = { id: value.id, type: value.type };
    if (Array.isArray(value.summary)) item.text = value.summary.filter(entry => typeof entry === 'string').join('\n');
    return item;
  }
  if (value.type === 'commandExecution') return compactItem(value, value.command, value.cwd, value.aggregatedOutput);
  if (value.type === 'fileChange') {
    const paths = Array.isArray(value.changes) ? value.changes.flatMap(change => isRecord(change) && typeof change.path === 'string' ? [change.path] : []) : [];
    const item: ConversationItem = { id: value.id, type: value.type, title: `${String(paths.length)} file change(s)`, paths };
    if (typeof value.status === 'string') item.status = value.status;
    return item;
  }
  if (value.type === 'mcpToolCall') return compactItem(value, `${stringValue(value.server) ?? 'MCP'} / ${stringValue(value.tool) ?? 'tool'}`);
  if (value.type === 'dynamicToolCall') return compactItem(value, stringValue(value.tool));
  if (value.type === 'webSearch') return compactItem(value, 'Web search');
  const item: ConversationItem = { id: value.id, type: value.type };
  if (typeof value.status === 'string') item.status = value.status;
  return item;
}

function compactItem(value: Record<string, unknown>, title?: unknown, detail?: unknown, output?: unknown): ConversationItem {
  const item: ConversationItem = { id: String(value.id), type: String(value.type) };
  if (typeof title === 'string') item.title = title;
  if (typeof detail === 'string') item.detail = detail;
  if (typeof value.status === 'string') item.status = value.status;
  if (typeof output === 'string') item.text = output.length > 20_000 ? `…output truncated…\n${output.slice(-20_000)}` : output;
  return item;
}

function parseThreadStatus(value: unknown): ThreadSummary['status'] | undefined {
  return isRecord(value) && (value.type === 'notLoaded' || value.type === 'idle' || value.type === 'active' || value.type === 'systemError') ? value.type : undefined;
}
function firstLine(value: string): string { return value.split(/\r?\n/u)[0]?.slice(0, 80) || 'Untitled thread'; }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function requireId(value: string): void { if (value.trim() === '') throw new Error('Thread ID is required'); }
