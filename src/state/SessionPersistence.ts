import type { Memento } from 'vscode';

const selectedThreadKey = 'codexAgentMap.selectedThreadId';
const workspaceKey = 'codexAgentMap.sessionWorkspace.v1';

export interface SessionWorkspacePreferences {
  version: 1;
  visibleSessionIds: string[];
  selectedSessionId?: string;
  expandedSessionIds: string[];
  chatOpen: boolean;
  mapMode: 'focus' | 'compareVisible';
}

export class SessionPersistence {
  public constructor(private readonly workspaceState: Memento) {}

  public get selectedThreadId(): string | undefined {
    const value = this.preferences.selectedSessionId ?? this.workspaceState.get<unknown>(selectedThreadKey);
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }

  public get preferences(): SessionWorkspacePreferences {
    const value = this.workspaceState.get<unknown>(workspaceKey);
    if (!isRecord(value) || value.version !== 1) return { version: 1, visibleSessionIds: [], expandedSessionIds: [], chatOpen: false, mapMode: 'focus' };
    return {
      version: 1,
      visibleSessionIds: strings(value.visibleSessionIds),
      ...(typeof value.selectedSessionId === 'string' && value.selectedSessionId.trim() !== '' ? { selectedSessionId: value.selectedSessionId } : {}),
      expandedSessionIds: strings(value.expandedSessionIds),
      chatOpen: value.chatOpen === true,
      mapMode: value.mapMode === 'compareVisible' ? 'compareVisible' : 'focus'
    };
  }

  public async rememberThread(threadId: string | undefined): Promise<void> {
    await this.workspaceState.update(selectedThreadKey, threadId);
  }

  public async save(preferences: SessionWorkspacePreferences): Promise<void> { await this.workspaceState.update(workspaceKey, preferences); }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function strings(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))] : []; }
