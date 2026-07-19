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
  | { type: 'setSidebarWidth'; width: number }
  | { type: 'setComposerHeight'; height: number }
  | { type: 'openFile'; path: string }
  | { type: 'openOutputChannel' }
  | { type: 'selectViewMode'; mode: 'combined' | 'agents' | 'project' | 'chat' }
  | { type: 'selectGraphEntity'; kind: 'agent' | 'component'; id: string }
  | { type: 'clearGraphSelection' }
  | { type: 'initializeProjectMap' }
  | { type: 'scanProjectMap' }
  | { type: 'saveProjectMap'; map: unknown }
  | { type: 'fitGraph' }
  | { type: 'runVisualizationDemo' }
  | { type: 'stopVisualizationDemo' };

export function parseWebviewMessage(value: unknown): WebviewMessage | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  if (['ready', 'startConnection', 'restartConnection', 'beginLogin', 'startThread', 'refreshThreads', 'loadMoreThreads', 'interruptTurn', 'openOutputChannel', 'clearGraphSelection', 'initializeProjectMap', 'scanProjectMap', 'fitGraph', 'runVisualizationDemo', 'stopVisualizationDemo'].includes(value.type)) {
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
  if (value.type === 'setSidebarWidth' && typeof value.width === 'number' && Number.isFinite(value.width) && value.width >= 160 && value.width <= 480) return { type: value.type, width: Math.round(value.width) };
  if (value.type === 'setComposerHeight' && typeof value.height === 'number' && Number.isFinite(value.height) && value.height >= 96 && value.height <= 360) return { type: value.type, height: Math.round(value.height) };
  if (value.type === 'openFile' && typeof value.path === 'string') return { type: value.type, path: value.path };
  if (value.type === 'selectViewMode' && (value.mode === 'combined' || value.mode === 'agents' || value.mode === 'project' || value.mode === 'chat')) return { type: value.type, mode: value.mode };
  if (value.type === 'selectGraphEntity' && (value.kind === 'agent' || value.kind === 'component') && typeof value.id === 'string' && value.id.trim() !== '') return { type: value.type, kind: value.kind, id: value.id };
  if (value.type === 'saveProjectMap' && isRecord(value.map)) return { type: value.type, map: value.map };
  return undefined;
}
