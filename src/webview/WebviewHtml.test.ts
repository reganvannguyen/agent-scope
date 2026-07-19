import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: vscode.Uri, ...parts: string[]) => ({
      scheme: base.scheme,
      authority: base.authority,
      path: `${base.path}/${parts.join('/')}`,
      query: '',
      fragment: '',
      fsPath: `${base.fsPath}/${parts.join('/')}`,
      with: () => base,
      toJSON: () => ({ scheme: base.scheme, path: `${base.path}/${parts.join('/')}` }),
      toString: () => `file://${base.path}/${parts.join('/')}`
    })
  }
}));

import { webviewHtml } from './WebviewHtml';

describe('webviewHtml', () => {
  it('loads the split Vite entry as a module and permits local module chunks', () => {
    const webview = {
      cspSource: 'vscode-webview://test',
      asWebviewUri: (uri: vscode.Uri) => uri
    } as vscode.Webview;
    const extensionUri = {
      scheme: 'file',
      authority: '',
      path: '/extension',
      query: '',
      fragment: '',
      fsPath: '/extension',
      with: () => extensionUri,
      toJSON: () => ({ scheme: 'file', path: '/extension' }),
      toString: () => 'file:///extension'
    } as vscode.Uri;

    const html = webviewHtml(webview, extensionUri);

    expect(html).toContain('<script type="module"');
    expect(html).toContain('script-src vscode-webview://test');
  });
});
