import type { Memento } from 'vscode';

const selectedThreadKey = 'codexAgentMap.selectedThreadId';

export class SessionPersistence {
  public constructor(private readonly workspaceState: Memento) {}

  public get selectedThreadId(): string | undefined {
    const value = this.workspaceState.get<unknown>(selectedThreadKey);
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }

  public async rememberThread(threadId: string | undefined): Promise<void> {
    await this.workspaceState.update(selectedThreadKey, threadId);
  }
}
