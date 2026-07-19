import { useEffect, useState } from 'react';
import { ConnectionStatus } from './components/ConnectionStatus';
import { PromptComposer } from './components/PromptComposer';
import { ResizableWorkspace } from './components/ResizableWorkspace';
import { emptyState, type State } from './types';
import { post, vscode } from './vscode';

export function App(): React.JSX.Element {
  const [state, setState] = useState<State>(() => (vscode.getState() as State | null) ?? emptyState);
  useEffect(() => {
    const listener = (event: MessageEvent<unknown>): void => {
      if (typeof event.data !== 'object' || event.data === null) return;
      const message = event.data as { type?: unknown; state?: unknown };
      if (message.type === 'stateSnapshot' && typeof message.state === 'object' && message.state !== null) {
        const next = message.state as State; setState(next); vscode.setState(next);
      }
    };
    window.addEventListener('message', listener); post({ type: 'ready' });
    return () => window.removeEventListener('message', listener);
  }, []);
  const activeWarning = state.warning?.startsWith('This thread may be active');
  return <div className="app-shell">
    <header className="app-header"><div><h1>Codex Workspace</h1><span>{state.selectedThread?.cwd ?? 'Current workspace'}</span></div><ConnectionStatus state={state.connection} account={state.account} /></header>
    {state.error ? <div className="banner error" role="alert"><span>{state.error}</span><button onClick={() => post({ type: 'openOutputChannel' })}>Open output</button></div> : null}
    {state.warning ? <div className="banner warning" role="status"><span>{state.warning}</span>{activeWarning && state.selectedThread ? <button onClick={() => post({ type: 'resumeThread', threadId: state.selectedThread?.id, confirmActive: true })}>Resume anyway</button> : null}</div> : null}
    <ResizableWorkspace state={state} />
    <PromptComposer state={state} />
  </div>;
}
