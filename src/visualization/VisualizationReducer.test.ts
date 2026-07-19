import { describe, expect, it, vi } from 'vitest';
import { initialRuntimeAgentState } from '../agents/AgentModels';
import type { ComponentMatch } from '../project-map/ActivityMatchingModels';
import type { ProjectMap } from '../project-map/ProjectMapModels';
import { reduceVisualization, type TrailSettings } from './VisualizationReducer';
import { initialVisualizationState } from './VisualizationState';
import { VisualizationStore } from './VisualizationStore';

const settings: TrailSettings = { durationSeconds: 2, showInferred: true, maxRecentPerAgent: 2 };
const map: ProjectMap = { schemaVersion: 1, project: { name: 'Test' }, components: [{ id: 'backend', name: 'Backend', type: 'backend', paths: [], position: { x: 1, y: 1 } }], edges: [] };
const confirmed: ComponentMatch = { componentId: 'backend', confidence: 'confirmed', activityType: 'editing', primary: true, evidence: [{ type: 'file-change', path: 'src/a.ts' }] };

describe('visualization reducer', () => {
  it('creates, updates, and deduplicates a current connection', () => {
    let state = reduceVisualization(initialVisualizationState(initialRuntimeAgentState()), { type: 'projectMapLoaded', map }, settings);
    state = reduceVisualization(state, { type: 'activityMatched', agentThreadId: 'root', matches: [confirmed], at: 1 }, settings);
    state = reduceVisualization(state, { type: 'activityMatched', agentThreadId: 'root', matches: [confirmed], at: 2 }, settings);
    expect(Object.values(state.connections)).toHaveLength(1);
    expect(Object.values(state.connections)[0]).toMatchObject({ state: 'current', confidence: 'confirmed', lastSeenAt: 2 });
    expect(state.componentRuntime.backend).toMatchObject({ activeAgentIds: ['root'], activeActivityTypes: ['editing'] });
  });
  it('converts current to recent, expires it, and reactivates it', () => {
    let state = reduceVisualization(initialVisualizationState(initialRuntimeAgentState()), { type: 'activityMatched', agentThreadId: 'root', matches: [confirmed], at: 1 }, settings);
    state = reduceVisualization(state, { type: 'activityEnded', agentThreadId: 'root', outcome: 'completed', files: ['src/a.ts'], at: 2 }, settings);
    expect(Object.values(state.connections)[0]).toMatchObject({ state: 'recent', expiresAt: 2002 });
    state = reduceVisualization(state, { type: 'activityMatched', agentThreadId: 'root', matches: [confirmed], at: 3 }, settings);
    expect(Object.values(state.connections)[0]).toMatchObject({ state: 'current', expiresAt: null });
    state = reduceVisualization(state, { type: 'activityEnded', agentThreadId: 'root', outcome: 'completed', at: 4 }, settings);
    state = reduceVisualization(state, { type: 'expire', at: 2005 }, settings);
    expect(state.connections).toEqual({});
  });
  it('tracks completed, failed, declined, files, and approvals in component runtime', () => {
    let state = reduceVisualization(initialVisualizationState(initialRuntimeAgentState()), { type: 'projectMapLoaded', map }, settings);
    for (const outcome of ['completed', 'failed', 'declined'] as const) {
      state = reduceVisualization(state, { type: 'activityMatched', agentThreadId: 'root', matches: [confirmed], at: 1 }, settings);
      state = reduceVisualization(state, { type: 'activityEnded', agentThreadId: 'root', outcome, files: [`${outcome}.ts`], at: 2 }, settings);
    }
    state = reduceVisualization(state, { type: 'approvalChanged', componentId: 'backend', delta: 1, at: 3 }, settings);
    expect(state.componentRuntime.backend).toMatchObject({ completedChangeCount: 1, failedChangeCount: 1, declinedChangeCount: 1, pendingApprovalCount: 1 });
    expect(state.componentRuntime.backend?.recentlyTouchedFiles).toHaveLength(3);
  });
  it('obeys inferred visibility, zero trail duration, and recent limits', () => {
    const inferred: ComponentMatch = { ...confirmed, componentId: 'one', confidence: 'inferred' };
    let state = reduceVisualization(initialVisualizationState(initialRuntimeAgentState()), { type: 'activityMatched', agentThreadId: 'root', matches: [inferred], at: 1 }, { ...settings, showInferred: false });
    expect(state.connections).toEqual({});
    state = reduceVisualization(state, { type: 'activityMatched', agentThreadId: 'root', matches: [{ ...confirmed, componentId: 'one' }, { ...confirmed, componentId: 'two' }], at: 2 }, settings);
    state = reduceVisualization(state, { type: 'activityEnded', agentThreadId: 'root', outcome: 'completed', at: 3 }, { ...settings, durationSeconds: 0, maxRecentPerAgent: 1 });
    expect(Object.values(state.connections)).toHaveLength(1);
  });
});

describe('batched visualization store', () => {
  it('batches high-frequency updates and supports immediate state transitions', () => {
    vi.useFakeTimers(); const state = initialVisualizationState(initialRuntimeAgentState()); const store = new VisualizationStore(state, 40); const changed = vi.fn(); store.on('changed', changed);
    store.update({ ...state, unmappedActivityCount: 1 }); store.update({ ...state, unmappedActivityCount: 2 });
    expect(changed).not.toHaveBeenCalled(); vi.advanceTimersByTime(40); expect(changed).toHaveBeenCalledTimes(1);
    store.update(state, true); expect(changed).toHaveBeenCalledTimes(2); store.dispose(); vi.useRealTimers();
  });
});
