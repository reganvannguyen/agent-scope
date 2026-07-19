export interface AccountState { signedIn: boolean; type?: string; label?: string; planType?: string; requiresOpenaiAuth: boolean; }
export interface Model { id: string; displayName: string; description: string; isDefault: boolean; efforts: { id: string; description: string }[]; defaultEffort: string; }
export interface Mode { name: string; mode: 'default' | 'plan'; }
export interface Item { id: string; type: string; text?: string; status?: string; title?: string; detail?: string; paths?: string[]; }
export interface Turn { id: string; status: string; items: Item[]; error?: string; }
export interface Thread { id: string; title: string; preview: string; cwd: string; status: string; updatedAt: number; turns?: Turn[]; resumed?: boolean; localOnly?: boolean; model?: string; effort?: string; }
export interface PendingRequest { id: string | number; kind: 'command' | 'fileChange' | 'permissions' | 'userInput'; method: string; threadId: string; turnId: string; itemId: string; payload: Record<string, unknown>; state: string; }
export type ViewMode = 'combined' | 'agents' | 'project' | 'chat';
export interface RuntimeAgent { threadId: string; parentThreadId: string | null; displayName: string; role: string | null; delegatedTask: string | null; status: string; currentActivity: { label: string } | null; recentActivities: Array<{ label: string; status: string }>; activeSince: number | null; completedAt: number | null; error: string | null; isRoot: boolean; cwd: string | null; model: string | null; }
export interface ProjectComponent { id: string; name: string; type: string; description?: string; paths: string[]; position: { x: number; y: number } }
export interface ProjectSuggestion { id: string; name: string; type: string; paths: string[]; confidence: string; evidence: string[] }
export interface ArchitectureEdge { id: string; source: string; target: string; type: string; label?: string }
export interface ActivityConnection { id: string; agentThreadId: string; componentId: string; activityType: string; confidence: 'confirmed' | 'inferred'; state: 'current' | 'recent' }
export interface Visualization { agents: Record<string, RuntimeAgent>; hierarchyEdges: Record<string, { id: string; parentThreadId: string; childThreadId: string }>; projectMap?: { project: { name: string }; components: ProjectComponent[]; edges: ArchitectureEdge[] }; connections: Record<string, ActivityConnection>; componentRuntime: Record<string, { activeAgentIds: string[]; activeActivityTypes: string[]; recentlyTouchedFiles: string[]; pendingApprovalCount: number }>; demo: boolean; }
export interface State {
  connection: string; workspaceCwd?: string; account?: AccountState; models: Model[]; modes: Mode[];
  selection?: { modelId: string; effort: string }; selectedMode: 'default' | 'plan';
  threads: Thread[]; nextThreadCursor: string | null; selectedThread?: Thread;
  draft: string; sidebarCollapsed: boolean; sidebarWidth: number; composerHeight: number; pendingRequests: PendingRequest[]; stopping: boolean;
  viewMode?: ViewMode; visualization?: Visualization; selectedGraphEntity?: { kind: 'agent' | 'component'; id: string };
  projectSuggestions?: ProjectSuggestion[];
  error?: string; warning?: string;
}
export const emptyState: State = { connection: 'stopped', models: [], modes: [], selectedMode: 'default', threads: [], nextThreadCursor: null, draft: '', sidebarCollapsed: false, sidebarWidth: 250, composerHeight: 112, pendingRequests: [], stopping: false };
