import { describe, expect, it } from 'vitest';
import type { Thread } from '../types';
import { groupThreads } from './ThreadGrouping';

function thread(id: string, cwd: string, updatedAt: number): Thread {
  return { id, cwd, updatedAt, title: id, preview: id, status: 'idle' };
}

describe('groupThreads', () => {
  it('puts the current workspace first and newest threads first within each workspace', () => {
    const groups = groupThreads([
      thread('other', 'C:/alpha', 30), thread('older', 'C:/repo', 10), thread('newer', 'C:/repo', 20)
    ], 'c:\\repo');
    expect(groups.map(group => group.label)).toEqual(['repo', 'alpha']);
    expect(groups[0]?.threads.map(value => value.id)).toEqual(['newer', 'older']);
  });
});
