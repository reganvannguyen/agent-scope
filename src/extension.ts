import * as vscode from 'vscode';
import { AppServerClient } from './codex/AppServerClient';
import { AppServerProcess } from './codex/AppServerProcess';
import { AccountService } from './codex/AccountService';
import { CollaborationModeService } from './codex/CollaborationModeService';
import { ModelService } from './codex/ModelService';
import { isRecord, type ServerNotification } from './codex/ProtocolTypes';

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
  const accountService = new AccountService(client);
  const modelService = new ModelService(client);
  const modeService = new CollaborationModeService(client);
  const refreshCatalogs = async (): Promise<void> => {
    const account = await accountService.read();
    output.appendLine(account.signedIn ? `Account: signed in (${account.type ?? 'unknown'})` : 'Account: signed out');
    if (!account.signedIn) return;
    const models = await modelService.list();
    output.appendLine(`Models loaded: ${String(models.length)}`);
    try {
      const modes = await modeService.list();
      output.appendLine(`Collaboration modes loaded: ${String(modes.length)}`);
    } catch (error) {
      output.appendLine(`Collaboration modes unavailable: ${error instanceof Error ? error.message : 'unsupported'}`);
    }
  };
  client.on('state', state => { output.appendLine(`Connection state: ${String(state)}`); });
  client.on('notification', (notification: ServerNotification) => {
    if (notification.method === 'account/login/completed' || notification.method === 'account/updated') {
      void refreshCatalogs().catch((error: unknown) => {
        output.appendLine(`Account refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      });
    }
  });
  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.commands.registerCommand('codexAgentMap.openWorkspace', async () => {
      const executable = vscode.workspace.getConfiguration('codexAgentMap').get<string>('codexPath', 'codex');
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      try {
        await client?.connect(executable, cwd);
        await refreshCatalogs();
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
    vscode.commands.registerCommand('codexAgentMap.signIn', async () => {
      try {
        const login = await accountService.startChatGptLogin();
        const opened = await vscode.env.openExternal(vscode.Uri.parse(login.authUrl, true));
        if (!opened) throw new Error('VS Code could not open the authentication URL');
        void vscode.window.showInformationMessage('Complete ChatGPT sign-in in your browser.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown login failure';
        output.appendLine(`Login failed: ${message}`);
        void vscode.window.showErrorMessage('Could not start ChatGPT sign-in. Open Codex Agent Map output for details.');
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
