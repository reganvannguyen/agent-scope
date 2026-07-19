import type { Thread } from '../types';
import { post } from '../vscode';

export function ThreadList({ threads, selectedId, hasMore, collapsed }: { threads: Thread[]; selectedId?: string; hasMore: boolean; collapsed: boolean }): React.JSX.Element {
  if (collapsed) return <aside className="threads collapsed"><button aria-label="Expand recent threads" onClick={() => post({ type: 'setSidebarCollapsed', collapsed: false })}>›</button></aside>;
  return <aside className="threads" aria-label="Recent threads">
    <div className="aside-heading"><h2>Recent threads</h2><button aria-label="Collapse recent threads" onClick={() => post({ type: 'setSidebarCollapsed', collapsed: true })}>‹</button></div>
    <div className="thread-actions"><button onClick={() => post({ type: 'startThread' })}>New thread</button><button aria-label="Refresh threads" onClick={() => post({ type: 'refreshThreads' })}>↻</button></div>
    <nav>{threads.map(thread => <button key={thread.id} className={`thread-row ${thread.id === selectedId ? 'selected' : ''}`} onClick={() => post({ type: 'previewThread', threadId: thread.id })}>
      <span>{thread.title}</span><small>{new Date(thread.updatedAt * 1000).toLocaleString()} · {thread.status}</small>
    </button>)}</nav>
    {hasMore ? <button className="load-more" onClick={() => post({ type: 'loadMoreThreads' })}>Load more</button> : null}
  </aside>;
}
