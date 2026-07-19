import * as vscode from 'vscode';
import { AppServerClient } from './codex/AppServerClient';
import { AppServerProcess } from './codex/AppServerProcess';
import { isRecord } from './codex/ProtocolTypes';

let client: AppServerClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Codex Agent Map');
  const process = new AppServerProcess();
  const packageJson: unknown = context.extension.packageJSON;
  const version = isRecord(packageJson) && typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
  client = new AppServerClient(
    process,
    output,
    version,
    vscode.workspace.getConfiguration('codexAgentMap').get<boolean>('debugLogging', false)
  );
  client.on('state', state => { output.appendLine(`Connection state: ${String(state)}`); });
  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.commands.registerCommand('codexAgentMap.openWorkspace', async () => {
      const executable = vscode.workspace.getConfiguration('codexAgentMap').get<string>('codexPath', 'codex');
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      try {
        await client?.connect(executable, cwd);
        void vscode.window.showInformationMessage('Codex Agent Map connected.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown connection failure';
        output.appendLine(`Connection failed: ${message}`);
        void vscode.window.showErrorMessage('Codex Agent Map could not connect.', 'Choose Codex Executable', 'Open Output').then(async action => {
          if (action === 'Choose Codex Executable') await vscode.commands.executeCommand('codexAgentMap.chooseCodexPath');
          if (action === 'Open Output') output.show(true);
        });
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('codexAgentMap.chooseCodexPath', async () => {
      const selected = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true });
      const path = selected?.[0]?.fsPath;
      if (path !== undefined) {
        await vscode.workspace.getConfiguration('codexAgentMap').update('codexPath', path, vscode.ConfigurationTarget.Global);
      }
    })
  );
}

export async function deactivate(): Promise<void> {
  await client?.disconnect();
  client = undefined;
}
