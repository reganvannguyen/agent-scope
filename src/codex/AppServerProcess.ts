import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export class AppServerProcess extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | undefined;

  public get running(): boolean { return this.child !== undefined; }
  public get stdin(): NodeJS.WritableStream | undefined { return this.child?.stdin; }

  public start(executable: string, cwd?: string): ChildProcessWithoutNullStreams {
    if (this.child !== undefined) throw new Error('Codex App Server is already running');
    const child = spawn(executable, ['app-server'], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child = child;
    child.stdout.on('data', (chunk: Buffer) => this.emit('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => this.emit('stderr', chunk));
    child.once('error', error => this.emit('processError', error));
    child.once('exit', (code, signal) => {
      if (this.child === child) this.child = undefined;
      this.emit('exit', { code, signal } satisfies ProcessExit);
    });
    return child;
  }

  public async stop(graceMs = 1_500): Promise<void> {
    const child = this.child;
    if (child === undefined) return;
    this.child = undefined;
    child.stdin.end();
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        resolve();
      }, graceMs);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
}
