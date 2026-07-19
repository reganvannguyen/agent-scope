import * as vscode from 'vscode';
import { AccountService } from './codex/AccountService';
import { ApprovalService } from './codex/ApprovalService';
import type { AppServerClient } from './codex/AppServerClient';
import { CollaborationModeService } from './codex/CollaborationModeService';
import type { CollaborationModeOption } from './codex/CollaborationModeService';
import { ModelService } from './codex/ModelService';
import { isRecord, type ServerNotification, type ServerRequest } from './codex/ProtocolTypes';
import { ThreadService } from './codex/ThreadService';
import { TurnService } from './codex/TurnService';
import { AppStateStore } from './state/AppStateStore';
import { initialAppState } from './state/AppState';
import { reduceNotification } from './state/ConversationReducer';
import { SelectionService, type FullSelection } from './state/SelectionService';
import { SessionPersistence } from './state/SessionPersistence';
import type { WebviewMessage } from './webview/WebviewMessages';
import { resolveWorkspacePath } from './webview/WorkspacePath';

const pref = {
  draft: 'codexAgentMap.draft', collapsed: 'codexAgentMap.sidebarCollapsed',
  sidebarWidth: 'codexAgentMap.sidebarWidth',
  composerHeight: 'codexAgentMap.composerHeight',
  model: 'codexAgentMap.model', effort: 'codexAgentMap.effort', mode: 'codexAgentMap.mode'
};

export class WorkspaceController implements vscode.Disposable {
  public readonly store = new AppStateStore(initialAppState());
  private readonly account: AccountService;
  private readonly models: ModelService;
  private readonly modes: CollaborationModeService;
  private readonly threads: ThreadService;
  private readonly turns: TurnService;
  private readonly approvals: ApprovalService;
  private readonly persistence: SessionPersistence;
  private readonly cwd: string | undefined;

  public constructor(
    private readonly client: AppServerClient,
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {
    this.cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.account = new AccountService(client);
    this.models = new ModelService(client);
    this.modes = new CollaborationModeService(client);
    this.threads = new ThreadService(client, this.cwd);
    this.turns = new TurnService(client);
    this.approvals = new ApprovalService((id, result) => { this.client.respondId(id, result); });
    this.persistence = new SessionPersistence(context.workspaceState);
    const storedMode = context.workspaceState.get<unknown>(pref.mode);
    this.store.update({
      draft: stringPreference(context, pref.draft),
      sidebarCollapsed: context.workspaceState.get<boolean>(pref.collapsed, false),
      sidebarWidth: boundedSidebarWidth(context.workspaceState.get<unknown>(pref.sidebarWidth)),
      composerHeight: boundedComposerHeight(context.workspaceState.get<unknown>(pref.composerHeight)),
      selectedMode: storedMode === 'plan' ? 'plan' : 'default'
    });
    client.on('state', this.onState);
    client.on('notification', this.onNotification);
    client.on('serverRequest', this.onServerRequest);
    client.on('disconnected', this.onDisconnected);
  }

  public async connect(restart = false): Promise<void> {
    if (restart) await this.client.disconnect();
    const executable = vscode.workspace.getConfiguration('codexAgentMap').get<string>('codexPath', 'codex');
    await this.client.connect(executable, this.cwd);
    await this.refreshCatalogs();
    await this.refreshThreads(false);
    const remembered = this.persistence.selectedThreadId;
    if (remembered !== undefined && this.store.snapshot.threads.some(thread => thread.id === remembered)) {
      await this.previewThread(remembered);
    }
  }

  public async handle(message: WebviewMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'ready': return;
        case 'startConnection': await this.connect(); return;
        case 'restartConnection': await this.connect(true); return;
        case 'beginLogin': await this.beginLogin(); return;
        case 'startThread': this.startThread(); return;
        case 'previewThread': await this.previewThread(message.threadId); return;
        case 'resumeThread': await this.resumeThread(message.threadId, message.confirmActive === true); return;
        case 'refreshThreads': await this.refreshThreads(false); return;
        case 'loadMoreThreads': await this.refreshThreads(true); return;
        case 'sendMessage': await this.sendMessage(message.text); return;
        case 'interruptTurn': await this.interrupt(); return;
        case 'selectModel': this.selectModel(message.modelId); return;
        case 'selectEffort': this.selectEffort(message.effort); return;
        case 'selectMode': this.selectMode(message.mode); return;
        case 'resolveServerRequest': this.approvals.resolve(message.requestId, message.answer); this.syncApprovals(); return;
        case 'setDraft': this.store.update({ draft: message.text }); await this.context.workspaceState.update(pref.draft, message.text); return;
        case 'setSidebarCollapsed': this.store.update({ sidebarCollapsed: message.collapsed }); await this.context.workspaceState.update(pref.collapsed, message.collapsed); return;
        case 'setSidebarWidth': this.store.update({ sidebarWidth: message.width }); await this.context.workspaceState.update(pref.sidebarWidth, message.width); return;
        case 'setComposerHeight': this.store.update({ composerHeight: message.height }); await this.context.workspaceState.update(pref.composerHeight, message.height); return;
        case 'openFile': await this.openFile(message.path); return;
        case 'openOutputChannel': this.output.show(true); return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown operation failure';
      this.output.appendLine(`Operation failed: ${detail}`);
      this.store.update({ error: userError(detail) });
    }
  }

