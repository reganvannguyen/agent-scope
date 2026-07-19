import { describe, expect, it } from 'vitest';
import { reduceNotification } from './ConversationReducer';
import type { ThreadDetail } from './AppState';

function thread(): ThreadDetail {
  return { id: 'thread-1', title: 'Test', preview: '', cwd: 'C:/repo', status: 'active', updatedAt: 1, resumed: true, turns: [
    { id: 'turn-1', status: 'inProgress', items: [] }
  ] };
}

describe('reduceNotification', () => {
  it('appends agent deltas and reconciles the completed item', () => {
    let result = reduceNotification(thread(), 'item/agentMessage/delta', {
      threadId: 'thread-1', turnId: 'turn-1', itemId: 'a1', delta: 'Hel'
    });
    result = reduceNotification(result.thread, 'item/agentMessage/delta', {
      threadId: 'thread-1', turnId: 'turn-1', itemId: 'a1', delta: 'lo'
    });
    expect(result.thread.turns[0]?.items[0]?.text).toBe('Hello');
    result = reduceNotification(result.thread, 'item/completed', {
      threadId: 'thread-1', turnId: 'turn-1', item: { id: 'a1', type: 'agentMessage', text: 'Hello authoritative' }
    });
    expect(result.thread.turns[0]?.items).toEqual([{ id: 'a1', type: 'agentMessage', text: 'Hello authoritative' }]);
  });

  it('processes authoritative plan and diff updates', () => {
    let result = reduceNotification(thread(), 'turn/plan/updated', {
      threadId: 'thread-1', turnId: 'turn-1', plan: [{ step: 'Inspect', status: 'completed' }, { step: 'Build', status: 'inProgress' }]
    });
    result = reduceNotification(result.thread, 'turn/diff/updated', {
      threadId: 'thread-1', turnId: 'turn-1', diff: '+change'
    });
    expect(result.thread.turns[0]?.items.map(item => item.type)).toEqual(['plan', 'diff']);
  });

  it('applies final turn status and reports errors and warnings', () => {
    const completed = reduceNotification(thread(), 'turn/completed', {
      threadId: 'thread-1', turn: { id: 'turn-1', status: 'interrupted', items: [], error: null }
    });
    expect(completed).toMatchObject({ completedTurnId: 'turn-1', thread: { status: 'idle', turns: [{ status: 'interrupted' }] } });
    expect(reduceNotification(thread(), 'error', { threadId: 'thread-1', error: { message: 'limit reached' } }).error).toBe('limit reached');
    expect(reduceNotification(thread(), 'warning', { threadId: 'thread-1', message: 'Be careful' }).warning).toBe('Be careful');
  });

  it('bounds streamed command output', () => {
    const result = reduceNotification(thread(), 'item/commandExecution/outputDelta', {
      threadId: 'thread-1', turnId: 'turn-1', itemId: 'cmd', delta: 'x'.repeat(21_000)
    });
    expect(result.thread.turns[0]?.items[0]?.text?.length).toBeLessThan(20_100);
  });
});
