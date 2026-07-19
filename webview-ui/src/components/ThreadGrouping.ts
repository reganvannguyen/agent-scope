import type { Thread } from '../types';

export interface ThreadGroup { cwd: string; label: string; threads: Thread[] }

export function groupThreads(threads: Thread[], currentWorkspace?: string): ThreadGroup[] {
  const grouped = new Map<string, Thread[]>();
  for (const thread of threads) grouped.set(thread.cwd, [...(grouped.get(thread.cwd) ?? []), thread]);
  return [...grouped].map(([cwd, values]) => ({ cwd, label: workspaceName(cwd), threads: values.sort((a, b) => b.updatedAt - a.updatedAt) }))
    .sort((a, b) => {
      const aCurrent = samePath(a.cwd, currentWorkspace); const bCurrent = samePath(b.cwd, currentWorkspace);
      return aCurrent === bCurrent ? a.label.localeCompare(b.label) : aCurrent ? -1 : 1;
    });
}

function workspaceName(cwd: string): string { return cwd.replace(/[\\/]+$/u, '').split(/[\\/]/u).pop() || cwd; }
export function samePath(left: string, right?: string): boolean { return right !== undefined && left.replace(/\\/gu, '/').toLocaleLowerCase() === right.replace(/\\/gu, '/').toLocaleLowerCase(); }
