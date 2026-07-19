import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import type { ArchitectureEdge, ProjectComponentType } from './ProjectMapModels';

export interface ArchitectureSuggestion { id: string; name: string; type: ProjectComponentType; paths: string[]; confidence: 'high' | 'medium' | 'low'; evidence: string[] }
export interface ArchitectureEdgeSuggestion extends ArchitectureEdge { confidence: 'high' | 'medium' | 'low'; evidence: string[] }
export interface ProjectScanResult { suggestions: ArchitectureSuggestion[]; edgeSuggestions: ArchitectureEdgeSuggestion[]; filesInspected: number; truncated: boolean }
export interface ScanLimits { maxFiles: number; maxManifestBytes: number }

const excluded = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '.next', '.turbo', 'vendor', 'target']);
const manifests = new Set(['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']);

export class ProjectMapScanner {
  public constructor(private readonly root: string, private readonly limits: ScanLimits = { maxFiles: 2_000, maxManifestBytes: 256_000 }) {}
  public async scan(): Promise<ProjectScanResult> {
    const files: string[] = []; const directories = new Set<string>(); let truncated = false;
    const walk = async (directory: string): Promise<void> => {
      if (files.length >= this.limits.maxFiles) { truncated = true; return; }
      let entries; try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (files.length >= this.limits.maxFiles) { truncated = true; return; }
        if (entry.name.startsWith('.env')) continue;
        const absolute = join(directory, entry.name); const rel = normalize(relative(this.root, absolute));
        if (entry.isDirectory()) { if (!excluded.has(entry.name)) { directories.add(rel); await walk(absolute); } }
        else if (entry.isFile()) files.push(rel);
      }
    };
    await walk(this.root);
    const content = new Map<string, string>();
    for (const file of files.filter(item => manifests.has(basename(item)))) {
      try { const info = await stat(join(this.root, file)); if (info.size <= this.limits.maxManifestBytes) content.set(file, await readFile(join(this.root, file), 'utf8')); } catch { /* A file may disappear during a scan. */ }
    }
    const suggestions: ArchitectureSuggestion[] = [];
    detectPackages(content, suggestions); detectDirectories(directories, suggestions); detectCompose(content, suggestions);
    const deduped = dedupeSuggestions(suggestions);
    return { suggestions: deduped, edgeSuggestions: suggestEdges(deduped), filesInspected: files.length, truncated };
  }
}

