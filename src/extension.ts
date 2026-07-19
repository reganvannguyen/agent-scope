import * as vscode from 'vscode';
import { AppServerClient } from './codex/AppServerClient';
import { AppServerProcess } from './codex/AppServerProcess';
import { isRecord } from './codex/ProtocolTypes';
import { WorkspaceController } from './WorkspaceController';
import { CodexWorkspacePanel } from './webview/CodexWorkspacePanel';

let client: AppServerClient | undefined;
let controller: WorkspaceController | undefined;
let panel: CodexWorkspacePanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Codex Agent Map');
  const packageJson: unknown = context.extension.packageJSON;
  const version = isRecord(packageJson) && typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
  client = new AppServerClient(
    new AppServerProcess(), output, version,
    vscode.workspace.getConfiguration('codexAgentMap').get<boolean>('debugLogging', false)
  );
  controller = new WorkspaceController(client, context, output);
  panel = new CodexWorkspacePanel(context.extensionUri, controller);
  context.subscriptions.push(output, controller, panel);
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.openWorkspace', async () => {
    panel?.show();
    await controller?.connect().catch((error: unknown) => {
      output.appendLine(`Connection failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    });
  }));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.chooseCodexPath', async () => {
    const selected = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true });
    const path = selected?.[0]?.fsPath;
    if (path !== undefined) await vscode.workspace.getConfiguration('codexAgentMap').update('codexPath', path, vscode.ConfigurationTarget.Global);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.signIn', async () => {
    panel?.show();
    await controller?.handle({ type: 'beginLogin' });
  }));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.initializeProjectMap', () => controller?.initializeMapCommand()));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.scanProjectArchitecture', () => controller?.scanMapCommand()));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.runVisualizationDemo', () => controller?.runDemo()));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.stopVisualizationDemo', () => controller?.stopDemo()));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.openVisualWorkspace', () => { panel?.show(); controller?.showView('combined'); }));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.editProjectMap', () => { panel?.show(); void controller?.handle({ type: 'editProjectMap' }); }));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.saveProjectLayout', () => controller?.showView('project')));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.autoLayoutProject', () => controller?.showView('project')));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.resetAgentLayout', () => controller?.showView('agents')));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.fitVisualization', () => controller?.showView('combined')));
  context.subscriptions.push(vscode.commands.registerCommand('codexAgentMap.showUnmappedActivity', () => controller?.showUnmappedActivity()));
}

export async function deactivate(): Promise<void> {
  controller?.dispose();
  panel?.dispose();
  await client?.disconnect();
  controller = undefined;
  panel = undefined;
  client = undefined;
}
