import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { ProjectMap } from './ProjectMapModels';
import { validateProjectMap } from './ProjectMapValidator';

export class ProjectMapService {
  private lastValid: ProjectMap | undefined;
  public constructor(private readonly workspaceRoot: string, private readonly configuredPath = '.codex-agent-map/project-map.json') {}
  public get snapshot(): ProjectMap | undefined { return this.lastValid; }
  public get path(): string { return safeMapPath(this.workspaceRoot, this.configuredPath); }
  public async load(): Promise<ProjectMap> {
    let value: unknown;
    try { value = JSON.parse(await readFile(this.path, 'utf8')) as unknown; }
    catch (error) { throw new Error(`Unable to read project map: ${error instanceof Error ? error.message : 'invalid JSON'}`, { cause: error }); }
    const result = validateProjectMap(value);
    if (result.map === undefined) throw new Error(`Invalid project map: ${result.errors.join(' ')}`);
    this.lastValid = result.map; return result.map;
  }
  public async save(value: unknown): Promise<ProjectMap> {
    const result = validateProjectMap(value);
    if (result.map === undefined) throw new Error(`Invalid project map: ${result.errors.join(' ')}`);
    const target = this.path; await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${String(process.pid)}.${Date.now().toString(36)}.tmp`;
    try { await writeFile(temporary, `${JSON.stringify(result.map, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); await rename(temporary, target); }
    catch (error) { throw new Error(`Project map write failed: ${error instanceof Error ? error.message : 'unknown error'}`, { cause: error }); }
    this.lastValid = result.map; return result.map;
  }
}

export function safeMapPath(workspaceRoot: string, configuredPath: string): string {
  if (configuredPath.trim() === '' || isAbsolute(configuredPath)) throw new Error('Project map path must be workspace-relative.');
  const target = resolve(workspaceRoot, configuredPath); const rel = relative(resolve(workspaceRoot), target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Project map path is outside the workspace.');
  return target;
}
