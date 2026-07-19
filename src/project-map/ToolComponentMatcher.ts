import { minimatch } from 'minimatch';
import type { ComponentMatch } from './ActivityMatchingModels';
import type { ProjectComponent } from './ProjectMapModels';

export function matchTool(server: string | null, tool: string, appName: string | null, components: ProjectComponent[]): ComponentMatch[] {
  return components.flatMap(component => (component.toolMatchers ?? []).some(matcher =>
    (matcher.server !== undefined && equal(matcher.server, server)) || (matcher.serverPattern !== undefined && server !== null && minimatch(server, matcher.serverPattern, { nocase: true })) ||
    (matcher.toolPattern !== undefined && minimatch(tool, matcher.toolPattern, { nocase: true })) || (matcher.appName !== undefined && equal(matcher.appName, appName))
  ) ? [{ componentId: component.id, confidence: 'confirmed' as const, activityType: 'using-tool' as const, primary: true, evidence: [{ type: 'tool-call' as const, server, tool }] }] : []);
}
export function matchDomain(host: string, protocol: string | null, components: ProjectComponent[]): ComponentMatch[] { const normalized = host.toLocaleLowerCase().replace(/\.$/u, ''); return components.flatMap(component => (component.domainMatchers ?? []).some(pattern => domainMatch(normalized, pattern)) ? [{ componentId: component.id, confidence: 'confirmed' as const, activityType: 'calling-api' as const, primary: true, evidence: [{ type: 'network-target' as const, host: normalized, protocol }] }] : []); }
export function redactArguments(value: unknown): unknown { if (Array.isArray(value)) return value.map(redactArguments); if (typeof value !== 'object' || value === null) return value; return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(?:token|secret|password|authorization|api[_-]?key)/iu.test(key) ? '[REDACTED]' : redactArguments(item)])); }
function equal(left: string, right: string | null): boolean { return right !== null && left.toLocaleLowerCase() === right.toLocaleLowerCase(); }
function domainMatch(host: string, pattern: string): boolean { const value = pattern.toLocaleLowerCase(); return value.startsWith('*.') ? host.endsWith(value.slice(1)) && host !== value.slice(2) : host === value; }
