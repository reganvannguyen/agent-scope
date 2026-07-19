import { EventEmitter } from 'node:events';
import type { AppState } from './AppState';

export class AppStateStore extends EventEmitter {
  public constructor(private state: AppState) { super(); }

  public get snapshot(): Readonly<AppState> { return this.state; }

  public update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('changed', this.state);
  }
}
