import { describe, expect, it, vi } from 'vitest';
import type { Memento } from 'vscode';
import { SessionPersistence } from './SessionPersistence';

function memento(initial?: unknown): Memento {
  let value = initial;
  return {
    keys: () => ['codexAgentMap.selectedThreadId'],
    get: vi.fn((_key: string, defaultValue?: unknown) => value ?? defaultValue),
    update: vi.fn((_key: string, next: unknown) => { value = next; return Promise.resolve(); })
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
});
