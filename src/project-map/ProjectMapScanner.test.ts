import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addComponent, addEdge, deleteComponent, mapFromSuggestions, reverseEdge, updateComponent } from './ProjectMapEditor';
import type { ProjectComponent } from './ProjectMapModels';
import { ProjectMapScanner } from './ProjectMapScanner';

describe('deterministic project scanner', () => {
  it('detects frontend, backend, database, Redis, MCP, tests, and infrastructure with evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-map-scan-'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '1', express: '1', pg: '1', redis: '1', '@modelcontextprotocol/sdk': '1' } }));
    await mkdir(join(root, 'tests')); await mkdir(join(root, 'migrations')); await mkdir(join(root, 'terraform'));
    const result = await new ProjectMapScanner(root).scan();
    expect(result.suggestions.map(item => item.type)).toEqual(expect.arrayContaining(['frontend', 'backend', 'database', 'cache', 'mcp', 'tests', 'infrastructure']));
    expect(result.suggestions.every(item => item.evidence.length > 0)).toBe(true);
    expect(result.truncated).toBe(false);
  });
  it('detects Compose services, excludes dependencies and environment files, and enforces limits', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-map-scan-'));
    await writeFile(join(root, 'compose.yaml'), 'services:\n  db:\n    image: postgres\n  cache:\n    image: redis\n');
    await writeFile(join(root, '.env'), 'SECRET=postgres');
    await mkdir(join(root, 'node_modules')); await writeFile(join(root, 'node_modules', 'package.json'), '{"dependencies":{"react":"1"}}');
    await writeFile(join(root, 'a.txt'), 'a'); await writeFile(join(root, 'b.txt'), 'b');
    const result = await new ProjectMapScanner(root, { maxFiles: 2, maxManifestBytes: 1024 }).scan();
    expect(result.truncated).toBe(true);
    expect(result.filesInspected).toBeLessThanOrEqual(2);
    expect(result.suggestions.some(item => item.type === 'frontend')).toBe(false);
  });
  it('does not write a project map while scanning', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-map-scan-'));
    await new ProjectMapScanner(root).scan();
    await expect(import('node:fs/promises').then(fs => fs.stat(join(root, '.codex-agent-map', 'project-map.json')))).rejects.toThrow();
  });
});

describe('project map editing', () => {
  it('supports reviewed suggestions and component and edge operations', () => {
    let map = mapFromSuggestions('Example', [{ id: 'frontend', name: 'Frontend', type: 'frontend', paths: ['src/**'] }]);
    const backend: ProjectComponent = { id: 'backend', name: 'Backend', type: 'backend', description: 'API', paths: ['server/**'], position: { x: 400, y: 100 } };
    map = addComponent(map, backend);
    map = updateComponent(map, { ...backend, name: 'API' });
    map = addEdge(map, { id: 'frontend-api', source: 'frontend', target: 'backend', type: 'request', label: 'HTTP' });
    map = reverseEdge(map, 'frontend-api');
    expect(map.edges[0]).toMatchObject({ source: 'backend', target: 'frontend' });
    const deleted = deleteComponent(map, 'backend', ['backend']);
    expect(deleted).toMatchObject({ removedEdgeIds: ['frontend-api'], hadRecentActivity: true, map: { components: [{ id: 'frontend' }], edges: [] } });
  });
  it('validates every edit and rejects missing endpoints', () => {
    const map = mapFromSuggestions('Example', []);
    expect(() => addEdge(map, { id: 'bad', source: 'missing', target: 'also-missing', type: 'request' })).toThrow('missing source');
  });
});
