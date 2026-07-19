interface VsCodeApi { postMessage(message: unknown): void; getState(): unknown; setState(state: unknown): void; }
declare function acquireVsCodeApi(): VsCodeApi;
export const vscode = acquireVsCodeApi();
export function post(message: unknown): void { vscode.postMessage(message); }
