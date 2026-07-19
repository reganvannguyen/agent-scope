import type { ComponentMatch } from './ActivityMatchingModels';
import { PathComponentMatcher } from './PathComponentMatcher';
import type { ProjectComponent } from './ProjectMapModels';

export function matchCommand(command: string, cwd: string | null, roots: string[], components: ProjectComponent[]): ComponentMatch[] {
  const matches = new Map<string, ComponentMatch>(); const paths = pathArguments(command);
  const pathMatcher = new PathComponentMatcher(roots, components);
  if (cwd !== null) addPathMatches(matches, safeMatch(pathMatcher, cwd), 'command-cwd', cwd, 'inferred', 'running-command');
  for (const candidate of paths) addPathMatches(matches, safeMatch(pathMatcher, candidate), 'command-path', candidate, 'inferred', isTestCommand(command) ? 'testing' : 'running-command');
  if (isTestCommand(command)) for (const component of components.filter(item => item.type === 'tests')) merge(matches, { componentId: component.id, confidence: 'inferred', activityType: 'testing', primary: true, evidence: [{ type: 'configured-command-matcher', matcher: 'known-test-command' }] });
  for (const component of components) for (const matcher of component.commandMatchers ?? []) if (new RegExp(matcher.pattern, 'u').test(command)) merge(matches, { componentId: component.id, confidence: 'inferred', activityType: isTestCommand(command) ? 'testing' : 'running-command', primary: true, evidence: [{ type: 'configured-command-matcher', matcher: matcher.pattern }] });
  return [...matches.values()];
}
function pathArguments(command: string): string[] { return [...command.matchAll(/"([^"]+)"|'([^']+)'|([^\s]+)/gu)].flatMap(match => { const value = match[1] ?? match[2] ?? match[3]; return value !== undefined && /[\\/.]/u.test(value) && !value.startsWith('-') ? [value] : []; }); }
function isTestCommand(value: string): boolean { return /(?:^|\s)(?:pytest|python\s+-m\s+pytest|npm\s+(?:run\s+)?test|pnpm\s+test|yarn\s+test|vitest|jest|cargo\s+test|go\s+test|mvn\s+test|gradle\s+test|dotnet\s+test)(?:\s|$)/iu.test(value); }
function safeMatch(matcher: PathComponentMatcher, value: string) { try { return matcher.match(value); } catch { return []; } }
function addPathMatches(target: Map<string, ComponentMatch>, values: ReturnType<PathComponentMatcher['match']>, type: 'command-cwd' | 'command-path', value: string, confidence: 'inferred', activityType: 'testing' | 'running-command'): void { for (const match of values) merge(target, { componentId: match.componentId, confidence, activityType, primary: match.primary, evidence: [type === 'command-cwd' ? { type, cwd: value } : { type, path: value }] }); }
function merge(target: Map<string, ComponentMatch>, value: ComponentMatch): void { const existing = target.get(value.componentId); target.set(value.componentId, existing === undefined ? value : { ...existing, primary: existing.primary || value.primary, evidence: [...existing.evidence, ...value.evidence] }); }
