import * as path from 'node:path';

export function resolveWorkspacePath(rootPath: string, candidate: string): string {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('File path is outside the workspace');
  return resolved;
}
