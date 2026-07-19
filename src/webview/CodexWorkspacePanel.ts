import * as vscode from 'vscode';
import type { WorkspaceController } from '../WorkspaceController';
import { parseWebviewMessage } from './WebviewMessages';
import { webviewHtml } from './WebviewHtml';

export class CodexWorkspacePanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];

  public constructor(private readonly extensionUri: vscode.Uri, private readonly controller: WorkspaceController) {
    const changed = (state: unknown): void => { void this.panel?.webview.postMessage({ type: 'stateSnapshot', state }); };
    controller.store.on('changed', changed);
    this.subscriptions.push({ dispose: () => { controller.store.off('changed', changed); } });
  }

  public show(): void {
    if (this.panel !== undefined) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel('codexAgentMap.workspace', 'Codex Workspace', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    });
    this.panel = panel;
    panel.webview.html = webviewHtml(panel.webview, this.extensionUri);
    panel.webview.onDidReceiveMessage((raw: unknown) => {
      const message = parseWebviewMessage(raw);
      if (message === undefined) return;
      if (message.type === 'ready') void panel.webview.postMessage({ type: 'stateSnapshot', state: this.controller.store.snapshot });
      void this.controller.handle(message);
    }, undefined, this.subscriptions);
    panel.onDidDispose(() => { this.panel = undefined; }, undefined, this.subscriptions);
  }

  public dispose(): void {
    this.panel?.dispose();
    for (const subscription of this.subscriptions.splice(0)) subscription.dispose();
  }
}
