import { useEffect, useRef, useState } from 'react';
import type { State } from '../types';
import { post } from '../vscode';

export function PromptComposer({ state }: { state: State }): React.JSX.Element {
  const [height, setHeight] = useState(state.composerHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  useEffect(() => { if (!dragging.current) setHeight(state.composerHeight); }, [state.composerHeight]);
  useEffect(() => {
    const move = (event: PointerEvent): void => {
      if (!dragging.current) return;
      setHeight(clampHeight(startHeight.current + startY.current - event.clientY));
    };
    const stop = (): void => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove('resizing-composer');
      setHeight(current => { post({ type: 'setComposerHeight', height: current }); return current; });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); document.body.classList.remove('resizing-composer'); };
  }, []);
  const active = state.selectedThread?.status === 'active';
  const selectedModel = state.models.find(model => model.id === state.selection?.modelId);
  const canSend = state.connection === 'connected' && state.account?.signedIn === true && state.draft.trim() !== '' && state.selectedThread?.resumed === true;
  const resizeBy = (delta: number): void => { const next = clampHeight(height + delta); setHeight(next); post({ type: 'setComposerHeight', height: next }); };
  return <footer className="composer" style={{ height }}>
    <div className="composer-divider" role="separator" aria-label="Resize message composer" aria-orientation="horizontal" aria-valuemin={96} aria-valuemax={360} aria-valuenow={height} tabIndex={0}
      onPointerDown={event => { event.preventDefault(); dragging.current = true; startY.current = event.clientY; startHeight.current = height; document.body.classList.add('resizing-composer'); }}
      onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); resizeBy(10); } else if (event.key === 'ArrowDown') { event.preventDefault(); resizeBy(-10); } }}><span /></div>
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
function clampHeight(value: number): number { return Math.round(Math.max(96, Math.min(360, value))); }
