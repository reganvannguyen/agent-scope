import { isRecord } from '../codex/ProtocolTypes';
import { normalizeItem, normalizeTurn } from '../codex/ThreadService';
import type { ConversationItem, ThreadDetail } from './AppState';

export interface ReductionResult { thread: ThreadDetail; error?: string; warning?: string; completedTurnId?: string; }

export function reduceNotification(thread: ThreadDetail, method: string, params: unknown): ReductionResult {
  if (!isRecord(params) || params.threadId !== thread.id) return { thread };
  const copy: ThreadDetail = { ...thread, turns: thread.turns.map(turn => ({ ...turn, items: turn.items.map(item => ({ ...item })) })) };
  if (method === 'turn/started') {
    const turn = normalizeTurn(params.turn);
    if (turn !== undefined) upsertTurn(copy, turn);
  } else if (method === 'item/started' || method === 'item/completed') {
    const item = normalizeItem(params.item);
    if (item !== undefined && typeof params.turnId === 'string') upsertItem(copy, params.turnId, item);
  } else if (method === 'item/agentMessage/delta' || method === 'item/plan/delta') {
    appendDelta(copy, params, method === 'item/plan/delta' ? 'plan' : 'agentMessage');
  } else if (method === 'item/commandExecution/outputDelta' || method === 'item/fileChange/outputDelta') {
    appendDelta(copy, params, method.includes('commandExecution') ? 'commandExecution' : 'fileChange');
  } else if (method === 'turn/plan/updated' && typeof params.turnId === 'string' && Array.isArray(params.plan)) {
    const text = params.plan.flatMap(step => isRecord(step) && typeof step.step === 'string'
      ? [`${typeof step.status === 'string' ? step.status : 'pending'}: ${step.step}`] : []).join('\n');
    upsertItem(copy, params.turnId, { id: `plan:${params.turnId}`, type: 'plan', text, status: 'updated' });
  } else if (method === 'turn/diff/updated' && typeof params.turnId === 'string' && typeof params.diff === 'string') {
    upsertItem(copy, params.turnId, { id: `diff:${params.turnId}`, type: 'diff', title: 'Aggregated turn diff', text: bound(params.diff) });
  } else if (method === 'turn/completed') {
    const turn = normalizeTurn(params.turn);
    if (turn !== undefined) {
      upsertTurn(copy, turn);
      copy.status = 'idle';
      return { thread: copy, completedTurnId: turn.id };
    }
  } else if (method === 'error') {
    const message = isRecord(params.error) && typeof params.error.message === 'string' ? params.error.message : 'Codex turn failed';
    return { thread: copy, error: message };
  } else if (method === 'warning' && typeof params.message === 'string') {
    return { thread: copy, warning: params.message };
  }
  return { thread: copy };
}

function upsertTurn(thread: ThreadDetail, turn: ThreadDetail['turns'][number]): void {
  const index = thread.turns.findIndex(item => item.id === turn.id);
  if (index === -1) thread.turns.push(turn); else thread.turns[index] = turn;
  if (turn.status === 'inProgress') thread.status = 'active';
}

function upsertItem(thread: ThreadDetail, turnId: string, item: ConversationItem): void {
  const turn = thread.turns.find(entry => entry.id === turnId);
  if (turn === undefined) return;
  const index = turn.items.findIndex(entry => entry.id === item.id);
  if (index === -1) turn.items.push(item); else turn.items[index] = item;
}

function appendDelta(thread: ThreadDetail, params: Record<string, unknown>, type: string): void {
  if (typeof params.turnId !== 'string' || typeof params.itemId !== 'string' || typeof params.delta !== 'string') return;
  const turn = thread.turns.find(entry => entry.id === params.turnId);
  if (turn === undefined) return;
  let item = turn.items.find(entry => entry.id === params.itemId);
  if (item === undefined) {
    item = { id: params.itemId, type };
    turn.items.push(item);
  }
  item.text = bound(`${item.text ?? ''}${params.delta}`);
}

function bound(value: string): string { return value.length > 20_000 ? `…truncated…\n${value.slice(-20_000)}` : value; }
