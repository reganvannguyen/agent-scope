import { EventEmitter } from 'node:events';
import type { OutputChannel } from 'vscode';
import { AppServerProcess, type ProcessExit } from './AppServerProcess';
import { detectCodexExecutable } from './CodexExecutable';
import { JsonLineTransport } from './JsonLineTransport';
import { initializeAppServer } from './Initialization';
import type { ConnectionState, ServerRequest } from './ProtocolTypes';

export class AppServerClient extends EventEmitter {
  private state: ConnectionState = 'stopped';
  private transport: JsonLineTransport | undefined;
  private stopping = false;

  public constructor(
    private readonly process: AppServerProcess,
    private readonly output: OutputChannel,
    private readonly version: string,
    private readonly debugLogging = false
  ) {
    super();
  }

  public get connectionState(): ConnectionState { return this.state; }

  public async connect(executable: string, cwd?: string): Promise<void> {
    if (this.state !== 'stopped' && this.state !== 'failed') return;
    this.stopping = false;
    this.setState('starting');
    const info = await detectCodexExecutable(executable);
    this.output.appendLine(`Using ${info.version}`);
    const child = this.process.start(executable, cwd);
    const transport = new JsonLineTransport(child.stdin);
    this.transport = transport;
    transport.setHandlers({
      notification: event => { this.emit('notification', event); },
      serverRequest: request => { this.emit('serverRequest', request); },
      malformed: (_line, error) => { this.output.appendLine(`Malformed App Server message: ${error.message}`); },
      unknown: () => { if (this.debugLogging) this.output.appendLine('Ignored unknown App Server message shape'); }
    });
    this.process.on('stdout', this.onStdout);
    this.process.on('stderr', this.onStderr);
    this.process.on('exit', this.onExit);
    this.process.on('processError', this.onProcessError);
    this.setState('initializing');
    try {
      await initializeAppServer(transport, {
        name: 'codex_agent_map', title: 'Codex Agent Map', version: this.version
      });
      this.setState('connected');
    } catch (error) {
      this.setState('failed');
      await this.disconnect();
      throw error;
    }
  }

  public request<T>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    if (this.state !== 'connected' || this.transport === undefined) {
      return Promise.reject(new Error(`App Server is not initialized (${this.state})`));
    }
    return this.transport.request<T>(method, params, timeoutMs);
  }

  public respond(request: ServerRequest, result: unknown): void {
    if (this.transport === undefined) throw new Error('App Server is not connected');
    this.transport.respond(request.id, result);
  }

  public async disconnect(): Promise<void> {
    this.stopping = true;
    this.transport?.dispose();
    this.transport = undefined;
    this.removeProcessListeners();
    await this.process.stop();
    this.setState('stopped');
  }

  private readonly onStdout = (chunk: Buffer): void => this.transport?.handleChunk(chunk);
  private readonly onStderr = (chunk: Buffer): void => {
    const message = chunk.toString().trim();
    if (message !== '') this.output.appendLine(`[app-server] ${message}`);
  };
  private readonly onExit = (exit: ProcessExit): void => {
    this.transport?.rejectAll(new Error(`App Server exited with code ${String(exit.code)}`));
    if (!this.stopping) {
      this.output.appendLine(`App Server exited unexpectedly (code ${String(exit.code)})`);
      this.setState('failed');
      this.emit('disconnected', exit);
    }
  };
  private readonly onProcessError = (error: Error): void => {
    this.output.appendLine(`App Server process error: ${error.message}`);
  };

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit('state', state);
  }

  private removeProcessListeners(): void {
    this.process.off('stdout', this.onStdout);
    this.process.off('stderr', this.onStderr);
    this.process.off('exit', this.onExit);
    this.process.off('processError', this.onProcessError);
  }
}
