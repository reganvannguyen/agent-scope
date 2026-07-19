import { useState } from 'react';
import type { State } from '../../types';
import { post } from '../../vscode';
import { ConversationView } from '../ConversationView';
import { GraphCanvas } from '../graph/GraphCanvas';
import { ProjectMapSetup } from '../project-map/ProjectMapSetup';

export function VisualWorkspace({ state, mode }: { state: State; mode: 'combined' | 'agents' | 'project' }): React.JSX.Element {
  const [chatWidth, setChatWidth] = useState(420);
  const missingMap = state.visualization?.projectMap === undefined;
  if (mode === 'project' && ((state.projectSuggestions?.length ?? 0) > 0 || state.visualization?.projectMap?.components.length === 0)) return <ProjectMapSetup state={state} />;
  if (mode === 'project' && missingMap) return <section className="map-empty"><h2>No project architecture map has been configured.</h2><p>Scan deterministic project metadata or create the architecture manually.</p><div><button onClick={() => post({ type: 'scanProjectMap' })}>Scan Project</button><button onClick={() => post({ type: 'initializeProjectMap' })}>Create Manually</button></div></section>;
  const resize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const startX = event.clientX; const startWidth = chatWidth;
    const move = (pointer: PointerEvent): void => setChatWidth(Math.max(260, Math.min(760, startWidth + startX - pointer.clientX)));
    const stop = (): void => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); document.body.classList.remove('resizing-combined'); };
    document.body.classList.add('resizing-combined'); document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
  };
  const combined = mode === 'combined';
  return <section className={`visual-workspace mode-${combined ? 'combined' : 'map'}`} style={combined ? { gridTemplateColumns: `minmax(300px, 1fr) 5px ${String(chatWidth)}px` } : undefined}><div className="visual-main"><GraphCanvas state={state} mode={mode} /></div>{combined ? <><div className="combined-divider" role="separator" aria-orientation="vertical" onPointerDown={resize} /><div className="combined-chat"><ConversationView thread={state.selectedThread} /></div></> : null}</section>;
}
