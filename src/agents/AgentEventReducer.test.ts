import { describe, expect, it } from 'vitest';
import { mapAgentActivity } from './AgentActivityMapper';
import { reduceAgentEvent } from './AgentEventReducer';
import { initialRuntimeAgentState } from './AgentModels';
import { higherPriority, mapThreadStatus } from './AgentStatusMapper';

describe('runtime agent state', () => {
  it('keeps a persistent root and returns it to idle after a successful turn', () => {
    let state = reduceAgentEvent(initialRuntimeAgentState(), { type: 'rootSelected', threadId: 'root', title: 'Main Agent', cwd: 'C:/repo', at: 1 });
    state = reduceAgentEvent(state, { type: 'turnStarted', threadId: 'root', turnId: 'turn', at: 2 });
    state = reduceAgentEvent(state, { type: 'turnCompleted', threadId: 'root', outcome: 'completed', at: 3 });
    expect(state.agents.root).toMatchObject({ isRoot: true, status: 'idle', activeTurnId: null, completedAt: null });
  });

  it('adds children and grandchildren without duplicate agents or hierarchy edges', () => {
    let state = reduceAgentEvent(initialRuntimeAgentState(), { type: 'rootSelected', threadId: 'root', title: 'Main', cwd: null, at: 1 });
    state = reduceAgentEvent(state, { type: 'agentUpserted', threadId: 'child', rootThreadId: 'root', parentThreadId: 'root', displayName: 'Explorer', delegatedTask: 'Inspect', at: 2 });
    state = reduceAgentEvent(state, { type: 'agentUpserted', threadId: 'grandchild', rootThreadId: 'root', parentThreadId: 'child', displayName: 'Auditor', at: 3 });
    state = reduceAgentEvent(state, { type: 'agentUpserted', threadId: 'child', rootThreadId: 'root', parentThreadId: 'root', displayName: 'Code Explorer', role: 'explorer', at: 4 });
    expect(Object.keys(state.agents)).toHaveLength(3);
    expect(Object.keys(state.hierarchyEdges)).toHaveLength(2);
    expect(state.agents.child).toMatchObject({ displayName: 'Code Explorer', role: 'explorer', parentThreadId: 'root' });
    expect(state.agents.grandchild?.parentThreadId).toBe('child');
  });

  it('maps status flags with required priority and handles failure, interruption, and disconnect', () => {
    expect(mapThreadStatus('active', ['waitingOnApproval'], true)).toBe('waiting-approval');
    expect(mapThreadStatus('active', ['waitingOnUserInput'], true)).toBe('waiting-input');
    expect(higherPriority('failed', 'waiting-approval')).toBe('failed');
    let state = reduceAgentEvent(initialRuntimeAgentState(), { type: 'rootSelected', threadId: 'root', title: 'Main', cwd: null, at: 1 });
    state = reduceAgentEvent(state, { type: 'turnCompleted', threadId: 'root', outcome: 'interrupted', at: 2 });
    expect(state.agents.root?.status).toBe('idle');
    state = reduceAgentEvent(state, { type: 'threadStatusChanged', threadId: 'root', status: 'systemError', at: 3 });
    expect(state.agents.root?.status).toBe('failed');
    state = reduceAgentEvent(state, { type: 'disconnected', at: 4 });
    expect(state.agents.root?.status).toBe('disconnected');
  });

  it('keeps waiting agents visible and clears approval state authoritatively', () => {
    let state = reduceAgentEvent(initialRuntimeAgentState(), { type: 'rootSelected', threadId: 'root', title: 'Main', cwd: null, at: 1 });
    state = reduceAgentEvent(state, { type: 'approvalChanged', threadId: 'root', pending: true, at: 2 });
    expect(state.agents.root).toMatchObject({ status: 'waiting-approval', activeFlags: ['waitingOnApproval'] });
    state = reduceAgentEvent(state, { type: 'approvalChanged', threadId: 'root', pending: false, at: 3 });
    expect(state.agents.root).toMatchObject({ status: 'idle', activeFlags: [] });
  });

  it('maps safe activity and retains bounded history', () => {
    const activity = mapAgentActivity('root', 'turn', { id: 'cmd', type: 'commandExecution', command: 'npm test', cwd: 'C:/repo' }, 2);
    expect(activity).toMatchObject({ type: 'testing', label: 'Testing: npm test' });
    let state = reduceAgentEvent(initialRuntimeAgentState(1), { type: 'rootSelected', threadId: 'root', title: 'Main', cwd: null, at: 1 });
    if (activity === undefined) throw new Error('Expected activity');
    state = reduceAgentEvent(state, { type: 'activityStarted', activity, at: 2 });
    state = reduceAgentEvent(state, { type: 'activityCompleted', threadId: 'root', activityId: activity.id, outcome: 'completed', at: 3 });
    const second = mapAgentActivity('root', 'turn', { id: 'edit', type: 'fileChange', changes: [{ path: 'src/a.ts' }] }, 4);
    if (second === undefined) throw new Error('Expected activity');
    state = reduceAgentEvent(state, { type: 'activityStarted', activity: second, at: 4 });
    state = reduceAgentEvent(state, { type: 'activityCompleted', threadId: 'root', activityId: second.id, outcome: 'failed', at: 5 });
    expect(state.agents.root?.recentActivities).toHaveLength(1);
    expect(state.agents.root).toMatchObject({ status: 'failed', error: 'Editing 1 file' });
  });

  it('never exposes raw reasoning content in mapped activity', () => {
    const activity = mapAgentActivity('root', 'turn', { id: 'reason', type: 'reasoning', content: ['secret chain'], summary: ['safe'] }, 1);
    expect(JSON.stringify(activity)).not.toContain('secret chain');
  });
});
