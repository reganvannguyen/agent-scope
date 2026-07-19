import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchActivity } from './ActivityConnectionMapper';
import { matchCommand } from './CommandComponentMatcher';
import { PathComponentMatcher, workspaceRelative } from './PathComponentMatcher';
import type { ProjectComponent } from './ProjectMapModels';
import { matchDomain, matchTool, redactArguments } from './ToolComponentMatcher';

const components: ProjectComponent[] = [
  { id: 'backend', name: 'Backend', type: 'backend', paths: ['src/**', 'src/services/**'], commandMatchers: [{ pattern: 'api-check' }], position: { x: 0, y: 0 } },
  { id: 'tests', name: 'Tests', type: 'tests', paths: ['tests/**'], position: { x: 0, y: 0 } },
  { id: 'canvas', name: 'Canvas', type: 'external', paths: [], toolMatchers: [{ server: 'canvas' }, { toolPattern: 'canvas_*' }, { appName: 'Canvas LMS' }], domainMatchers: ['*.instructure.com'], position: { x: 0, y: 0 } }
];

describe('path component matching', () => {
  it('handles Windows and POSIX separators, absolute paths, multiple roots, and specificity', () => {
    expect(workspaceRelative('C:\\Repo\\src\\services\\a.ts', ['c:/repo'])).toBe('src/services/a.ts');
    expect(workspaceRelative('/work/repo/src/a.ts', ['/other', '/work/repo'])).toBe('src/a.ts');
    const matches = new PathComponentMatcher(['C:/repo'], components).match('C:/repo/src/services/a.ts');
    expect(matches[0]).toMatchObject({ componentId: 'backend', pattern: 'src/services/**', primary: true });
    expect(matches).toHaveLength(2);
    expect(() => workspaceRelative('C:/outside/a.ts', ['C:/repo'])).toThrow('outside');
  });
  it('rejects an existing symlink that resolves outside the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-map-root-')); const outside = await mkdtemp(join(tmpdir(), 'agent-map-outside-'));
    await writeFile(join(outside, 'secret.txt'), 'safe fixture'); await mkdir(join(root, 'src'));
    const link = join(root, 'src', 'linked'); await symlink(outside, link, 'junction');
    await expect(new PathComponentMatcher([root], components).matchExisting(join(link, 'secret.txt'))).rejects.toThrow('outside');
  });
});

describe('command and file activity matching', () => {
  it('maps CWD and safe quoted paths without executing command text', () => {
    const result = matchCommand('tool "src/services/a.ts"; Write-Output SHOULD_NOT_RUN', 'C:/repo/src', ['C:/repo'], components);
    expect(result.some(item => item.componentId === 'backend')).toBe(true);
  });
  it('identifies common tests, configured matchers, and Windows paths', () => {
    expect(matchCommand('npm test -- tests/unit.ts', 'C:\\repo', ['C:/repo'], components).map(item => item.componentId)).toContain('tests');
    expect(matchCommand('api-check', 'C:/repo', ['C:/repo'], components).map(item => item.componentId)).toContain('backend');
  });
  it('creates confirmed editing connections for multiple files/components and preserves outcomes outside matching', () => {
    const result = matchActivity({ type: 'fileChange', status: 'completed', changes: [{ path: 'src/a.ts' }, { path: 'tests/a.test.ts' }] }, ['C:/repo'], components);
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ componentId: 'backend', confidence: 'confirmed', activityType: 'editing' }), expect.objectContaining({ componentId: 'tests', confidence: 'confirmed' })]));
  });
});

describe('tool and external matching', () => {
  it('matches exact server, wildcard tool, app metadata, and external host', () => {
    expect(matchTool('canvas', 'read', null, components)[0]?.componentId).toBe('canvas');
    expect(matchTool(null, 'canvas_course', null, components)[0]?.componentId).toBe('canvas');
    expect(matchTool(null, 'read', 'Canvas LMS', components)[0]?.componentId).toBe('canvas');
    expect(matchDomain('school.instructure.com', 'https', components)[0]).toMatchObject({ componentId: 'canvas', confidence: 'confirmed' });
  });
  it('redacts secret-looking arguments and does not map ordinary web searches', () => {
    expect(redactArguments({ apiKey: 'secret', nested: { password: 'hidden', query: 'safe' } })).toEqual({ apiKey: '[REDACTED]', nested: { password: '[REDACTED]', query: 'safe' } });
    expect(matchActivity({ type: 'webSearch', query: 'Canvas docs' }, ['C:/repo'], components)).toEqual([]);
  });
});
