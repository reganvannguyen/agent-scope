import type { AccountState } from '../types';
import { post } from '../vscode';

export function ConnectionStatus({ state, account }: { state: string; account?: AccountState }): React.JSX.Element {
  return <div className="connection" role="status">
    <span className={`status-dot ${state}`} aria-hidden="true" /> <span>{label(state)}</span>
    {state === 'failed' || state === 'stopped' ? <button onClick={() => post({ type: state === 'failed' ? 'restartConnection' : 'startConnection' })}>{state === 'failed' ? 'Reconnect' : 'Connect'}</button> : null}
    {state === 'connected' && account?.signedIn === false ? <button onClick={() => post({ type: 'beginLogin' })}>Sign in with ChatGPT</button> : null}
    {account?.signedIn ? <span className="account">{account.label ?? account.type}{account.planType ? ` · Codex reports: ${titleCase(account.planType)}` : ''}</span> : null}
  </div>;
}
function label(state: string): string { return ({ stopped: 'Disconnected', starting: 'Connecting', initializing: 'Initializing', connected: 'Connected', reconnecting: 'Reconnecting', failed: 'Connection failed' } as Record<string, string>)[state] ?? state; }
function titleCase(value: string): string { return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
