import { describe, expect, it } from 'vitest';
import { emptyState, type State, type Visualization } from '../types';
import { graphElements } from './GraphModels';

function state(visualization: Visualization): State { return { ...emptyState, visualization }; }
function agent(threadId: string, parentThreadId: string | null, isRoot: boolean) { return { threadId, parentThreadId, displayName: threadId, role: null, delegatedTask: null, status: 'idle', currentActivity: null, recentActivities: [], activeSince: null, completedAt: null, error: null, isRoot, cwd: null, model: null }; }

describe('graph layout', () => {
  it('places root, child, and grandchild at increasing hierarchy depth without sibling overlap', () => {
    const visualization: Visualization = { agents: { root: agent('root', null, true), child: agent('child', 'root', false), sibling: agent('sibling', 'root', false), grandchild: agent('grandchild', 'child', false) }, hierarchyEdges: {
      one: { id: 'one', parentThreadId: 'root', childThreadId: 'child' }, two: { id: 'two', parentThreadId: 'root', childThreadId: 'sibling' }, three: { id: 'three', parentThreadId: 'child', childThreadId: 'grandchild' }
    }, connections: {}, componentRuntime: {}, demo: false };
    const nodes = graphElements(state(visualization), 'agents').nodes;
    const position = (id: string) => nodes.find(node => node.id === `agent:${id}`)?.position;
    expect(position('root')?.y).toBeLessThan(position('child')?.y ?? 0);
    expect(position('child')?.y).toBeLessThan(position('grandchild')?.y ?? 0);
    expect(position('child')?.x).not.toBe(position('sibling')?.x);
  });
  it('preserves saved project positions when agents or components are added', () => {
    const visualization: Visualization = { agents: { root: agent('root', null, true) }, hierarchyEdges: {}, projectMap: { project: { name: 'Test' }, components: [{ id: 'api', name: 'API', type: 'backend', paths: [], position: { x: 100, y: 200 } }], edges: [] }, connections: {}, componentRuntime: { api: { activeAgentIds: [], activeActivityTypes: [], recentlyTouchedFiles: [], pendingApprovalCount: 0 } }, demo: false };
    const before = graphElements(state(visualization), 'combined').nodes.find(node => node.id === 'component:api')?.position;
    visualization.agents.child = agent('child', 'root', false); visualization.projectMap?.components.push({ id: 'db', name: 'DB', type: 'database', paths: [], position: { x: 400, y: 200 } }); visualization.componentRuntime.db = { activeAgentIds: [], activeActivityTypes: [], recentlyTouchedFiles: [], pendingApprovalCount: 0 };
    const after = graphElements(state(visualization), 'combined').nodes.find(node => node.id === 'component:api')?.position;
    expect(after).toEqual(before);
  });
});
