import { useEffect, useRef } from 'react';
import type { Item, Thread } from '../types';
import { renderMarkdown } from '../markdown';
import { post } from '../vscode';

export function ConversationView({ thread }: { thread?: Thread }): React.JSX.Element {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { end.current?.scrollIntoView({ block: 'end' }); });
    return () => window.cancelAnimationFrame(frame);
  }, [thread?.id]);
  if (!thread) return <section className="empty"><h2>Start a Codex conversation</h2><p>Create a new thread or select a recent one.</p><button onClick={() => post({ type: 'startThread' })}>New thread</button></section>;
  return <section className="conversation" aria-label="Conversation" aria-live="polite">
    <header className="thread-header"><div><h2>{thread.title}</h2><small>{thread.cwd}</small></div>
      {!thread.resumed ? <button onClick={() => post({ type: 'resumeThread', threadId: thread.id })}>Resume thread</button> : <span className="badge">Resumed</span>}
    </header>
    <div className="turns">{(thread.turns ?? []).map(turn => <article className="turn" key={turn.id}>
      {turn.items.map(item => <ConversationItem item={item} key={item.id} />)}
      {turn.error ? <div className="error-card">{turn.error}</div> : null}
      <div className="turn-status">{turn.status}</div>
    </article>)}<div ref={end} className="conversation-end" /></div>
  </section>;
}

function ConversationItem({ item }: { item: Item }): React.JSX.Element {
  if (item.type === 'userMessage' || item.type === 'agentMessage' || item.type === 'plan' || item.type === 'reasoning') {
    return <div className={`message ${item.type}`}><div className="message-label">{item.type === 'userMessage' ? 'You' : item.type === 'agentMessage' ? 'Codex' : item.type === 'plan' ? 'Plan' : 'Reasoning summary'}</div>
      <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text ?? '') }} /></div>;
  }
  return <details className="activity" open={item.status === 'inProgress'}><summary><span>{icon(item.type)} {item.title ?? friendly(item.type)}</span><span>{item.status ?? ''}</span></summary>
    {item.detail ? <code>{item.detail}</code> : null}{item.text ? <pre>{item.text}</pre> : null}
    {item.paths?.map(path => <button className="file-link" key={path} onClick={() => post({ type: 'openFile', path })}>{path}</button>)}
  </details>;
}
function friendly(type: string): string { return type.replace(/([A-Z])/gu, ' $1').replace(/^./u, value => value.toUpperCase()); }
function icon(type: string): string { return type === 'commandExecution' ? '›_' : type === 'fileChange' || type === 'diff' ? 'Δ' : type.includes('Tool') ? '◈' : type === 'webSearch' ? '⌕' : '•'; }
