import { describe, expect, it } from 'vitest';
import { resolveWorkspacePath } from './WorkspacePath';

describe('resolveWorkspacePath', () => {
  it('accepts a path inside the workspace', () => {
    expect(resolveWorkspacePath('C:/repo', 'src/file.ts').replaceAll('\\', '/')).toBe('C:/repo/src/file.ts');
  });
  it('rejects traversal, absolute escape, and the workspace directory itself', () => {
    expect(() => resolveWorkspacePath('C:/repo', '../secret.txt')).toThrow('outside');
    expect(() => resolveWorkspacePath('C:/repo', 'D:/secret.txt')).toThrow('outside');
    expect(() => resolveWorkspacePath('C:/repo', '.')).toThrow('outside');
  });
});
