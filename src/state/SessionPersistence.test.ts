import { describe, expect, it, vi } from 'vitest';
import type { Memento } from 'vscode';
import { SessionPersistence } from './SessionPersistence';

function memento(initial?: unknown): Memento {
  const values = new Map<string, unknown>(initial === undefined ? [] : [['codexAgentMap.selectedThreadId', initial]]);
  return {
    keys: () => [...values.keys()],
    get: vi.fn((key: string, defaultValue?: unknown) => values.get(key) ?? defaultValue),
    update: vi.fn((key: string, next: unknown) => { values.set(key, next); return Promise.resolve(); })
  };
}

describe('SessionPersistence', () => {
  it('restores and updates only a lightweight thread ID', async () => {
    const storage = memento('thread-1');
    const persistence = new SessionPersistence(storage);
    expect(persistence.selectedThreadId).toBe('thread-1');
    await persistence.rememberThread('thread-2');
    expect(persistence.selectedThreadId).toBe('thread-2');
  });

  it('rejects invalid persisted values', () => {
    expect(new SessionPersistence(memento({ prompt: 'private' })).selectedThreadId).toBeUndefined();
  });

  it('persists versioned lightweight session workspace preferences', async () => {
    const storage = memento(); const persistence = new SessionPersistence(storage);
    await persistence.save({ version: 1, visibleSessionIds: ['b', 'a'], selectedSessionId: 'a', expandedSessionIds: ['a'], chatOpen: true, mapMode: 'compareVisible' });
    expect(persistence.preferences).toEqual({ version: 1, visibleSessionIds: ['b', 'a'], selectedSessionId: 'a', expandedSessionIds: ['a'], chatOpen: true, mapMode: 'compareVisible' });
    expect(persistence.selectedThreadId).toBe('a');
  });
});
