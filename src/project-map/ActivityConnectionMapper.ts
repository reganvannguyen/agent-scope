import { isRecord } from '../codex/ProtocolTypes';
import type { ComponentMatch } from './ActivityMatchingModels';
import { matchCommand } from './CommandComponentMatcher';
import { PathComponentMatcher } from './PathComponentMatcher';
import type { ProjectComponent } from './ProjectMapModels';
import { matchDomain, matchTool } from './ToolComponentMatcher';

export function matchActivity(value: unknown, roots: string[], components: ProjectComponent[]): ComponentMatch[] {
  if (!isRecord(value) || typeof value.type !== 'string') return [];
  if (value.type === 'fileChange' && Array.isArray(value.changes)) {
    const matcher = new PathComponentMatcher(roots, components); const matches = new Map<string, ComponentMatch>();
    for (const change of value.changes) if (isRecord(change) && typeof change.path === 'string') for (const pathMatch of safeMatch(matcher, change.path)) { const existing = matches.get(pathMatch.componentId); const evidence = { type: 'file-change' as const, path: pathMatch.relativePath }; matches.set(pathMatch.componentId, { componentId: pathMatch.componentId, confidence: 'confirmed', activityType: 'editing', primary: pathMatch.primary || existing?.primary === true, evidence: [...(existing?.evidence ?? []), evidence] }); }
    return [...matches.values()];
  }
  if (value.type === 'commandExecution' && typeof value.command === 'string') return matchCommand(value.command, typeof value.cwd === 'string' ? value.cwd : null, roots, components);
  if ((value.type === 'mcpToolCall' || value.type === 'dynamicToolCall') && typeof value.tool === 'string') return matchTool(typeof value.server === 'string' ? value.server : null, value.tool, isRecord(value.appContext) && typeof value.appContext.name === 'string' ? value.appContext.name : null, components);
  if (typeof value.host === 'string') return matchDomain(value.host, typeof value.protocol === 'string' ? value.protocol : null, components);
  return [];
}
function safeMatch(matcher: PathComponentMatcher, value: string) { try { return matcher.match(value); } catch { return []; } }
