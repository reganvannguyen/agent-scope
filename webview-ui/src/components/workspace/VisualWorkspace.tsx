import type { State } from '../../types';
import { post } from '../../vscode';
import { ConversationView } from '../ConversationView';
import { GraphDetailsPanel } from '../details/GraphDetailsPanel';
import { GraphCanvas } from '../graph/GraphCanvas';
import { ProjectMapSetup } from '../project-map/ProjectMapSetup';

export function VisualWorkspace({ state, mode }: { state: State; mode: 'combined' | 'agents' | 'project' }): React.JSX.Element {
  const missingMap = state.visualization?.projectMap === undefined;
  if (mode === 'project' && ((state.projectSuggestions?.length ?? 0) > 0 || state.visualization?.projectMap?.components.length === 0)) return <ProjectMapSetup state={state} />;
  if (mode === 'project' && missingMap) return <section className="map-empty"><h2>No project architecture map has been configured.</h2><p>Scan deterministic project metadata or create the architecture manually.</p><div><button onClick={() => post({ type: 'scanProjectMap' })}>Scan Project</button><button onClick={() => post({ type: 'initializeProjectMap' })}>Create Manually</button></div></section>;
  return <section className={`visual-workspace mode-${mode}`}><div className="visual-main"><GraphCanvas state={state} mode={mode} /></div>{mode === 'combined' ? <div className="combined-chat"><ConversationView thread={state.selectedThread} /></div> : null}<GraphDetailsPanel state={state} /></section>;
}
