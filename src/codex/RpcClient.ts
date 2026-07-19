export interface RpcClient {
  request<T>(method: string, params: unknown, timeoutMs?: number): Promise<T>;
}
