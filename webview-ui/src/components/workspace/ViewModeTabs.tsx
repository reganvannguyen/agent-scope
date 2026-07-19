import type { ViewMode } from '../../types';
import { post } from '../../vscode';
export function ViewModeTabs({ selected }: { selected: ViewMode }): React.JSX.Element { return <nav className="view-tabs" aria-label="Workspace view">{(['combined', 'agents', 'project', 'chat'] as const).map(mode => <button className={mode === selected ? 'selected' : ''} aria-pressed={mode === selected} key={mode} onClick={() => post({ type: 'selectViewMode', mode })}>{mode.charAt(0).toUpperCase()}{mode.slice(1)}</button>)}</nav>; }
