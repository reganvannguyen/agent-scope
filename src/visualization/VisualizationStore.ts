import { EventEmitter } from 'node:events';
import type { VisualizationState } from './VisualizationState';

export class VisualizationStore extends EventEmitter {
  private timer: NodeJS.Timeout | undefined;
  public constructor(private state: VisualizationState, private readonly batchMs = 40) { super(); }
  public get snapshot(): Readonly<VisualizationState> { return this.state; }
  public update(state: VisualizationState, immediate = false): void { this.state = state; if (immediate) { this.flush(); return; } if (this.timer === undefined) this.timer = setTimeout(() => { this.flush(); }, this.batchMs); }
  public dispose(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; this.removeAllListeners(); }
  private flush(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; this.emit('changed', this.state); }
}
