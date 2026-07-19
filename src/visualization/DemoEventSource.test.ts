import { describe, expect, it, vi } from 'vitest';
import type { VisualizationSnapshot } from './VisualizationCoordinator';
import { DemoEventSource } from './DemoEventSource';

describe('visualization demo', () => {
  it('uses the production pipeline, remains isolated, and disposes timers', () => {
    vi.useFakeTimers(); const snapshots: VisualizationSnapshot[] = []; const demo = new DemoEventSource(snapshot => { snapshots.push(snapshot); }, 100);
    demo.start(); expect(snapshots[0]?.demo).toBe(true); expect(snapshots[0]?.agents['demo-root']?.isRoot).toBe(true); expect(snapshots[0]?.projectMap?.components.map(component => component.id)).toEqual(expect.arrayContaining(['frontend', 'canvas']));
    vi.advanceTimersByTime(900);
    const latest = snapshots.at(-1); expect(Object.keys(latest?.agents ?? {})).toEqual(expect.arrayContaining(['demo-root', 'explorer', 'auditor', 'reviewer']));
    expect(Object.values(latest?.connections ?? {}).some(connection => connection.confidence === 'confirmed')).toBe(true);
    demo.dispose(); const count = snapshots.length; vi.advanceTimersByTime(1000); expect(snapshots).toHaveLength(count); vi.useRealTimers();
  });
});
