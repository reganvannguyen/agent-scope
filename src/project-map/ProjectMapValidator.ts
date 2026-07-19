import { Minimatch } from 'minimatch';
import { isRecord } from '../codex/ProtocolTypes';
import type { ArchitectureEdge, ProjectComponent, ProjectComponentType, ProjectMapValidation, ToolMatcher } from './ProjectMapModels';

const types = new Set<ProjectComponentType>(['frontend', 'backend', 'service', 'mcp', 'database', 'cache', 'queue', 'storage', 'external', 'tests', 'shared', 'infrastructure', 'other']);

export function validateProjectMap(value: unknown): ProjectMapValidation {
  const errors: string[] = [];
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.project) || typeof value.project.name !== 'string' || value.project.name.trim() === '' || !Array.isArray(value.components) || !Array.isArray(value.edges)) return { errors: ['Map must contain schemaVersion 1, a non-blank project name, components, and edges.'] };
  const components = value.components.flatMap((entry, index) => { const component = componentValue(entry, index, errors); return component === undefined ? [] : [component]; });
  duplicateErrors(components.map(item => item.id), 'component', errors);
  const edges = value.edges.flatMap((entry, index) => { const edge = edgeValue(entry, index, errors); return edge === undefined ? [] : [edge]; });
  duplicateErrors(edges.map(item => item.id), 'edge', errors);
  const componentIds = new Set(components.map(item => item.id));
  for (const edge of edges) {
    if (!componentIds.has(edge.source)) errors.push(`Edge "${edge.id}" has missing source "${edge.source}".`);
    if (!componentIds.has(edge.target)) errors.push(`Edge "${edge.id}" has missing target "${edge.target}".`);
  }
  return errors.length === 0 ? { map: { schemaVersion: 1, project: { name: value.project.name.trim() }, components, edges }, errors } : { errors };
}

function componentValue(value: unknown, index: number, errors: string[]): ProjectComponent | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '' || typeof value.name !== 'string' || value.name.trim() === '' || typeof value.type !== 'string' || !Array.isArray(value.paths) || !isRecord(value.position)) { errors.push(`Component ${String(index + 1)} is missing a valid id, name, type, paths, or position.`); return undefined; }
  const id = value.id;
  const type = types.has(value.type as ProjectComponentType) ? value.type as ProjectComponentType : 'other';
  const paths = stringArray(value.paths, `Component "${value.id}" paths`, errors);
  for (const pattern of paths) validateGlob(pattern, `Component "${value.id}"`, errors);
  const x = value.position.x; const y = value.position.y;
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) { errors.push(`Component "${value.id}" has an invalid position.`); return undefined; }
  const component: ProjectComponent = { id: value.id.trim(), name: value.name.trim(), type, paths, position: { x, y } };
  if (typeof value.description === 'string') component.description = value.description;
  if (typeof value.collapsed === 'boolean') component.collapsed = value.collapsed;
  if (Array.isArray(value.tags)) component.tags = stringArray(value.tags, `Component "${value.id}" tags`, errors);
  if (isRecord(value.metadata)) component.metadata = value.metadata;
  if (Array.isArray(value.domainMatchers)) { component.domainMatchers = stringArray(value.domainMatchers, `Component "${value.id}" domains`, errors); for (const domain of component.domainMatchers) validateDomain(domain, value.id, errors); }
  if (Array.isArray(value.commandMatchers)) component.commandMatchers = value.commandMatchers.flatMap((matcher, matcherIndex) => isRecord(matcher) && typeof matcher.pattern === 'string' && validRegex(matcher.pattern) ? [{ pattern: matcher.pattern }] : (errors.push(`Component "${id}" command matcher ${String(matcherIndex + 1)} is invalid.`), []));
  if (Array.isArray(value.toolMatchers)) component.toolMatchers = value.toolMatchers.flatMap((matcher, matcherIndex) => { const parsed = toolMatcher(matcher); return parsed === undefined ? (errors.push(`Component "${id}" tool matcher ${String(matcherIndex + 1)} is invalid.`), []) : [parsed]; });
  return component;
}
function edgeValue(value: unknown, index: number, errors: string[]): ArchitectureEdge | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '' || typeof value.source !== 'string' || typeof value.target !== 'string' || typeof value.type !== 'string') { errors.push(`Edge ${String(index + 1)} is invalid.`); return undefined; }
  const edge: ArchitectureEdge = { id: value.id.trim(), source: value.source, target: value.target, type: value.type };
  if (typeof value.label === 'string') edge.label = value.label;
  return edge;
}
function toolMatcher(value: unknown): ToolMatcher | undefined { if (!isRecord(value)) return undefined; const result: ToolMatcher = {}; for (const key of ['server', 'serverPattern', 'toolPattern', 'appName'] as const) if (typeof value[key] === 'string') result[key] = value[key]; return Object.keys(result).length === 0 || !Object.values(result).every(validWildcard) ? undefined : result; }
function stringArray(value: unknown[], label: string, errors: string[]): string[] { const result = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim()); if (result.length !== value.length) errors.push(`${label} must contain non-blank strings.`); return result; }
function validateGlob(value: string, label: string, errors: string[]): void { try { if (isUnsafeRelative(value)) throw new Error(); new Minimatch(value); } catch { errors.push(`${label} has invalid workspace-relative glob "${value}".`); } }
function validateDomain(value: string, id: string, errors: string[]): void { if (!/^(?:\*\.)?(?:[a-z0-9-]+\.)*[a-z0-9-]+$/iu.test(value)) errors.push(`Component "${id}" has invalid domain matcher "${value}".`); }
function validWildcard(value: string): boolean { try { new Minimatch(value); return value.trim() !== ''; } catch { return false; } }
function validRegex(value: string): boolean { try { new RegExp(value, 'u'); return true; } catch { return false; } }
function isUnsafeRelative(value: string): boolean { return /^(?:[a-z]:|[\\/]|\.\.(?:[\\/]|$))/iu.test(value); }
function duplicateErrors(values: string[], kind: string, errors: string[]): void { const seen = new Set<string>(); for (const value of values) { if (seen.has(value)) errors.push(`Duplicate ${kind} id "${value}".`); seen.add(value); } }
