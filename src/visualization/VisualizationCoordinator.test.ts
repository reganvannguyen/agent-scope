import { describe, expect, it } from 'vitest';
import type { ThreadDetail } from '../state/AppState';
import type { ProjectMap } from '../project-map/ProjectMapModels';
import { VisualizationCoordinator } from './VisualizationCoordinator';

const root: ThreadDetail = { id: 'root', title: 'Root task', preview: 'Task', cwd: 'C:/repo', status: 'idle', updatedAt: 1, turns: [], resumed: true };
const map: ProjectMap = { schemaVersion: 1, project: { name: 'Test' }, components: [{ id: 'backend', name: 'Backend', type: 'backend', paths: ['src/**'], position: { x: 1, y: 2 } }], edges: [] };

describe('visualization coordinator', () => {
  it('synchronizes root lifecycle, collaboration children, and project activity through one notification path', () => {
    const coordinator = new VisualizationCoordinator(['C:/repo'], { durationSeconds: 120, showInferred: true, maxRecentPerAgent: 5 });
    coordinator.selectRoot(root, 1); coordinator.loadProjectMap(map);
    coordinator.notification('turn/started', { threadId: 'root', turn: { id: 'turn' } }, 2);
    coordinator.notification('item/started', { threadId: 'root', turnId: 'turn', item: { id: 'spawn', type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed', senderThreadId: 'root', receiverThreadIds: ['child'], prompt: 'Inspect backend', agentsStates: {} } }, 3);
    coordinator.notification('item/started', { threadId: 'root', turnId: 'turn', item: { id: 'edit', type: 'fileChange', status: 'inProgress', changes: [{ path: 'src/api.ts' }] } }, 4);
    expect(coordinator.snapshot.agents.child).toMatchObject({ parentThreadId: 'root', delegatedTask: 'Inspect backend' });
    expect(Object.values(coordinator.snapshot.connections)[0]).toMatchObject({ componentId: 'backend', confidence: 'confirmed', state: 'current' });
    coordinator.notification('item/completed', { threadId: 'root', turnId: 'turn', item: { id: 'edit', type: 'fileChange', status: 'completed', changes: [{ path: 'src/api.ts' }] } }, 5);
    coordinator.notification('turn/completed', { threadId: 'root', turn: { id: 'turn', status: 'completed' } }, 6);
    expect(coordinator.snapshot.agents.root?.status).toBe('idle');
    expect(Object.values(coordinator.snapshot.connections)[0]?.state).toBe('recent');
  });
  it('synchronizes approvals and preserves the graph on disconnect', () => {
    const coordinator = new VisualizationCoordinator(['C:/repo'], { durationSeconds: 120, showInferred: true, maxRecentPerAgent: 5 }); coordinator.selectRoot(root);
    coordinator.approval('root', true); expect(coordinator.snapshot.agents.root?.status).toBe('waiting-approval');
    coordinator.approval('root', false); expect(coordinator.snapshot.agents.root?.status).toBe('idle');
    coordinator.disconnected(); expect(coordinator.snapshot.agents.root?.status).toBe('disconnected'); expect(coordinator.snapshot.agents.root).toBeDefined();
  });
});
