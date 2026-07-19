import { describe, expect, it, vi } from 'vitest';
import type { RpcClient } from '../codex/RpcClient';
import { mapCollaborationItem } from './CollaborationEventMapper';
import { DescendantApiUnsupportedError, DescendantDiscovery } from './DescendantDiscovery';
import { descendantEvents, orphanThreadIds } from './DescendantReconciler';
import { reduceAgentEvent } from './AgentEventReducer';
import { initialRuntimeAgentState } from './AgentModels';

interface MockRpc extends RpcClient { requestMock: ReturnType<typeof vi.fn> }
function client(handler: (params: Record<string, unknown>) => unknown): MockRpc {
  const requestMock = vi.fn((_method: string, params: unknown) => Promise.resolve(handler(params as Record<string, unknown>)));
  return { request: requestMock as RpcClient['request'], requestMock };
}

describe('collaboration events', () => {
  it('creates a child from newThreadId and uses sender as its immediate parent', () => {
    expect(mapCollaborationItem({ type: 'collabToolCall', id: 'x', tool: 'spawn_agent', senderThreadId: 'parent', newThreadId: 'child', prompt: 'Inspect tests' }, 'root', 1)).toEqual([
      { type: 'agentUpserted', threadId: 'child', rootThreadId: 'root', parentThreadId: 'parent', displayName: 'Inspect tests', delegatedTask: 'Inspect tests', at: 1 }
    ]);
  });

  it('falls back to installed receiverThreadIds and handles send, resume, wait, close, and failures', () => {
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'spawnAgent', senderThreadId: 'root', receiverThreadIds: ['child'], prompt: null }, 'root')[0]).toMatchObject({ threadId: 'child' });
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'sendInput', senderThreadId: 'root', receiverThreadIds: ['child'] }, 'root')[0]).toMatchObject({ status: 'active' });
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'resumeAgent', senderThreadId: 'root', receiverThreadIds: ['child'] }, 'root')[0]).toMatchObject({ status: 'active' });
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'wait', senderThreadId: 'root', receiverThreadIds: ['child'], agentsStates: { child: { status: 'completed' } } }, 'root')[0]).toMatchObject({ status: 'idle' });
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'closeAgent', senderThreadId: 'root', receiverThreadIds: ['child'] }, 'root')[0]).toMatchObject({ status: 'idle' });
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'wait', status: 'failed', senderThreadId: 'root', receiverThreadIds: ['child'] }, 'root')[0]).toMatchObject({ status: 'systemError' });
  });

  it('does not create invalid children', () => {
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'spawnAgent', senderThreadId: 'root', receiverThreadIds: [] }, 'root')).toEqual([]);
    expect(mapCollaborationItem({ type: 'collabAgentToolCall', tool: 'spawnAgent', senderThreadId: '', receiverThreadIds: ['child'] }, 'root')).toEqual([]);
  });
});

describe('descendant discovery and reconciliation', () => {
  it('uses only ancestorThreadId, follows pagination, and preserves immediate parents and metadata', async () => {
    const rpc = client(params => params.cursor === null ? { data: [rawThread('child', 'root', 'Explorer', 'explorer')], nextCursor: 'next' } : { data: [rawThread('grandchild', 'child', null, 'auditor')], nextCursor: null });
    const descendants = await new DescendantDiscovery(rpc).list('root');
    expect(rpc.requestMock).toHaveBeenCalledTimes(2);
    for (const call of rpc.requestMock.mock.calls) {
      expect(call[1]).toMatchObject({ ancestorThreadId: 'root' });
      expect(call[1]).not.toHaveProperty('parentThreadId');
    }
    expect(descendants).toMatchObject([{ threadId: 'child', parentThreadId: 'root', displayName: 'Explorer' }, { threadId: 'grandchild', parentThreadId: 'child', role: 'auditor' }]);
  });

  it('repairs orphan relationships and identifies unresolved orphans', () => {
    let state = reduceAgentEvent(initialRuntimeAgentState(), { type: 'rootSelected', threadId: 'root', title: 'Main', cwd: null, at: 1 });
    state = reduceAgentEvent(state, { type: 'agentUpserted', threadId: 'child', rootThreadId: 'root', parentThreadId: null, displayName: 'Child', at: 2 });
    expect(orphanThreadIds(state)).toEqual(['child']);
    for (const event of descendantEvents(state, 'root', [parsedThread('child', 'root')], 3)) state = reduceAgentEvent(state, event);
    expect(orphanThreadIds(state)).toEqual([]);
    expect(state.agents.child?.parentThreadId).toBe('root');
  });

  it('prevents overlapping polls and cancels results when the root changes', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    const rpc = client(() => new Promise(resolve => { resolveRequest = resolve; }));
    const discovery = new DescendantDiscovery(rpc);
    const first = discovery.list('root');
    await expect(discovery.list('root')).resolves.toEqual([]);
    discovery.cancel();
    resolveRequest?.({ data: [rawThread('child', 'root', null, null)], nextCursor: null });
    await expect(first).resolves.toEqual([]);
  });

  it('degrades cleanly when experimental descendant filters are unsupported', async () => {
    const discovery = new DescendantDiscovery(client(() => Promise.reject(new Error('Invalid params: ancestorThreadId unsupported'))));
    await expect(discovery.list('root')).rejects.toBeInstanceOf(DescendantApiUnsupportedError);
  });
});

function rawThread(id: string, parentThreadId: string, agentNickname: string | null, agentRole: string | null): Record<string, unknown> {
  return { id, parentThreadId, agentNickname, agentRole, preview: 'Delegated task', status: { type: 'idle' }, cwd: 'C:/repo', modelProvider: 'openai', createdAt: 1, updatedAt: 2 };
}
function parsedThread(threadId: string, parentThreadId: string) {
  return { threadId, parentThreadId, displayName: null, role: null, preview: 'Task', status: 'idle' as const, activeFlags: [], cwd: 'C:/repo', model: null, createdAt: 1, updatedAt: 2 };
}