  public dispose(): void {
    this.client.off('state', this.onState);
    this.client.off('notification', this.onNotification);
    this.client.off('serverRequest', this.onServerRequest);
    this.client.off('disconnected', this.onDisconnected);
  }

  private async refreshCatalogs(): Promise<void> {
    const account = await this.account.read();
    this.store.update({ account });
    if (!account.signedIn) return;
    const models = await this.models.list();
    let modes: CollaborationModeOption[] = [];
    try { modes = await this.modes.list(); }
    catch (error) { this.output.appendLine(`Plan mode unavailable: ${error instanceof Error ? error.message : 'unsupported'}`); }
    const preferredModel = stringPreference(this.context, pref.model);
    const preferredEffort = stringPreference(this.context, pref.effort);
    const selection = this.models.select(models, preferredModel, preferredEffort);
    this.store.update({ models, modes, ...(selection === undefined ? {} : { selection }) });
  }

  private async refreshThreads(append: boolean): Promise<void> {
    const cursor = append ? this.store.snapshot.nextThreadCursor : null;
    if (append && cursor === null) return;
    const page = await this.threads.list(cursor);
    const threads = append ? dedupe([...this.store.snapshot.threads, ...page.threads]) : page.threads;
    this.store.update({ threads, nextThreadCursor: page.nextCursor });
  }

  private async previewThread(threadId: string): Promise<void> {
    this.requireKnownThread(threadId);
    const thread = await this.threads.read(threadId);
    this.store.update({ selectedThread: thread, error: '', warning: '' });
    await this.persistence.rememberThread(threadId);
  }

  private startThread(): void {
    const now = Date.now();
    this.store.update({
      selectedThread: {
        id: `local-new-thread:${String(now)}`, title: 'New thread', preview: '', cwd: this.cwd ?? 'No workspace',
        status: 'idle', updatedAt: Math.floor(now / 1000), turns: [], resumed: true, localOnly: true
      },
      error: '', warning: ''
    });
  }

  private async resumeThread(threadId: string, confirmActive: boolean): Promise<void> {
    this.requireKnownThread(threadId);
    const selected = this.store.snapshot.selectedThread?.id === threadId
      ? this.store.snapshot.selectedThread
      : await this.threads.read(threadId);
    if (selected.status === 'active' && !confirmActive) {
      this.store.update({ warning: 'This thread may be active in another Codex client. Controlling one thread from multiple clients at the same time can cause confusing behavior.' });
      return;
    }
    const resumed = await this.threads.resumeConfirmed(threadId);
    this.store.update({
      selectedThread: resumed.thread,
      selection: { modelId: resumed.model, effort: resumed.effort ?? this.store.snapshot.selection?.effort ?? 'medium' },
      warning: ''
    });
    await this.persistence.rememberThread(threadId);
  }

  private async sendMessage(text: string): Promise<void> {
    let thread = this.store.snapshot.selectedThread;
    if (thread === undefined) { this.startThread(); thread = this.store.snapshot.selectedThread; }
    if (thread === undefined) throw new Error('No thread selected');
    if (!thread.resumed) throw new Error('Resume this thread before sending a message');
    if (thread.localOnly === true) {
      const materialized = await this.threads.start(this.store.snapshot.selection?.modelId);
      thread = materialized;
      this.store.update({ selectedThread: materialized, threads: dedupe([materialized, ...this.store.snapshot.threads]) });
      await this.persistence.rememberThread(materialized.id);
    }
    if (this.turns.activeId !== undefined) {
      await this.turns.steer(thread.id, text);
      this.store.update({ draft: '', error: '' });
    } else {
      const selection = this.store.snapshot.selection;
      const mode = this.store.snapshot.modes.find(entry => entry.mode === this.store.snapshot.selectedMode);
      const turn = await this.turns.start(thread.id, text, {
        ...(selection === undefined ? {} : { model: selection.modelId, effort: selection.effort }),
        ...(mode === undefined ? {} : { mode })
      });
      this.store.update({ selectedThread: { ...thread, status: 'active', turns: [...thread.turns, turn] }, draft: '', stopping: false, error: '' });
    }
    await this.context.workspaceState.update(pref.draft, '');
  }

