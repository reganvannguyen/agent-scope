import { isRecord, isRequestId, type RequestId } from '../codex/ProtocolTypes';

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'startConnection' }
  | { type: 'restartConnection' }
  | { type: 'beginLogin' }
  | { type: 'startThread' }
  | { type: 'previewThread'; threadId: string }
  | { type: 'resumeThread'; threadId: string; confirmActive?: boolean }
  | { type: 'refreshThreads' }
  | { type: 'loadMoreThreads' }
  | { type: 'sendMessage'; text: string }
  | { type: 'interruptTurn' }
  | { type: 'selectModel'; modelId: string }
  | { type: 'selectEffort'; effort: string }
  | { type: 'selectMode'; mode: 'default' | 'plan' }
  | { type: 'resolveServerRequest'; requestId: RequestId; answer: unknown }
  | { type: 'setDraft'; text: string }
  | { type: 'setSidebarCollapsed'; collapsed: boolean }
  | { type: 'openFile'; path: string }
  | { type: 'openOutputChannel' };

export function parseWebviewMessage(value: unknown): WebviewMessage | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  if (['ready', 'startConnection', 'restartConnection', 'beginLogin', 'startThread', 'refreshThreads', 'loadMoreThreads', 'interruptTurn', 'openOutputChannel'].includes(value.type)) {
    return { type: value.type } as WebviewMessage;
  }
  if ((value.type === 'previewThread' || value.type === 'resumeThread') && typeof value.threadId === 'string') {
    return value.type === 'resumeThread'
      ? { type: value.type, threadId: value.threadId, confirmActive: value.confirmActive === true }
      : { type: value.type, threadId: value.threadId };
  }
  if ((value.type === 'sendMessage' || value.type === 'setDraft') && typeof value.text === 'string') return { type: value.type, text: value.text };
  if (value.type === 'selectModel' && typeof value.modelId === 'string') return { type: value.type, modelId: value.modelId };
  if (value.type === 'selectEffort' && typeof value.effort === 'string') return { type: value.type, effort: value.effort };
  if (value.type === 'selectMode' && (value.mode === 'default' || value.mode === 'plan')) return { type: value.type, mode: value.mode };
  if (value.type === 'resolveServerRequest' && isRequestId(value.requestId)) return { type: value.type, requestId: value.requestId, answer: value.answer };
  if (value.type === 'setSidebarCollapsed' && typeof value.collapsed === 'boolean') return { type: value.type, collapsed: value.collapsed };
  if (value.type === 'openFile' && typeof value.path === 'string') return { type: value.type, path: value.path };
  return undefined;
}
