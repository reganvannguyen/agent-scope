import { describe, expect, it } from 'vitest';
import { bundledCodexCandidatesFromNames } from './CodexExecutable';

describe('bundledCodexCandidatesFromNames', () => {
  it('finds the newest official Windows extension executable first', () => {
    const candidates = bundledCodexCandidatesFromNames('C:/Users/test/.vscode/extensions', [
      'publisher.other-1.0.0',
      'openai.chatgpt-26.9.0-win32-x64',
      'openai.chatgpt-26.10.0-win32-x64'
    ], 'win32', 'x64');
    expect(candidates.map(value => value.replaceAll('\\', '/'))).toEqual([
      'C:/Users/test/.vscode/extensions/openai.chatgpt-26.10.0-win32-x64/bin/windows-x86_64/codex.exe',
      'C:/Users/test/.vscode/extensions/openai.chatgpt-26.9.0-win32-x64/bin/windows-x86_64/codex.exe'
    ]);
  });

  it('builds macOS ARM and Linux x64 paths', () => {
    expect(bundledCodexCandidatesFromNames('/extensions', ['openai.chatgpt-1.0.0'], 'darwin', 'arm64')[0]?.replaceAll('\\', '/'))
      .toBe('/extensions/openai.chatgpt-1.0.0/bin/macos-aarch64/codex');
    expect(bundledCodexCandidatesFromNames('/extensions', ['openai.chatgpt-1.0.0'], 'linux', 'x64')[0]?.replaceAll('\\', '/'))
      .toBe('/extensions/openai.chatgpt-1.0.0/bin/linux-x86_64/codex');
  });

  it('returns no candidates for unsupported architectures', () => {
    expect(bundledCodexCandidatesFromNames('/extensions', ['openai.chatgpt-1.0.0'], 'win32', 'ia32')).toEqual([]);
  });
});
