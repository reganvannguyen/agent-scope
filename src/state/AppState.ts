import type { AccountState } from '../codex/AccountService';
import type { CollaborationModeOption } from '../codex/CollaborationModeService';
import type { ModelOption, ModelSelection } from '../codex/ModelService';
import type { ConnectionState } from '../codex/ProtocolTypes';
import type { PendingServerRequest } from '../codex/ApprovalService';
import type { ArchitectureSuggestion } from '../project-map/ProjectMapScanner';
import type { VisualizationSnapshot } from '../visualization/VisualizationCoordinator';

export interface ConversationItem {
  id: string;
  type: string;
  text?: string;
  status?: string;
  title?: string;
  detail?: string;
  paths?: string[];
}

export interface ConversationTurn {
  id: string;
  status: string;
  items: ConversationItem[];
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ThreadSummary {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  status: 'notLoaded' | 'idle' | 'active' | 'systemError';
  updatedAt: number;
}

export interface ThreadDetail extends ThreadSummary {
  turns: ConversationTurn[];
  model?: string;
  effort?: string;
  resumed: boolean;
  localOnly?: boolean;
}

export interface AppState {
  connection: ConnectionState;
  workspaceCwd?: string;
  account?: AccountState;
  models: ModelOption[];
  modes: CollaborationModeOption[];
  selection?: ModelSelection;
  selectedMode: 'default' | 'plan';
  threads: ThreadSummary[];
  nextThreadCursor: string | null;
  selectedThread?: ThreadDetail;
  draft: string;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  composerHeight: number;
  viewMode: 'combined' | 'agents' | 'project' | 'chat';
  visualization?: VisualizationSnapshot;
  selectedGraphEntity?: { kind: 'agent' | 'component'; id: string };
  projectSuggestions: ArchitectureSuggestion[];
  pendingRequests: PendingServerRequest[];
  stopping: boolean;
  error?: string;
  warning?: string;
}

export function initialAppState(): AppState {
  return {
    connection: 'stopped', models: [], modes: [], selectedMode: 'default', threads: [], nextThreadCursor: null,
    draft: '', sidebarCollapsed: false, sidebarWidth: 250, composerHeight: 112, viewMode: 'combined', projectSuggestions: [], pendingRequests: [], stopping: false
  };
}
