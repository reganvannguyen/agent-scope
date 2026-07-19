import * as vscode from 'vscode';

export class ProjectMapWatcher implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private readonly watcher: vscode.FileSystemWatcher;
  public constructor(relativePath: string, private readonly changed: () => void, private readonly debounceMs = 300) {
    this.watcher = vscode.workspace.createFileSystemWatcher(relativePath);
    const queue = (): void => { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = undefined; this.changed(); }, this.debounceMs); };
    this.watcher.onDidCreate(queue); this.watcher.onDidChange(queue); this.watcher.onDidDelete(queue);
  }
  public dispose(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.watcher.dispose(); }
}
