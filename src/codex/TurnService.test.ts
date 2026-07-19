import { describe, expect, it, vi } from 'vitest';
import type { RpcClient } from './RpcClient';
import { TurnService } from './TurnService';

function client(response: unknown, reject = false): RpcClient {
  return { request: vi.fn(() => reject ? Promise.reject(new Error('send failed')) : Promise.resolve(response)) as RpcClient['request'] };
}

describe('TurnService', () => {
  const turnResponse = { turn: { id: 'turn-1', status: 'inProgress', items: [], error: null } };

  it('starts a turn with valid text, model, effort, and Plan mode', async () => {
    const request = vi.fn(() => Promise.resolve(turnResponse));
    const rpc: RpcClient = { request: request as RpcClient['request'] };
    const service = new TurnService(rpc);
    await service.start('thread-1', '  Plan this  ', {
      model: 'gpt-test', effort: 'high', mode: { name: 'Plan', mode: 'plan' }
    });
    expect(request).toHaveBeenCalledWith('turn/start', {
      threadId: 'thread-1', input: [{ type: 'text', text: 'Plan this', text_elements: [] }],
      model: 'gpt-test', effort: 'high',
      collaborationMode: { mode: 'plan', settings: { model: 'gpt-test', reasoning_effort: 'high', developer_instructions: null } }
    });
    expect(service.activeId).toBe('turn-1');
  });

  it('rejects blank input and overlapping turns', async () => {
    const service = new TurnService(client(turnResponse));
    await expect(service.start('thread-1', ' ')).rejects.toThrow('blank');
    await service.start('thread-1', 'hello');
    await expect(service.start('thread-1', 'again')).rejects.toThrow('already active');
    service.complete('turn-1');
    expect(service.activeId).toBeUndefined();
  });

  it('does not mark a turn active when sending fails', async () => {
    const service = new TurnService(client({}, true));
    await expect(service.start('thread-1', 'hello')).rejects.toThrow('send failed');
    expect(service.activeId).toBeUndefined();
  });

  it('steers the active turn without changing its ID', async () => {
    const request = vi.fn((method: string) => Promise.resolve(method === 'turn/start' ? turnResponse : { turnId: 'turn-1' }));
    const service = new TurnService({ request: request as RpcClient['request'] });
    await service.start('thread-1', 'hello');
    await expect(service.steer('thread-1', ' backend first ')).resolves.toBe('turn-1');
    expect(request).toHaveBeenLastCalledWith('turn/steer', {
      threadId: 'thread-1', expectedTurnId: 'turn-1', input: [{ type: 'text', text: 'backend first', text_elements: [] }]
    });
  });

  it('waits for authoritative completion after interruption and prevents duplicate clicks', async () => {
    const request = vi.fn((method: string) => Promise.resolve(method === 'turn/start' ? turnResponse : {}));
    const service = new TurnService({ request: request as RpcClient['request'] });
    await service.start('thread-1', 'hello');
    await service.interrupt('thread-1');
    expect(service.activeId).toBe('turn-1');
    expect(service.isStopping).toBe(true);
    await expect(service.interrupt('thread-1')).rejects.toThrow('already in progress');
    service.complete('turn-1');
    expect(service.activeId).toBeUndefined();
  });
});
