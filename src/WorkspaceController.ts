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
import { materializeSessionDraft, mergeSessionLibrary, reorderVisibleSessions, selectSession, setSessionExpanded, setSessionVisible, startSessionDraft } from './state/SessionWorkspace';
import type { WebviewMessage } from './webview/WebviewMessages';
import { resolveWorkspacePath } from './webview/WorkspacePath';
import { descendantEvents } from './agents/DescendantReconciler';
import { DescendantApiUnsupportedError, DescendantDiscovery } from './agents/DescendantDiscovery';
import { ProjectMapScanner } from './project-map/ProjectMapScanner';
import { ProjectMapService } from './project-map/ProjectMapService';
import { VisualizationCoordinator } from './visualization/VisualizationCoordinator';
import { DemoEventSource } from './visualization/DemoEventSource';
import type { VisualizationSnapshot } from './visualization/VisualizationCoordinator';

const pref = {
  draft: 'codexAgentMap.draft', collapsed: 'codexAgentMap.sidebarCollapsed',
  sidebarWidth: 'codexAgentMap.sidebarWidth',
  composerHeight: 'codexAgentMap.composerHeight',
  model: 'codexAgentMap.model', effort: 'codexAgentMap.effort', mode: 'codexAgentMap.mode'
  , viewMode: 'codexAgentMap.viewMode'
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
  private readonly visualization: VisualizationCoordinator;
  private readonly descendants: DescendantDiscovery;
  private readonly projectMap: ProjectMapService | undefined;
  private descendantTimer: NodeJS.Timeout | undefined;
  private readonly activityTimer: NodeJS.Timeout;
  private readonly demo: DemoEventSource;
  private demoSnapshot: VisualizationSnapshot | undefined;

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
    this.descendants = new DescendantDiscovery(client);
    this.visualization = new VisualizationCoordinator(this.cwd === undefined ? [] : [this.cwd], {
      durationSeconds: boundedSetting('activityTrailDurationSeconds', 120, 0, 3600),
      showInferred: vscode.workspace.getConfiguration('codexAgentMap').get<boolean>('showInferredActivityEdges', true),
      maxRecentPerAgent: boundedSetting('maxRecentComponentConnectionsPerAgent', 5, 0, 50)
    });
    const mapPath = vscode.workspace.getConfiguration('codexAgentMap').get<string>('projectMapPath', '.codex-agent-map/project-map.json');
    this.projectMap = this.cwd === undefined ? undefined : new ProjectMapService(this.cwd, mapPath);
    this.demo = new DemoEventSource(snapshot => { this.demoSnapshot = snapshot.demo ? snapshot : undefined; this.syncVisualization(); });
    this.activityTimer = setInterval(() => { this.visualization.expire(); if (this.demoSnapshot === undefined) this.syncVisualization(); }, 10_000);
    this.turns = new TurnService(client);
    this.approvals = new ApprovalService((id, result) => { this.client.respondId(id, result); });
    this.persistence = new SessionPersistence(context.workspaceState);
    const sessionPreferences = this.persistence.preferences;
    const storedMode = context.workspaceState.get<unknown>(pref.mode);
    this.store.update({
      ...(this.cwd === undefined ? {} : { workspaceCwd: this.cwd }),
      draft: stringPreference(context, pref.draft),
      sidebarCollapsed: context.workspaceState.get<boolean>(pref.collapsed, false),
      sidebarWidth: boundedSidebarWidth(context.workspaceState.get<unknown>(pref.sidebarWidth)),
      composerHeight: boundedComposerHeight(context.workspaceState.get<unknown>(pref.composerHeight)),
      viewMode: viewModePreference(context.workspaceState.get<unknown>(pref.viewMode)),
      completedAgentDisplay: completedDisplaySetting(),
      selectedMode: storedMode === 'plan' ? 'plan' : 'default'
      , sessionWorkspace: { ...this.store.snapshot.sessionWorkspace, visibleSessionIds: sessionPreferences.visibleSessionIds, ...(sessionPreferences.selectedSessionId === undefined ? {} : { selectedSessionId: sessionPreferences.selectedSessionId }), expandedSessionIds: sessionPreferences.expandedSessionIds, chatOpen: sessionPreferences.chatOpen, mapMode: sessionPreferences.mapMode }
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
    await this.loadProjectMap();
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
        case 'selectViewMode': this.store.update({ viewMode: message.mode }); await this.context.workspaceState.update(pref.viewMode, message.mode); return;
        case 'selectGraphEntity': this.selectGraphEntity(message.kind, message.id); return;
        case 'clearGraphSelection': this.store.update({ selectedGraphEntity: undefined }); return;
        case 'initializeProjectMap': await this.initializeProjectMap(); return;
        case 'editProjectMap': this.store.update({ viewMode: 'project' }); return;
        case 'scanProjectMap': await this.scanProjectMap(); return;
        case 'saveProjectMap': await this.saveProjectMap(message.map); return;
        case 'fitGraph': return;
        case 'runVisualizationDemo': this.runDemo(); return;
        case 'stopVisualizationDemo': this.stopDemo(); return;
        case 'selectSession': await this.previewThread(message.sessionId); return;
        case 'setChatOpen': this.store.update({ sessionWorkspace: { ...this.store.snapshot.sessionWorkspace, chatOpen: message.open } }); await this.persistSessionWorkspace(); return;
        case 'setSessionVisible': this.store.update({ sessionWorkspace: setSessionVisible(this.store.snapshot.sessionWorkspace, message.sessionId, message.visible) }); await this.persistSessionWorkspace(); return;
        case 'setSessionExpanded': this.store.update({ sessionWorkspace: setSessionExpanded(this.store.snapshot.sessionWorkspace, message.sessionId, message.expanded) }); await this.persistSessionWorkspace(); return;
        case 'reorderVisibleSessions': this.store.update({ sessionWorkspace: reorderVisibleSessions(this.store.snapshot.sessionWorkspace, message.sessionIds) }); await this.persistSessionWorkspace(); return;
        case 'setMapMode': this.store.update({ sessionWorkspace: { ...this.store.snapshot.sessionWorkspace, mapMode: message.mode } }); await this.persistSessionWorkspace(); return;
        case 'startSessionDraft': this.startThread(); return;
        case 'updateSessionDraft': this.store.update({ draft: message.text, sessionWorkspace: { ...this.store.snapshot.sessionWorkspace, draftNewSession: this.store.snapshot.sessionWorkspace.draftNewSession === undefined ? undefined : { ...this.store.snapshot.sessionWorkspace.draftNewSession, text: message.text } } }); return;
        case 'cancelSessionDraft': this.cancelSessionDraft(); return;
        case 'selectSessionAgent': this.store.update({ sessionWorkspace: { ...this.store.snapshot.sessionWorkspace, ...(message.agentId === undefined ? { selectedAgentId: undefined } : { selectedAgentId: message.agentId }) } }); return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown operation failure';
      this.output.appendLine(`Operation failed: ${detail}`);
      this.store.update({ error: userError(detail) });
    }
  }

  public dispose(): void {
    if (this.descendantTimer !== undefined) clearTimeout(this.descendantTimer);
    clearInterval(this.activityTimer); this.demo.dispose();
    this.descendants.cancel();
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
    this.store.update({ threads, nextThreadCursor: page.nextCursor, sessionWorkspace: mergeSessionLibrary(this.store.snapshot.sessionWorkspace, page.threads, append) });
  }

  private async previewThread(threadId: string): Promise<void> {
    this.requireKnownThread(threadId);
    const thread = await this.threads.read(threadId);
    let workspace = selectSession(this.store.snapshot.sessionWorkspace, threadId, thread);
    if (!workspace.visibleSessionIds.includes(threadId)) workspace = setSessionVisible(workspace, threadId, true);
    this.store.update({ selectedThread: thread, sessionWorkspace: workspace, error: '', warning: '' });
    this.visualization.selectRoot(thread); this.syncVisualization(); this.scheduleDescendantPoll();
    await this.persistence.rememberThread(threadId);
    await this.persistSessionWorkspace();
  }

  private startThread(): void {
    const now = Date.now();
    const workspace = startSessionDraft(this.store.snapshot.sessionWorkspace, `draft:${String(now)}`);
    this.store.update({
      selectedThread: {
        id: `local-new-thread:${String(now)}`, title: 'New thread', preview: '', cwd: this.cwd ?? 'No workspace',
        status: 'idle', updatedAt: Math.floor(now / 1000), turns: [], resumed: true, localOnly: true
      },
      sessionWorkspace: workspace, draft: '', error: '', warning: ''
    });
    const selected = this.store.snapshot.selectedThread; if (selected !== undefined) { this.visualization.selectRoot(selected); this.syncVisualization(); }
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
    let workspace = selectSession(this.store.snapshot.sessionWorkspace, threadId, resumed.thread);
    if (!workspace.visibleSessionIds.includes(threadId)) workspace = setSessionVisible(workspace, threadId, true);
    this.store.update({
      selectedThread: resumed.thread,
      sessionWorkspace: workspace,
      selection: { modelId: resumed.model, effort: resumed.effort ?? this.store.snapshot.selection?.effort ?? 'medium' },
      warning: ''
    });
    this.visualization.selectRoot(resumed.thread); this.syncVisualization(); this.scheduleDescendantPoll();
    await this.persistence.rememberThread(threadId);
    await this.persistSessionWorkspace();
  }

  private async sendMessage(text: string): Promise<void> {
    let thread = this.store.snapshot.selectedThread;
    if (thread === undefined) { this.startThread(); thread = this.store.snapshot.selectedThread; }
    if (thread === undefined) throw new Error('No thread selected');
    if (!thread.resumed) throw new Error('Resume this thread before sending a message');
    let newSession = false;
    if (thread.localOnly === true) {
      const workspace = this.store.snapshot.sessionWorkspace;
      if (workspace.draftNewSession !== undefined) this.store.update({ sessionWorkspace: { ...workspace, draftNewSession: { ...workspace.draftNewSession, text, state: 'submitting' } } });
      try { thread = await this.threads.start(this.store.snapshot.selection?.modelId); newSession = true; }
      catch (error) { this.restoreDraftEditing(); throw error; }
    }
    if (this.turns.activeIdFor(thread.id) !== undefined) {
      await this.turns.steer(thread.id, text);
      this.store.update({ draft: '', error: '' });
    } else {
      const selection = this.store.snapshot.selection;
      const mode = this.store.snapshot.modes.find(entry => entry.mode === this.store.snapshot.selectedMode);
      let turn;
      try { turn = await this.turns.start(thread.id, text, {
          ...(selection === undefined ? {} : { model: selection.modelId, effort: selection.effort }),
          ...(mode === undefined ? {} : { mode })
        }); }
      catch (error) { if (newSession) this.restoreDraftEditing(); throw error; }
      const activeThread = { ...thread, status: 'active' as const, turns: [...thread.turns, turn] };
      this.store.update({ selectedThread: activeThread, ...(newSession ? { threads: dedupe([activeThread, ...this.store.snapshot.threads]), sessionWorkspace: materializeSessionDraft(this.store.snapshot.sessionWorkspace, activeThread) } : {}), draft: '', stopping: false, error: '' });
      if (newSession) { this.visualization.selectRoot(activeThread); this.syncVisualization(); await this.persistence.rememberThread(thread.id); await this.persistSessionWorkspace(); }
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
    const next = new SelectionService(this.store.snapshot.models, this.store.snapshot.modes).selectModel(current, modelId, this.selectedTurnActive());
    this.applySelection(next);
  }
  private selectEffort(effort: string): void {
    const current = this.fullSelection();
    const next = new SelectionService(this.store.snapshot.models, this.store.snapshot.modes).selectEffort(current, effort, this.selectedTurnActive());
    this.applySelection(next);
  }
  private selectMode(mode: 'default' | 'plan'): void {
    const current = this.fullSelection();
    const next = new SelectionService(this.store.snapshot.models, this.store.snapshot.modes).selectMode(current, mode, this.selectedTurnActive());
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

  public runDemo(): void { this.store.update({ viewMode: 'combined', selectedGraphEntity: undefined }); this.demo.start(); }
  public stopDemo(): void { this.demo.stop(false); this.demoSnapshot = undefined; this.syncVisualization(); }
  public initializeMapCommand(): Promise<void> { return this.initializeProjectMap(); }
  public scanMapCommand(): Promise<void> { return this.scanProjectMap(); }
  public showView(mode: 'combined' | 'agents' | 'project' | 'chat'): void { this.store.update({ viewMode: mode }); }
  public showUnmappedActivity(): void { this.store.update({ warning: `${String(this.visualization.snapshot.unmappedActivityCount)} unmapped activity records are available in the current bounded snapshot.` }); }
  private syncVisualization(): void { this.store.update({ visualization: this.demoSnapshot ?? this.visualization.snapshot }); }
  private selectGraphEntity(kind: 'agent' | 'component', id: string): void {
    const snapshot = this.visualization.snapshot;
    if (kind === 'agent' ? snapshot.agents[id] === undefined : snapshot.projectMap?.components.some(component => component.id === id) !== true) throw new Error(`Unknown ${kind} ID`);
    this.store.update({ selectedGraphEntity: { kind, id } });
  }
  private async loadProjectMap(): Promise<void> {
    if (this.projectMap === undefined) return;
    try { this.visualization.loadProjectMap(await this.projectMap.load()); this.syncVisualization(); }
    catch (error) { if (!(error instanceof Error) || !/(?:ENOENT|cannot find|Unable to read)/iu.test(error.message)) this.store.update({ warning: error instanceof Error ? error.message : 'Project map load failed' }); }
  }
  private async initializeProjectMap(): Promise<void> {
    if (this.projectMap === undefined || this.cwd === undefined) throw new Error('No workspace is open');
    const name = vscode.workspace.name ?? this.cwd.split(/[\\/]/u).pop() ?? 'Project';
    const map = await this.projectMap.save({ schemaVersion: 1, project: { name }, components: [], edges: [] });
    this.visualization.loadProjectMap(map); this.syncVisualization(); this.store.update({ viewMode: 'project', projectSuggestions: [], projectEdgeSuggestions: [] });
  }
  private async scanProjectMap(): Promise<void> {
    if (this.cwd === undefined) throw new Error('No workspace is open');
    const result = await new ProjectMapScanner(this.cwd).scan();
    this.store.update({ projectSuggestions: result.suggestions, projectEdgeSuggestions: result.edgeSuggestions, viewMode: 'project', warning: result.truncated ? 'Architecture scan reached its file limit. Review the partial suggestions before saving.' : '' });
  }
  private async saveProjectMap(value: unknown): Promise<void> {
    if (this.projectMap === undefined) throw new Error('No workspace is open');
    const map = await this.projectMap.save(value); this.visualization.loadProjectMap(map); this.syncVisualization(); this.store.update({ projectSuggestions: [], projectEdgeSuggestions: [], warning: '' });
  }
  private scheduleDescendantPoll(): void {
    if (this.descendantTimer !== undefined) clearTimeout(this.descendantTimer);
    const root = this.visualization.agentState.rootThreadId; if (root === null || !Object.values(this.visualization.agentState.agents).some(agent => ['thinking', 'planning', 'reading', 'editing', 'testing', 'running-command', 'using-tool', 'delegating', 'waiting-agent', 'waiting-approval', 'waiting-input'].includes(agent.status))) return;
    const delay = boundedSetting('descendantPollIntervalMs', 1500, 500, 10_000);
    this.descendantTimer = setTimeout(() => { this.descendantTimer = undefined; void this.pollDescendants(root); }, delay);
  }
  private async pollDescendants(rootThreadId: string): Promise<void> {
    try {
      const descendants = await this.descendants.list(rootThreadId);
      if (this.visualization.agentState.rootThreadId !== rootThreadId) return;
      this.visualization.applyAgentEvents(descendantEvents(this.visualization.agentState, rootThreadId, descendants)); this.syncVisualization();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Descendant reconciliation failed';
      if (error instanceof DescendantApiUnsupportedError) this.store.update({ warning: message }); else this.output.appendLine(message);
    } finally { this.scheduleDescendantPoll(); }
  }

  private requireKnownThread(threadId: string): void {
    if (!this.store.snapshot.threads.some(thread => thread.id === threadId)) throw new Error('Unknown thread ID');
  }
  private syncApprovals(): void { this.store.update({ pendingRequests: this.approvals.requests }); }

  private readonly onState = (state: string): void => { this.store.update({ connection: state as typeof this.store.snapshot.connection }); };
  private readonly onDisconnected = (): void => { this.descendants.cancel(); this.visualization.disconnected(); this.syncVisualization(); this.store.update({ error: 'The Codex App Server disconnected. The conversation shown may be stale.' }); };
  private readonly onServerRequest = (request: ServerRequest): void => {
    try { const pending = this.approvals.register(request); this.visualization.approval(pending.threadId, true, pending.kind === 'userInput'); this.syncVisualization(); this.syncApprovals(); }
    catch (error) { this.store.update({ error: error instanceof Error ? error.message : 'Unsupported server request' }); }
  };
  private readonly onNotification = (notification: ServerNotification): void => {
    this.visualization.notification(notification.method, notification.params); this.syncVisualization();
    if (notification.method === 'account/login/completed' || notification.method === 'account/updated') {
      void this.refreshCatalogs().catch((error: unknown) => { this.store.update({ error: error instanceof Error ? error.message : 'Account refresh failed' }); });
    }
    if (notification.method === 'serverRequest/resolved' && isRecord(notification.params) && (typeof notification.params.requestId === 'string' || typeof notification.params.requestId === 'number')) {
      const requestId = notification.params.requestId; const pending = this.approvals.requests.find(item => item.id === requestId); this.approvals.markResolved(requestId); if (pending !== undefined) this.visualization.approval(pending.threadId, false); this.syncVisualization(); this.syncApprovals();
    }
    const thread = this.store.snapshot.selectedThread;
    if (thread === undefined) return;
    const result = reduceNotification(thread, notification.method, notification.params);
    const workspace = this.store.snapshot.sessionWorkspace;
    const record = workspace.library[thread.id];
    const patch: Partial<ReturnType<typeof initialAppState>> = { selectedThread: result.thread, ...(record === undefined ? {} : { sessionWorkspace: { ...workspace, library: { ...workspace.library, [thread.id]: { ...record, conversation: result.thread, status: result.thread.status === 'systemError' ? 'failed' : result.thread.status === 'notLoaded' ? 'completed' : result.thread.status } } } }) };
    if (result.error !== undefined) patch.error = result.error;
    if (result.warning !== undefined) patch.warning = result.warning;
    if (result.completedTurnId !== undefined) {
      this.turns.complete(thread.id, result.completedTurnId);
      this.approvals.clearTurn(thread.id, result.completedTurnId);
      patch.pendingRequests = this.approvals.requests;
      patch.stopping = false;
    }
    this.store.update(patch);
    this.scheduleDescendantPoll();
  };

  private selectedTurnActive(): boolean { const id = this.store.snapshot.sessionWorkspace.selectedSessionId; return id !== undefined && this.turns.activeIdFor(id) !== undefined; }
  private restoreDraftEditing(): void { const workspace = this.store.snapshot.sessionWorkspace; if (workspace.draftNewSession !== undefined) this.store.update({ sessionWorkspace: { ...workspace, draftNewSession: { ...workspace.draftNewSession, state: 'editing' } } }); }
  private cancelSessionDraft(): void { const workspace = this.store.snapshot.sessionWorkspace; if (workspace.draftNewSession === undefined) return; const conversation = workspace.selectedSessionId === undefined ? undefined : workspace.library[workspace.selectedSessionId]?.conversation; this.store.update({ sessionWorkspace: { ...workspace, draftNewSession: undefined, chatOpen: workspace.selectedSessionId !== undefined }, draft: '', ...(conversation === undefined ? {} : { selectedThread: conversation }) }); }
  private async persistSessionWorkspace(): Promise<void> { const value = this.store.snapshot.sessionWorkspace; await this.persistence.save({ version: 1, visibleSessionIds: value.visibleSessionIds, ...(value.selectedSessionId === undefined ? {} : { selectedSessionId: value.selectedSessionId }), expandedSessionIds: value.expandedSessionIds, chatOpen: value.chatOpen, mapMode: value.mapMode }); }
}

function stringPreference(context: vscode.ExtensionContext, key: string): string {
  const value = context.workspaceState.get<unknown>(key);
  return typeof value === 'string' ? value : '';
}
function dedupe<T extends { id: string }>(items: T[]): T[] { return [...new Map(items.map(item => [item.id, item])).values()]; }
function userError(detail: string): string { return detail === 'ACTIVE_THREAD_CONFIRMATION_REQUIRED' ? 'Confirm before resuming a thread that may be active elsewhere.' : detail; }
function boundedSidebarWidth(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.min(480, Math.max(160, Math.round(value))) : 250; }
function boundedComposerHeight(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.min(360, Math.max(96, Math.round(value))) : 112; }
function boundedSetting(name: string, fallback: number, minimum: number, maximum: number): number { const value = vscode.workspace.getConfiguration('codexAgentMap').get<number>(name, fallback); return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback; }
function viewModePreference(value: unknown): 'combined' | 'agents' | 'project' | 'chat' { return value === 'agents' || value === 'project' || value === 'chat' ? value : 'combined'; }
function completedDisplaySetting(): 'show' | 'collapse' | 'activeOnly' { const value = vscode.workspace.getConfiguration('codexAgentMap').get<string>('completedAgentDisplay', 'collapse'); return value === 'show' || value === 'activeOnly' ? value : 'collapse'; }
