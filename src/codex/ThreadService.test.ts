import { describe, expect, it, vi } from 'vitest';
import { ThreadService } from './ThreadService';
import type { RpcClient } from './RpcClient';

const baseThread = {
  id: 'thread-1', preview: 'Hello\nworld', name: null, cwd: 'C:/repo', updatedAt: 10,
  status: { type: 'idle' }, turns: []
};

function mockClient(handler: (method: string, params: unknown) => unknown): RpcClient {
  return { request: vi.fn((method: string, params: unknown) => Promise.resolve(handler(method, params))) as RpcClient['request'] };
}

describe('ThreadService', () => {
  it('lists only current-project threads with pagination', async () => {
    const client = mockClient((method, params) => {
      expect(method).toBe('thread/list');
      expect(params).toMatchObject({ cwd: 'C:/repo', sortDirection: 'desc' });
      return { data: [baseThread, { ...baseThread, id: 'other', cwd: 'C:/other' }], nextCursor: 'next', backwardsCursor: null };
    });
    await expect(new ThreadService(client, 'C:/repo').list()).resolves.toEqual({
      threads: [{ id: 'thread-1', title: 'Hello', preview: 'Hello\nworld', cwd: 'C:/repo', status: 'idle', updatedAt: 10 }],
      nextCursor: 'next'
    });
  });

  it('hides legacy server threads that never received a prompt', async () => {
    const client = mockClient(() => ({ data: [{ ...baseThread, id: 'empty', preview: '' }, baseThread], nextCursor: null }));
    await expect(new ThreadService(client).list()).resolves.toMatchObject({ threads: [{ id: 'thread-1' }] });
  });

  it('reads complete history without resuming and excludes hidden reasoning content', async () => {
    const client = mockClient((method, params) => {
      expect(method).toBe('thread/read');
      expect(params).toEqual({ threadId: 'thread-1', includeTurns: true });
      return { thread: { ...baseThread, turns: [{
        id: 'turn-1', status: 'completed', startedAt: 1, completedAt: 2, error: null,
        items: [
          { id: 'u1', type: 'userMessage', content: [{ type: 'text', text: 'Hi' }] },
          { id: 'r1', type: 'reasoning', summary: ['Checked files'], content: ['private chain'] },
          { id: 'a1', type: 'agentMessage', text: 'Hello' }
        ]
      }] } };
    });
    const thread = await new ThreadService(client).read('thread-1');
    expect(thread.resumed).toBe(false);
    expect(thread.turns[0]?.items).toEqual([
      { id: 'u1', type: 'userMessage', text: 'Hi' },
      { id: 'r1', type: 'reasoning', text: 'Checked files' },
      { id: 'a1', type: 'agentMessage', text: 'Hello' }
    ]);
    expect(JSON.stringify(thread)).not.toContain('private chain');
  });

  it('starts and resumes threads while preserving authoritative model and effort', async () => {
    const client = mockClient(method => method === 'thread/start'
      ? { thread: baseThread }
      : { thread: baseThread, model: 'gpt-test', reasoningEffort: 'high' });
    const service = new ThreadService(client);
    await expect(service.start('gpt-test')).resolves.toMatchObject({ id: 'thread-1', resumed: true });
    await expect(service.resume({ ...baseThread, title: 'Hello', status: 'idle', turns: [], resumed: false })).resolves.toMatchObject({
      model: 'gpt-test', effort: 'high', thread: { model: 'gpt-test', effort: 'high', resumed: true }
    });
  });

  it('requires confirmation before resuming an active thread', async () => {
    const service = new ThreadService(mockClient(() => ({})));
    await expect(service.resume({ ...baseThread, title: 'Hello', status: 'active', turns: [], resumed: false }))
      .rejects.toThrow('ACTIVE_THREAD_CONFIRMATION_REQUIRED');
  });

  it('bounds retained command output', async () => {
    const client = mockClient(() => ({ thread: { ...baseThread, turns: [{
      id: 'turn', status: 'completed', items: [{ id: 'cmd', type: 'commandExecution', command: 'x', cwd: 'C:/repo', status: 'completed', aggregatedOutput: 'a'.repeat(21_000) }]
    }] } }));
    const result = await new ThreadService(client).read('thread-1');
    expect(result.turns[0]?.items[0]?.text?.length).toBeLessThan(20_100);
  });
});
