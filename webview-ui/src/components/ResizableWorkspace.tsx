import { useEffect, useRef, useState } from 'react';
import type { State } from '../types';
import { post } from '../vscode';
import { ApprovalPanel } from './ApprovalPanel';
import { ConversationView } from './ConversationView';
import { ThreadList } from './ThreadList';

const minimum = 160;
const maximum = 480;

export function ResizableWorkspace({ state }: { state: State }): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(state.sidebarWidth);
  const dragging = useRef(false);

  useEffect(() => { if (!dragging.current) setWidth(state.sidebarWidth); }, [state.sidebarWidth]);
  useEffect(() => {
    const move = (event: PointerEvent): void => {
      if (!dragging.current || container.current === null) return;
      const bounds = container.current.getBoundingClientRect();
      setWidth(clamp(event.clientX - bounds.left, bounds.width));
    };
    const stop = (): void => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove('resizing-panels');
      setWidth(current => { post({ type: 'setSidebarWidth', width: current }); return current; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.classList.remove('resizing-panels');
    };
  }, []);

  const resizeBy = (delta: number): void => {
    const bounds = container.current?.getBoundingClientRect();
    const next = clamp(width + delta, bounds?.width ?? maximum + 120);
    setWidth(next);
    post({ type: 'setSidebarWidth', width: next });
  };
  const columns = state.sidebarCollapsed ? '40px 0 minmax(0, 1fr)' : `${String(width)}px 5px minmax(0, 1fr)`;
  return <div ref={container} className={`workspace ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={{ gridTemplateColumns: columns }}>
    <ThreadList threads={state.threads} currentWorkspace={state.workspaceCwd} selectedId={state.selectedThread?.id} hasMore={state.nextThreadCursor !== null} collapsed={state.sidebarCollapsed} />
    <div className="panel-divider" role="separator" aria-label="Resize Recent Threads panel" aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(width)} tabIndex={state.sidebarCollapsed ? -1 : 0}
      onPointerDown={event => { if (state.sidebarCollapsed) return; event.preventDefault(); dragging.current = true; document.body.classList.add('resizing-panels'); }}
      onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); resizeBy(-10); } else if (event.key === 'ArrowRight') { event.preventDefault(); resizeBy(10); } }}><span /></div>
    <main><ConversationView thread={state.selectedThread} />{state.pendingRequests.map(request => <ApprovalPanel request={request} key={`${typeof request.id}:${String(request.id)}`} />)}</main>
  </div>;
}

function clamp(value: number, containerWidth: number): number {
  return Math.round(Math.max(minimum, Math.min(maximum, Math.min(value, containerWidth - 120))));
}
