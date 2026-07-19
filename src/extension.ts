import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Codex Agent Map');
  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.commands.registerCommand('codexAgentMap.openWorkspace', () => {
      output.appendLine('Codex Agent Map workspace requested.');
      output.show(true);
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

export function deactivate(): void {}
