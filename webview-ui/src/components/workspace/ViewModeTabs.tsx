import type { ViewMode } from '../../types';
import { post } from '../../vscode';
export function ViewModeTabs({ selected }: { selected: ViewMode }): React.JSX.Element {
  const modes = [{ mode: 'combined' as const, label: 'Map + Chat' }, { mode: 'agents' as const, label: 'Map' }, { mode: 'chat' as const, label: 'Chat' }];
  return <nav className="view-tabs" aria-label="Workspace view">{modes.map(item => <button className={item.mode === selected ? 'selected' : ''} aria-pressed={item.mode === selected} key={item.mode} onClick={() => post({ type: 'selectViewMode', mode: item.mode })}>{item.label}</button>)}</nav>;
}
