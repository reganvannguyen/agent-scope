import { describe, expect, it } from 'vitest';
import type { ThreadDetail, ThreadSummary } from './AppState';
import { initialSessionWorkspace, materializeSessionDraft, mergeSessionLibrary, reorderVisibleSessions, selectSession, setSessionVisible, startSessionDraft } from './SessionWorkspace';

const summary = (id: string, updatedAt: number, status: ThreadSummary['status'] = 'idle'): ThreadSummary => ({ id, title: id, preview: id, cwd: 'C:/repo', status, updatedAt });
const detail = (id: string): ThreadDetail => ({ ...summary(id, 1), turns: [], resumed: true });

describe('session workspace state', () => {
  it('keeps visible order stable when library status and timestamps change', () => {
    let state = mergeSessionLibrary(initialSessionWorkspace(), [summary('a', 2), summary('b', 1)], false);
    state = setSessionVisible(setSessionVisible(state, 'b', true), 'a', true);
    state = mergeSessionLibrary(state, [summary('a', 99, 'active'), summary('b', 100, 'systemError')], false);
    expect(state.visibleSessionIds).toEqual(['b', 'a']);
    expect(state.library.a?.status).toBe('active');
    expect(state.library.b?.status).toBe('failed');
  });

  it('separates selection, chat visibility, and panel visibility', () => {
    let state = mergeSessionLibrary(initialSessionWorkspace(), [summary('a', 1)], false);
    state = selectSession(state, 'a', detail('a'));
    state = setSessionVisible(state, 'a', true);
    state = { ...state, chatOpen: false };
    expect(state.selectedSessionId).toBe('a');
    expect(state.visibleSessionIds).toEqual(['a']);
    expect(state.chatOpen).toBe(false);
  });

  it('materializes a draft only after a real thread exists', () => {
    let state = startSessionDraft(initialSessionWorkspace(), 'draft-1');
    expect(state.visibleSessionIds).toEqual([]);
    state = materializeSessionDraft(state, detail('real-1'));
    expect(state.draftNewSession).toBeUndefined();
    expect(state.selectedSessionId).toBe('real-1');
    expect(state.visibleSessionIds).toEqual(['real-1']);
  });

  it('allows only permutations of the current visible list', () => {
    let state = mergeSessionLibrary(initialSessionWorkspace(), [summary('a', 1), summary('b', 2)], false);
    state = setSessionVisible(setSessionVisible(state, 'a', true), 'b', true);
    expect(reorderVisibleSessions(state, ['b', 'a']).visibleSessionIds).toEqual(['b', 'a']);
    expect(() => reorderVisibleSessions(state, ['a'])).toThrow('same session IDs');
  });
});
