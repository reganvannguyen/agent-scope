export type AgentStatus =
  | 'connecting' | 'idle' | 'thinking' | 'planning' | 'reading' | 'editing' | 'testing'
  | 'running-command' | 'using-tool' | 'searching-web' | 'delegating' | 'waiting-agent'
  | 'waiting-approval' | 'waiting-input' | 'completed' | 'interrupted' | 'failed' | 'disconnected';

export type ThreadRuntimeStatus = 'notLoaded' | 'idle' | 'active' | 'systemError';
export type AgentActivityType = 'thinking' | 'planning' | 'reading' | 'editing' | 'testing' | 'command' | 'tool' | 'web' | 'delegating' | 'waiting' | 'responding' | 'other';
export type AgentActivityStatus = 'active' | 'completed' | 'failed' | 'declined';

export interface ActivityEvidence { type: string; value: string }

export interface AgentActivity {
  id: string;
  threadId: string;
  turnId: string | null;
  itemId: string | null;
  type: AgentActivityType;
  label: string;
  startedAt: number;
  completedAt: number | null;
  status: AgentActivityStatus;
  command: string | null;
  cwd: string | null;
  files: string[];
  toolServer: string | null;
  toolName: string | null;
  domain: string | null;
  evidence: ActivityEvidence[];
}

export interface RuntimeAgent {
  id: string;
  threadId: string;
  parentThreadId: string | null;
  rootThreadId: string;
  displayName: string;
  role: string | null;
  delegatedTask: string | null;
  status: AgentStatus;
  threadStatus: ThreadRuntimeStatus | null;
  activeFlags: string[];
  currentActivity: AgentActivity | null;
  recentActivities: AgentActivity[];
  activeTurnId: string | null;
  model: string | null;
  cwd: string | null;
  createdAt: number;
  updatedAt: number;
  activeSince: number | null;
  completedAt: number | null;
  error: string | null;
  isRoot: boolean;
  isHistorical: boolean;
}

export interface AgentHierarchyEdge {
  id: string;
  parentThreadId: string;
  childThreadId: string;
  delegatedTask: string | null;
  createdAt: number;
}

export interface RuntimeAgentState {
  rootThreadId: string | null;
  agents: Record<string, RuntimeAgent>;
  hierarchyEdges: Record<string, AgentHierarchyEdge>;
  maxRecentActivities: number;
}

export function initialRuntimeAgentState(maxRecentActivities = 50): RuntimeAgentState {
  return { rootThreadId: null, agents: {}, hierarchyEdges: {}, maxRecentActivities };
}
