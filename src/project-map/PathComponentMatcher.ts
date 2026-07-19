import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { minimatch } from 'minimatch';
import type { ProjectComponent } from './ProjectMapModels';

export interface PathMatch { componentId: string; relativePath: string; pattern: string; primary: boolean }

export class PathComponentMatcher {
  public constructor(private readonly roots: string[], private readonly components: ProjectComponent[]) {}
  public match(candidate: string): PathMatch[] {
    const relativePath = workspaceRelative(candidate, this.roots);
    const matches = this.components.flatMap(component => component.paths.flatMap(pattern => minimatch(relativePath, normalize(pattern), { nocase: true, dot: true }) ? [{ componentId: component.id, relativePath, pattern, primary: false, score: specificity(pattern) }] : []));
    const max = Math.max(...matches.map(item => item.score), -1);
    return matches.sort((a, b) => b.score - a.score || a.componentId.localeCompare(b.componentId)).map(({ score, ...item }) => ({ ...item, primary: score === max }));
  }
  public async matchExisting(candidate: string): Promise<PathMatch[]> {
    if (!looksAbsolute(candidate)) return this.match(candidate);
    const actual = await realpath(candidate); const roots = await Promise.all(this.roots.map(root => realpath(root)));
    if (!insideAny(actual, roots)) throw new Error('Path resolves outside configured workspace roots.');
    return this.match(actual);
  }
}

export function workspaceRelative(candidate: string, roots: string[]): string {
  const normalized = normalize(candidate);
  if (!looksAbsolute(candidate)) { const clean = collapse(normalized); if (clean === '..' || clean.startsWith('../')) throw new Error('Path is outside configured workspace roots.'); return clean; }
  const root = roots.map(normalize).sort((a, b) => b.length - a.length).find(value => normalized.toLocaleLowerCase() === value.toLocaleLowerCase() || normalized.toLocaleLowerCase().startsWith(`${value.toLocaleLowerCase()}/`));
  if (root === undefined) throw new Error('Path is outside configured workspace roots.');
  return collapse(normalized.slice(root.length).replace(/^\//u, ''));
}
function insideAny(candidate: string, roots: string[]): boolean { return roots.some(root => { const rel = relative(resolve(root), resolve(candidate)); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); }); }
function looksAbsolute(value: string): boolean { return isAbsolute(value) || /^[a-z]:[\\/]/iu.test(value); }
function normalize(value: string): string { return value.replace(/\\/gu, '/').replace(/\/$/u, ''); }
function collapse(value: string): string { const parts: string[] = []; for (const part of value.split('/')) { if (part === '' || part === '.') continue; if (part === '..') { if (parts.length === 0) return `../${value}`; parts.pop(); } else parts.push(part); } return parts.join('/'); }
function specificity(pattern: string): number { return normalize(pattern).split('/').reduce((score, part) => score + (part.includes('*') ? 1 : 10), 0); }
