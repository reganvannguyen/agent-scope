import type { State } from '../types';
import { post } from '../vscode';

export function PromptComposer({ state }: { state: State }): React.JSX.Element {
  const active = state.selectedThread?.status === 'active';
  const selectedModel = state.models.find(model => model.id === state.selection?.modelId);
  const canSend = state.connection === 'connected' && state.account?.signedIn === true && state.draft.trim() !== '' && state.selectedThread?.resumed === true;
  return <footer className="composer">
    <div className="pickers">
      <label>Model<select disabled={active} value={state.selection?.modelId ?? ''} onChange={event => post({ type: 'selectModel', modelId: event.target.value })}>{state.models.map(model => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>
      <label>Effort<select disabled={active} value={state.selection?.effort ?? ''} onChange={event => post({ type: 'selectEffort', effort: event.target.value })}>{selectedModel?.efforts.map(effort => <option key={effort.id} value={effort.id}>{effort.id}</option>)}</select></label>
      <label>Mode<select disabled={active || state.modes.length === 0} value={state.selectedMode} onChange={event => post({ type: 'selectMode', mode: event.target.value })}>{state.modes.map(mode => <option key={mode.mode} value={mode.mode}>{mode.name}</option>)}</select></label>
    </div>
    <div className="prompt-row"><textarea aria-label={active ? 'Additional guidance' : 'Message Codex'} placeholder={active ? 'Send additional guidance…' : 'Message Codex…'} value={state.draft} onChange={event => post({ type: 'setDraft', text: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && canSend) { event.preventDefault(); post({ type: 'sendMessage', text: state.draft }); } }} />
      {active ? <button className="stop" disabled={state.stopping} onClick={() => post({ type: 'interruptTurn' })}>{state.stopping ? 'Stopping…' : 'Stop'}</button> : null}
      <button disabled={!canSend} onClick={() => post({ type: 'sendMessage', text: state.draft })}>{active ? 'Guide' : 'Send'}</button></div>
  </footer>;
}
