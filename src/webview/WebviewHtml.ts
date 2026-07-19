import * as vscode from 'vscode';

export function webviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = createNonce();
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'index.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'index.css'));
  const csp = [
    `default-src 'none'`, `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource}`, `script-src 'nonce-${nonce}'`
  ].join('; ');
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="${style.toString()}"><title>Codex Workspace</title></head>
<body><div id="root"></div><script nonce="${nonce}" src="${script.toString()}"></script></body></html>`;
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
