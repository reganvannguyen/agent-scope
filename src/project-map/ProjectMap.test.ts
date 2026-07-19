import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectMap } from './ProjectMapModels';
import { ProjectMapService, safeMapPath } from './ProjectMapService';
import { validateProjectMap } from './ProjectMapValidator';

const valid: ProjectMap = { schemaVersion: 1, project: { name: 'Example' }, components: [
  { id: 'app', name: 'App', type: 'frontend', paths: ['src/**'], position: { x: 1, y: 2 } },
  { id: 'api', name: 'API', type: 'backend', paths: ['server/**'], position: { x: 3, y: 4 } }
], edges: [{ id: 'app-api', source: 'app', target: 'api', type: 'request' }] };

describe('project map validation', () => {
  it('accepts a valid schema and safely maps unknown component types to other', () => {
    expect(validateProjectMap(valid).map).toEqual(valid);
    expect(validateProjectMap({ ...valid, components: [{ ...valid.components[0], type: 'future' }, valid.components[1]] }).map?.components[0]?.type).toBe('other');
  });
  it.each([
    ['duplicate component', { ...valid, components: [...valid.components, valid.components[0]] }, 'Duplicate component'],
    ['duplicate edge', { ...valid, edges: [...valid.edges, valid.edges[0]] }, 'Duplicate edge'],
    ['missing source', { ...valid, edges: [{ ...valid.edges[0], source: 'missing' }] }, 'missing source'],
    ['missing target', { ...valid, edges: [{ ...valid.edges[0], target: 'missing' }] }, 'missing target'],
    ['invalid position', { ...valid, components: [{ ...valid.components[0], position: { x: Number.NaN, y: 1 } }] }, 'invalid position'],
    ['blank name', { ...valid, components: [{ ...valid.components[0], name: ' ' }] }, 'missing a valid'],
    ['invalid glob', { ...valid, components: [{ ...valid.components[0], paths: ['../secret/**'] }] }, 'invalid workspace-relative glob']
  ])('rejects %s', (_name, value, message) => { expect(validateProjectMap(value).errors.join(' ')).toContain(message); });
});

describe('project map persistence', () => {
  it('writes and reloads atomically while preserving the last valid map after invalid reload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-map-'));
    const service = new ProjectMapService(root);
    await expect(service.save(valid)).resolves.toEqual(valid);
    expect(JSON.parse(await readFile(service.path, 'utf8'))).toEqual(valid);
    await writeFile(service.path, '{"invalid":true}', 'utf8');
    await expect(service.load()).rejects.toThrow('Invalid project map');
    expect(service.snapshot).toEqual(valid);
  });
  it('rejects absolute and outside-workspace configuration paths', () => {
    expect(() => safeMapPath('C:/repo', '../outside.json')).toThrow('outside');
    expect(() => safeMapPath('C:/repo', 'C:/absolute.json')).toThrow('workspace-relative');
  });
});
