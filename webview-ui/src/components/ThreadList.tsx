import type { Thread } from '../types';
import { post } from '../vscode';
import { groupThreads, samePath } from './ThreadGrouping';

export function ThreadList({ threads, currentWorkspace, selectedId, hasMore, collapsed }: { threads: Thread[]; currentWorkspace?: string; selectedId?: string; hasMore: boolean; collapsed: boolean }): React.JSX.Element {
  if (collapsed) return <aside className="threads collapsed"><button aria-label="Expand recent threads" onClick={() => post({ type: 'setSidebarCollapsed', collapsed: false })}>›</button></aside>;
  return <aside className="threads" aria-label="Recent threads">
    <div className="thread-toolbar"><div className="aside-heading"><h2>Recent threads</h2><button aria-label="Collapse recent threads" onClick={() => post({ type: 'setSidebarCollapsed', collapsed: true })}>‹</button></div>
      <div className="thread-actions"><button onClick={() => post({ type: 'startThread' })}>New thread</button><button aria-label="Refresh threads" onClick={() => post({ type: 'refreshThreads' })}>↻</button></div></div>
    <nav>{groupThreads(threads, currentWorkspace).flatMap(group => [<h3 className="workspace-heading" title={group.cwd} key={`${group.cwd}:heading`}>{group.label}{samePath(group.cwd, currentWorkspace) ? ' (current)' : ''}</h3>, ...group.threads.map(thread => <button key={thread.id} className={`thread-row ${thread.id === selectedId ? 'selected' : ''}`} onClick={() => post({ type: 'previewThread', threadId: thread.id })}>
      <span>{thread.title}</span><small>{new Date(thread.updatedAt * 1000).toLocaleString()} · {thread.status}</small>
    </button>)])}</nav>
    {hasMore ? <button className="load-more" onClick={() => post({ type: 'loadMoreThreads' })}>Load more</button> : null}
  </aside>;
}