  private async interrupt(): Promise<void> {
    const thread = this.store.snapshot.selectedThread;
    if (thread === undefined) throw new Error('No selected thread');
    await this.turns.interrupt(thread.id);
    this.store.update({ stopping: true });
  }

  private selectModel(modelId: string): void {
    const current = this.fullSelection();
    const next = new SelectionService(this.store.snapshot.models, this.store.snapshot.modes).selectModel(current, modelId, this.turns.activeId !== undefined);
    this.applySelection(next);
  }
  private selectEffort(effort: string): void {
    const current = this.fullSelection();
    const next = new SelectionService(this.store.snapshot.models, this.store.snapshot.modes).selectEffort(current, effort, this.turns.activeId !== undefined);
    this.applySelection(next);
  }
  private selectMode(mode: 'default' | 'plan'): void {
    const current = this.fullSelection();
    const next = new SelectionService(this.store.snapshot.models, this.store.snapshot.modes).selectMode(current, mode, this.turns.activeId !== undefined);
    this.applySelection(next);
  }

  private fullSelection(): FullSelection {
    const selection = this.store.snapshot.selection;
    if (selection === undefined) throw new Error('No model is available');
    return { ...selection, mode: this.store.snapshot.selectedMode };
  }
  private applySelection(selection: FullSelection): void {
    this.store.update({ selection: { modelId: selection.modelId, effort: selection.effort }, selectedMode: selection.mode });
    void Promise.all([
      this.context.workspaceState.update(pref.model, selection.modelId),
      this.context.workspaceState.update(pref.effort, selection.effort),
      this.context.workspaceState.update(pref.mode, selection.mode)
    ]);
  }

  private async beginLogin(): Promise<void> {
    const login = await this.account.startChatGptLogin();
    if (!await vscode.env.openExternal(vscode.Uri.parse(login.authUrl, true))) throw new Error('Unable to open sign-in URL');
  }

  private async openFile(candidate: string): Promise<void> {
    if (this.cwd === undefined) throw new Error('No workspace is open');
    const resolved = resolveWorkspacePath(this.cwd, candidate);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(resolved));
    await vscode.window.showTextDocument(document);
  }

  private requireKnownThread(threadId: string): void {
    if (!this.store.snapshot.threads.some(thread => thread.id === threadId)) throw new Error('Unknown thread ID');
  }
  private syncApprovals(): void { this.store.update({ pendingRequests: this.approvals.requests }); }

  private readonly onState = (state: string): void => { this.store.update({ connection: state as typeof this.store.snapshot.connection }); };
  private readonly onDisconnected = (): void => { this.store.update({ error: 'The Codex App Server disconnected. The conversation shown may be stale.' }); };
  private readonly onServerRequest = (request: ServerRequest): void => {
    try { this.approvals.register(request); this.syncApprovals(); }
    catch (error) { this.store.update({ error: error instanceof Error ? error.message : 'Unsupported server request' }); }
  };
  private readonly onNotification = (notification: ServerNotification): void => {
    if (notification.method === 'account/login/completed' || notification.method === 'account/updated') {
      void this.refreshCatalogs().catch((error: unknown) => { this.store.update({ error: error instanceof Error ? error.message : 'Account refresh failed' }); });
    }
    if (notification.method === 'serverRequest/resolved' && isRecord(notification.params) && (typeof notification.params.requestId === 'string' || typeof notification.params.requestId === 'number')) {
      this.approvals.markResolved(notification.params.requestId); this.syncApprovals();
    }
    const thread = this.store.snapshot.selectedThread;
    if (thread === undefined) return;
    const result = reduceNotification(thread, notification.method, notification.params);
    const patch: Partial<ReturnType<typeof initialAppState>> = { selectedThread: result.thread };
    if (result.error !== undefined) patch.error = result.error;
    if (result.warning !== undefined) patch.warning = result.warning;
    if (result.completedTurnId !== undefined) {
      this.turns.complete(result.completedTurnId);
      this.approvals.clearTurn(thread.id, result.completedTurnId);
      patch.pendingRequests = this.approvals.requests;
      patch.stopping = false;
    }
    this.store.update(patch);
  };
}

function stringPreference(context: vscode.ExtensionContext, key: string): string {
  const value = context.workspaceState.get<unknown>(key);
  return typeof value === 'string' ? value : '';
}
function dedupe<T extends { id: string }>(items: T[]): T[] { return [...new Map(items.map(item => [item.id, item])).values()]; }
function userError(detail: string): string { return detail === 'ACTIVE_THREAD_CONFIRMATION_REQUIRED' ? 'Confirm before resuming a thread that may be active elsewhere.' : detail; }
function boundedSidebarWidth(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.min(480, Math.max(160, Math.round(value))) : 250; }
function boundedComposerHeight(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.min(360, Math.max(96, Math.round(value))) : 112; }
