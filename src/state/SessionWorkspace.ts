import type { ThreadDetail, ThreadSummary } from './AppState';

export type SessionStatus = 'active' | 'waiting' | 'completed' | 'failed' | 'paused' | 'idle' | 'unknown';
export interface DraftNewSession { draftId: string; text: string; state: 'editing' | 'submitting' }
export interface SessionRecord { id: string; title: string; cwd: string; status: SessionStatus; updatedAt: number; conversation?: ThreadDetail | undefined }
export interface SessionWorkspaceState {
  library: Record<string, SessionRecord>;
  libraryOrder: string[];
  visibleSessionIds: string[];
  selectedSessionId?: string | undefined;
  expandedSessionIds: string[];
  chatOpen: boolean;
  mapMode: 'focus' | 'compareVisible';
  selectedAgentId?: string | undefined;
  draftNewSession?: DraftNewSession | undefined;
}

export function initialSessionWorkspace(): SessionWorkspaceState {
  return { library: {}, libraryOrder: [], visibleSessionIds: [], expandedSessionIds: [], chatOpen: false, mapMode: 'focus' };
}

export function mergeSessionLibrary(state: SessionWorkspaceState, threads: ThreadSummary[], append: boolean): SessionWorkspaceState {
  const library = { ...state.library };
  for (const thread of threads) library[thread.id] = { ...library[thread.id], ...sessionRecord(thread), conversation: library[thread.id]?.conversation };
  const incoming = threads.map(thread => thread.id);
  const libraryOrder = append ? unique([...state.libraryOrder, ...incoming]) : unique([...incoming, ...state.libraryOrder.filter(id => library[id] !== undefined)]);
  return { ...state, library, libraryOrder };
}

export function selectSession(state: SessionWorkspaceState, sessionId: string, conversation?: ThreadDetail): SessionWorkspaceState {
  if (state.library[sessionId] === undefined) throw new Error('Unknown session ID');
  const library = conversation === undefined ? state.library : { ...state.library, [sessionId]: { ...state.library[sessionId], conversation, ...sessionRecord(conversation) } };
  return { ...state, library, selectedSessionId: sessionId, chatOpen: true, selectedAgentId: undefined };
}

export function setSessionVisible(state: SessionWorkspaceState, sessionId: string, visible: boolean): SessionWorkspaceState {
  if (state.library[sessionId] === undefined) throw new Error('Unknown session ID');
  return { ...state, visibleSessionIds: visible ? unique([...state.visibleSessionIds, sessionId]) : state.visibleSessionIds.filter(id => id !== sessionId) };
}

export function setSessionExpanded(state: SessionWorkspaceState, sessionId: string, expanded: boolean): SessionWorkspaceState {
  if (state.library[sessionId] === undefined) throw new Error('Unknown session ID');
  return { ...state, expandedSessionIds: expanded ? unique([...state.expandedSessionIds, sessionId]) : state.expandedSessionIds.filter(id => id !== sessionId) };
}

export function reorderVisibleSessions(state: SessionWorkspaceState, ids: string[]): SessionWorkspaceState {
  if (ids.length !== state.visibleSessionIds.length || new Set(ids).size !== ids.length || ids.some(id => !state.visibleSessionIds.includes(id))) throw new Error('Visible session order must contain the same session IDs');
  return { ...state, visibleSessionIds: [...ids] };
}

export function startSessionDraft(state: SessionWorkspaceState, draftId: string): SessionWorkspaceState {
  if (draftId.trim() === '') throw new Error('Draft ID is required');
  return { ...state, draftNewSession: { draftId, text: '', state: 'editing' }, chatOpen: true, selectedAgentId: undefined };
}

export function materializeSessionDraft(state: SessionWorkspaceState, thread: ThreadDetail): SessionWorkspaceState {
  const record = { ...sessionRecord(thread), conversation: thread };
  return { ...state, library: { ...state.library, [thread.id]: record }, libraryOrder: unique([thread.id, ...state.libraryOrder]), visibleSessionIds: unique([...state.visibleSessionIds, thread.id]), selectedSessionId: thread.id, chatOpen: true, draftNewSession: undefined };
}

export function sessionRecord(thread: ThreadSummary): SessionRecord {
  return { id: thread.id, title: thread.title, cwd: thread.cwd, status: sessionStatus(thread.status), updatedAt: thread.updatedAt };
}

function sessionStatus(status: ThreadSummary['status']): SessionStatus { return status === 'systemError' ? 'failed' : status === 'notLoaded' ? 'completed' : status; }
function unique(values: string[]): string[] { return [...new Set(values)]; }
