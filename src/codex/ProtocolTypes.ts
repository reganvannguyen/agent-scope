export type RequestId = number | string;

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface ServerNotification {
  method: string;
  params?: unknown;
}

export interface ServerRequest extends ServerNotification {
  id: RequestId;
}

export type ConnectionState = 'stopped' | 'starting' | 'initializing' | 'connected' | 'reconnecting' | 'failed';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isRequestId(value: unknown): value is RequestId {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}
