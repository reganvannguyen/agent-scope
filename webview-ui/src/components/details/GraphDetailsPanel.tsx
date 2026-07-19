import type { State } from '../../types';
import { post } from '../../vscode';

export function GraphDetailsPanel({ state }: { state: State }): React.JSX.Element | null {
  const selection = state.selectedGraphEntity;
  if (selection === undefined) return null;
  if (selection.kind === 'agent') {
    const agent = state.visualization?.agents[selection.id];
    if (agent === undefined) return null;
    return <aside className="details-panel" aria-label="Agent details"><h2>{agent.isRoot ? 'Main Agent' : agent.displayName}</h2><dl><dt>Status</dt><dd>{agent.status}</dd><dt>Role</dt><dd>{agent.role ?? '—'}</dd><dt>Thread</dt><dd><code>{agent.threadId}</code></dd><dt>Parent</dt><dd>{agent.parentThreadId ?? 'Root'}</dd><dt>Task</dt><dd>{agent.delegatedTask ?? '—'}</dd><dt>Activity</dt><dd>{agent.currentActivity?.label ?? 'Idle'}</dd><dt>Model</dt><dd>{agent.model ?? '—'}</dd><dt>Workspace</dt><dd>{agent.cwd ?? '—'}</dd><dt>Error</dt><dd>{agent.error ?? '—'}</dd></dl>{agent.isRoot ? <button onClick={() => post({ type: 'selectViewMode', mode: 'chat' })}>Open Conversation</button> : <p className="inspection-only">Runtime subagents are inspection-only.</p>}</aside>;
  }
  const component = state.visualization?.projectMap?.components.find(item => item.id === selection.id);
  if (component === undefined) return null;
  const runtime = state.visualization?.componentRuntime[component.id];
  return <aside className="details-panel" aria-label="Project component details"><h2>{component.name}</h2><dl><dt>Type</dt><dd>{component.type}</dd><dt>Description</dt><dd>{component.description ?? '—'}</dd><dt>Paths</dt><dd>{component.paths.join(', ') || '—'}</dd><dt>Active agents</dt><dd>{runtime?.activeAgentIds.join(', ') || 'None'}</dd><dt>Current activity</dt><dd>{runtime?.activeActivityTypes.join(', ') || 'Idle'}</dd><dt>Recent files</dt><dd>{runtime?.recentlyTouchedFiles.join(', ') || 'None'}</dd><dt>Approvals</dt><dd>{runtime?.pendingApprovalCount ?? 0}</dd></dl><button onClick={() => post({ type: 'editProjectMap' })}>Edit Project Map</button></aside>;
}
