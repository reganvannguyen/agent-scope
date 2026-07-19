import type { ThreadDetail } from '../state/AppState';
import type { ProjectMap } from '../project-map/ProjectMapModels';
import { VisualizationCoordinator, type VisualizationSnapshot } from './VisualizationCoordinator';

export class DemoEventSource {
  private timer: NodeJS.Timeout | undefined; private step = 0;
  private readonly coordinator = new VisualizationCoordinator(['C:/demo'], { durationSeconds: 120, showInferred: true, maxRecentPerAgent: 5 });
  public constructor(private readonly changed: (snapshot: VisualizationSnapshot) => void, private readonly intervalMs = 900) {}
  public start(): void { this.stop(false); this.step = 0; this.coordinator.selectRoot(root, Date.now()); this.coordinator.loadProjectMap(demoMap); this.coordinator.setDemo(true); this.changed(this.coordinator.snapshot); this.timer = setInterval(() => { this.advance(); }, this.intervalMs); }
  public stop(notify = true): void { if (this.timer !== undefined) clearInterval(this.timer); this.timer = undefined; if (notify) { this.coordinator.setDemo(false); this.changed(this.coordinator.snapshot); } }
  public dispose(): void { this.stop(false); }
  private advance(): void {
    const at = Date.now(); const actions: Array<() => void> = [
      () => { this.coordinator.notification('turn/started', { threadId: 'demo-root', turn: { id: 'demo-turn' } }, at); },
      () => { this.spawn('explorer', 'Code Explorer', 'Inspect frontend and backend', at); },
      () => { this.activity('explorer', { id: 'explore', type: 'commandExecution', command: 'rg --files src frontend', cwd: 'C:/demo/frontend', status: 'inProgress' }, at); },
      () => { this.spawn('auditor', 'Test Auditor', 'Run backend tests', at); },
      () => { this.activity('auditor', { id: 'tests', type: 'commandExecution', command: 'npm test', cwd: 'C:/demo/tests', status: 'inProgress' }, at); },
      () => { this.activity('demo-root', { id: 'edit', type: 'fileChange', status: 'inProgress', changes: [{ path: 'backend/api.ts' }] }, at); },
      () => { this.spawn('reviewer', 'MCP Reviewer', 'Review Canvas integration', at); },
      () => { this.activity('reviewer', { id: 'canvas', type: 'mcpToolCall', server: 'canvas', tool: 'canvas_courses', status: 'inProgress' }, at); },
      () => { this.coordinator.approval('auditor', true, false, at); },
      () => { this.complete('demo-root', 'edit', { type: 'fileChange', changes: [{ path: 'backend/api.ts' }] }, at); this.coordinator.applyAgentEvents([{ type: 'turnCompleted', threadId: 'explorer', outcome: 'completed', at }]); },
      () => { this.coordinator.approval('auditor', false, false, at); this.coordinator.applyAgentEvents([{ type: 'turnCompleted', threadId: 'auditor', outcome: 'completed', at }, { type: 'threadStatusChanged', threadId: 'reviewer', status: 'systemError', at }]); }
    ];
    actions[this.step]?.(); this.step += 1; if (this.step >= actions.length) this.step = 0; this.changed(this.coordinator.snapshot);
  }
  private spawn(id: string, name: string, task: string, at: number): void { this.coordinator.applyAgentEvents([{ type: 'agentUpserted', threadId: id, rootThreadId: 'demo-root', parentThreadId: 'demo-root', displayName: name, delegatedTask: task, at }, { type: 'turnStarted', threadId: id, turnId: `${id}-turn`, at }]); }
  private activity(threadId: string, item: Record<string, unknown>, at: number): void { this.coordinator.notification('item/started', { threadId, turnId: `${threadId}-turn`, item }, at); }
  private complete(threadId: string, id: string, item: Record<string, unknown>, at: number): void { this.coordinator.notification('item/completed', { threadId, turnId: `${threadId}-turn`, item: { ...item, id, status: 'completed' } }, at); }
}

const root: ThreadDetail = { id: 'demo-root', title: 'Visualization Demo', preview: 'Demo', cwd: 'C:/demo', status: 'idle', updatedAt: 1, turns: [], resumed: true };
const demoMap: ProjectMap = { schemaVersion: 1, project: { name: 'Demo Project' }, components: [
  component('frontend', 'Frontend', 'frontend', 'frontend/**', 100, 80), component('backend', 'Backend', 'backend', 'backend/**', 420, 80), component('postgres', 'PostgreSQL', 'database', 'migrations/**', 740, 20), component('redis', 'Redis', 'cache', 'redis/**', 740, 150), component('mcp', 'MCP Server', 'mcp', 'mcp/**', 420, 300), { ...component('canvas', 'Canvas LMS', 'external', '', 740, 300), toolMatchers: [{ server: 'canvas' }], domainMatchers: ['*.instructure.com'] }, component('tests', 'Tests', 'tests', 'tests/**', 100, 300)
], edges: [{ id: 'front-back', source: 'frontend', target: 'backend', type: 'request' }, { id: 'back-db', source: 'backend', target: 'postgres', type: 'data' }, { id: 'back-redis', source: 'backend', target: 'redis', type: 'data' }, { id: 'back-mcp', source: 'backend', target: 'mcp', type: 'request' }, { id: 'mcp-canvas', source: 'mcp', target: 'canvas', type: 'external-api' }] };
function component(id: string, name: string, type: ProjectMap['components'][number]['type'], path: string, x: number, y: number): ProjectMap['components'][number] { return { id, name, type, paths: path === '' ? [] : [path], position: { x, y } }; }
