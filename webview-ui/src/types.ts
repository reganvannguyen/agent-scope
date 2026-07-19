export interface AccountState { signedIn: boolean; type?: string; label?: string; planType?: string; requiresOpenaiAuth: boolean; }
export interface Model { id: string; displayName: string; description: string; isDefault: boolean; efforts: { id: string; description: string }[]; defaultEffort: string; }
export interface Mode { name: string; mode: 'default' | 'plan'; }
export interface Item { id: string; type: string; text?: string; status?: string; title?: string; detail?: string; paths?: string[]; }
export interface Turn { id: string; status: string; items: Item[]; error?: string; }
export interface Thread { id: string; title: string; preview: string; cwd: string; status: string; updatedAt: number; turns?: Turn[]; resumed?: boolean; model?: string; effort?: string; }
export interface PendingRequest { id: string | number; kind: 'command' | 'fileChange' | 'permissions' | 'userInput'; method: string; threadId: string; turnId: string; itemId: string; payload: Record<string, unknown>; state: string; }
export interface State {
  connection: string; account?: AccountState; models: Model[]; modes: Mode[];
  selection?: { modelId: string; effort: string }; selectedMode: 'default' | 'plan';
  threads: Thread[]; nextThreadCursor: string | null; selectedThread?: Thread;
  draft: string; sidebarCollapsed: boolean; sidebarWidth: number; pendingRequests: PendingRequest[]; stopping: boolean;
  error?: string; warning?: string;
}
export const emptyState: State = { connection: 'stopped', models: [], modes: [], selectedMode: 'default', threads: [], nextThreadCursor: null, draft: '', sidebarCollapsed: false, sidebarWidth: 250, pendingRequests: [], stopping: false };
