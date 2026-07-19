import type { Writable } from 'node:stream';
import { isRecord, isRequestId, type RequestId, type RpcError, type ServerNotification, type ServerRequest } from './ProtocolTypes';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

export interface TransportHandlers {
  notification: (notification: ServerNotification) => void;
  serverRequest: (request: ServerRequest) => void;
  malformed: (line: string, error: Error) => void;
  unknown: (message: unknown) => void;
}

const defaultHandlers: TransportHandlers = {
  notification: () => undefined,
  serverRequest: () => undefined,
  malformed: () => undefined,
  unknown: () => undefined
};

export class RpcResponseError extends Error {
  public constructor(public readonly rpcError: RpcError) {
    super(rpcError.message);
    this.name = 'RpcResponseError';
  }
}

export class JsonLineTransport {
  private buffer = '';
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private handlers: TransportHandlers = defaultHandlers;

  public constructor(private readonly output: Writable) {}

  public setHandlers(handlers: Partial<TransportHandlers>): void {
    this.handlers = { ...defaultHandlers, ...handlers };
  }

  public handleChunk(chunk: Buffer | string): void {
    this.buffer += chunk.toString();
    const lines = this.buffer.split(/\r?\n/u);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.handleLine(line);
  }

  public request<T>(method: string, params: unknown, timeoutMs = 30_000): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: value => { resolve(value as T); },
        reject,
        timer
      });
      try {
        this.write({ method, id, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error('Failed to write request'));
      }
    });
  }

  public notify(method: string, params?: unknown): void {
    this.write(params === undefined ? { method } : { method, params });
  }

  public respond(id: RequestId, result: unknown): void {
    this.write({ id, result });
  }

  public respondError(id: RequestId, error: RpcError): void {
    this.write({ id, error });
  }

  public rejectAll(reason: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
  }

  public dispose(): void {
    this.rejectAll(new Error('Transport disposed'));
    this.buffer = '';
  }

  private handleLine(line: string): void {
    if (line.trim() === '') return;
    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch (error) {
      this.handlers.malformed(line, error instanceof Error ? error : new Error('Malformed JSON'));
      return;
    }
    if (!isRecord(message)) {
      this.handlers.unknown(message);
      return;
    }
    const id = message.id;
    if (typeof id === 'number' && this.pending.has(id) && !('method' in message)) {
      const pending = this.pending.get(id);
      if (pending === undefined) return;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      const error = parseRpcError(message.error);
      if (error !== undefined) pending.reject(new RpcResponseError(error));
      else if ('result' in message) pending.resolve(message.result);
      else pending.reject(new Error(`Invalid response for request ${String(id)}`));
      return;
    }
    if (typeof message.method === 'string' && isRequestId(id)) {
      this.handlers.serverRequest({ method: message.method, id, params: message.params });
      return;
    }
    if (typeof message.method === 'string' && id === undefined) {
      this.handlers.notification({ method: message.method, params: message.params });
      return;
    }
    this.handlers.unknown(message);
  }

  private write(message: unknown): void {
    if (!this.output.writable) throw new Error('App Server input is not writable');
    this.output.write(`${JSON.stringify(message)}\n`);
  }
}

function parseRpcError(value: unknown): RpcError | undefined {
  if (!isRecord(value) || typeof value.code !== 'number' || typeof value.message !== 'string') return undefined;
  return value.data === undefined
    ? { code: value.code, message: value.message }
    : { code: value.code, message: value.message, data: value.data };
}
