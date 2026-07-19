import { useState } from 'react';
import type { PendingRequest } from '../types';
import { post } from '../vscode';

export function ApprovalPanel({ request }: { request: PendingRequest }): React.JSX.Element {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const resolve = (answer: unknown): void => post({ type: 'resolveServerRequest', requestId: request.id, answer });
  if (request.kind === 'command') {
    const decisions = unknownArray(request.payload.availableDecisions);
    return <Panel title="Command approval" request={request}><code>{safeString(request.payload.command)}</code><p>{safeString(request.payload.reason)}</p><div className="approval-actions">{decisions.map((decision, index) => <button key={index} disabled={request.state !== 'pending'} onClick={() => resolve({ decision })}>{decisionLabel(decision)}</button>)}</div></Panel>;
  }
  if (request.kind === 'fileChange') return <Panel title="File-change approval" request={request}><p>{safeString(request.payload.reason) || 'Codex wants to modify files.'}</p><div className="approval-actions">{['accept', 'acceptForSession', 'decline', 'cancel'].map(decision => <button key={decision} onClick={() => resolve({ decision })}>{decisionLabel(decision)}</button>)}</div></Panel>;
  if (request.kind === 'permissions') return <Panel title="Permission request" request={request}><pre>{JSON.stringify(request.payload.permissions, null, 2)}</pre><div className="approval-actions"><button onClick={() => resolve({ permissions: request.payload.permissions, scope: 'turn' })}>Allow for turn</button><button onClick={() => resolve({ permissions: {}, scope: 'turn' })}>Deny</button></div></Panel>;
  const questions = Array.isArray(request.payload.questions) ? request.payload.questions.filter(isQuestion) : [];
  return <Panel title="Codex needs input" request={request}>{questions.map(question => <label key={question.id}>{question.question}<select value={answers[question.id] ?? ''} onChange={event => setAnswers(old => ({ ...old, [question.id]: event.target.value }))}><option value="">Choose…</option>{question.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}<button onClick={() => resolve({ answers: Object.fromEntries(questions.map(question => [question.id, { answers: [answers[question.id] ?? ''] }])) })}>Submit</button></Panel>;
}
function Panel({ title, request, children }: { title: string; request: PendingRequest; children: React.ReactNode }): React.JSX.Element { return <section className="approval" role="alertdialog" aria-label={title}><h3>{title}</h3>{children}<small>{request.state}</small></section>; }
function decisionLabel(value: unknown): string { if (typeof value === 'string') return ({ accept: 'Allow', acceptForSession: 'Allow for session', decline: 'Decline', cancel: 'Cancel' } as Record<string, string>)[value] ?? value; return 'Apply proposed policy'; }
function safeString(value: unknown): string { return typeof value === 'string' ? value : ''; }
function unknownArray(value: unknown): unknown[] { return Array.isArray(value) ? Array.from(value as unknown[]) : []; }
function isQuestion(value: unknown): value is { id: string; question: string; options: string[] } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.question !== 'string') return false;
  const raw = Array.isArray(record.options) ? record.options : [];
  record.options = raw.flatMap(option => typeof option === 'object' && option !== null && typeof (option as Record<string, unknown>).label === 'string' ? [String((option as Record<string, unknown>).label)] : []);
  return true;
}
