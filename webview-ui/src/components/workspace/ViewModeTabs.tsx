import type { ViewMode } from '../../types';
import { post } from '../../vscode';
export function ViewModeTabs({ selected }: { selected: ViewMode }): React.JSX.Element { return <nav className="view-tabs" aria-label="Workspace view">{(['combined', 'chat'] as const).map(mode => <button className={mode === selected || (mode === 'combined' && selected !== 'chat') ? 'selected' : ''} aria-pressed={mode === selected || (mode === 'combined' && selected !== 'chat')} key={mode} onClick={() => post({ type: 'selectViewMode', mode })}>{mode === 'combined' ? 'Map + Chat' : 'Chat'}</button>)}</nav>; }