function detectPackages(content: Map<string, string>, output: ArchitectureSuggestion[]): void {
  for (const [file, text] of content) {
    const lower = text.toLocaleLowerCase(); const base = directoryGlob(file);
    if (/\b(?:react|vue|svelte|@angular\/core|next)\b/u.test(lower)) output.push(suggestion('frontend', 'Frontend', 'frontend', base, 'high', `${file} declares a frontend framework`));
    if (/\b(?:express|@nestjs\/core|fastapi|flask|django|spring-boot|aspnet)\b/u.test(lower)) output.push(suggestion('backend', 'Backend', 'backend', base, 'high', `${file} declares a backend framework`));
    if (/\b(?:postgres|postgresql|psycopg|pg|mysql|sqlite)\b/u.test(lower)) output.push(suggestion('database', 'Database', 'database', '**/migrations/**', 'medium', `${file} declares a database dependency`));
    if (/\bredis\b/u.test(lower)) output.push(suggestion('redis', 'Redis', 'cache', '**/*redis*/**', 'high', `${file} declares Redis`));
    if (/\b(?:modelcontextprotocol|mcp-server|mcp_server)\b/u.test(lower)) output.push(suggestion('mcp', 'MCP Server', 'mcp', '**/*mcp*/**', 'high', `${file} declares MCP support`));
  }
}
function detectDirectories(directories: Set<string>, output: ArchitectureSuggestion[]): void {
  for (const directory of directories) {
    const name = basename(directory).toLocaleLowerCase();
    if (name === 'tests' || name === 'test' || name === '__tests__') output.push(suggestion('tests', 'Tests', 'tests', `${directory}/**`, 'high', `${directory} is a test directory`));
    if (name === 'migrations') output.push(suggestion('database', 'Database', 'database', `${directory}/**`, 'medium', `${directory} contains database migrations`));
    if (['infra', 'infrastructure', 'deploy', 'deployment', 'kubernetes', 'terraform'].includes(name)) output.push(suggestion('infrastructure', 'Infrastructure', 'infrastructure', `${directory}/**`, 'high', `${directory} contains deployment metadata`));
    if (name === 'mcp' || name === 'mcp-server' || name === 'mcp_server') output.push(suggestion('mcp', 'MCP Server', 'mcp', `${directory}/**`, 'high', `${directory} is an MCP directory`));
  }
}
function detectCompose(content: Map<string, string>, output: ArchitectureSuggestion[]): void {
  for (const [file, text] of content) {
    if (!/(?:^|[\\/])(?:docker-)?compose\.ya?ml$/iu.test(file)) continue;
    if (/\bpostgres(?:ql)?\b/iu.test(text)) output.push(suggestion('database', 'Database', 'database', '**/migrations/**', 'high', `${file} configures PostgreSQL`));
    if (/\bredis\b/iu.test(text)) output.push(suggestion('redis', 'Redis', 'cache', '**/*redis*/**', 'high', `${file} configures Redis`));
  }
}
function suggestion(id: string, name: string, type: ProjectComponentType, path: string, confidence: ArchitectureSuggestion['confidence'], evidence: string): ArchitectureSuggestion { return { id, name, type, paths: [path], confidence, evidence: [evidence] }; }
function dedupeSuggestions(values: ArchitectureSuggestion[]): ArchitectureSuggestion[] { const result = new Map<string, ArchitectureSuggestion>(); for (const value of values) { const existing = result.get(value.id); result.set(value.id, existing === undefined ? value : { ...existing, paths: [...new Set([...existing.paths, ...value.paths])], evidence: [...new Set([...existing.evidence, ...value.evidence])], confidence: confidence(existing.confidence) >= confidence(value.confidence) ? existing.confidence : value.confidence }); } return [...result.values()]; }
function confidence(value: ArchitectureSuggestion['confidence']): number { return value === 'high' ? 3 : value === 'medium' ? 2 : 1; }
function directoryGlob(file: string): string { const parts = normalize(file).split('/'); return parts.length === 1 ? '**' : `${parts.slice(0, -1).join('/')}/**`; }
function normalize(value: string): string { return value.replace(/\\/gu, '/'); }

export function suggestEdges(components: ReadonlyArray<Pick<ArchitectureSuggestion, 'id' | 'name' | 'type'>>): ArchitectureEdgeSuggestion[] {
  const result: ArchitectureEdgeSuggestion[] = [];
  const add = (source: Pick<ArchitectureSuggestion, 'id' | 'name'>, target: Pick<ArchitectureSuggestion, 'id' | 'name'>, type: string, label: string): void => {
    if (source.id === target.id || result.some(edge => edge.source === source.id && edge.target === target.id && edge.type === type)) return;
    result.push({ id: `${source.id}-${target.id}-${type}`, source: source.id, target: target.id, type, label, confidence: 'medium', evidence: [`${source.name} commonly connects to ${target.name}`] });
  };
  const typed = (types: ProjectComponentType[]) => components.filter(component => types.includes(component.type));
  for (const frontend of typed(['frontend'])) for (const api of typed(['backend', 'service', 'mcp'])) add(frontend, api, 'request', 'API');
  for (const api of typed(['backend', 'service', 'mcp'])) {
    for (const data of typed(['database', 'storage', 'queue'])) add(api, data, 'data', 'Data');
    for (const cache of typed(['cache'])) add(api, cache, 'cache', 'Cache');
  }
  for (const tests of typed(['tests'])) for (const target of components.filter(component => !['tests', 'infrastructure', 'external'].includes(component.type))) add(tests, target, 'test', 'Tests');
  return result;
}
