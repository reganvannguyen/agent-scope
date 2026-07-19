import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { JsonLineTransport, RpcResponseError } from './JsonLineTransport';

function setup(): { transport: JsonLineTransport; output: PassThrough; written: string[] } {
  const output = new PassThrough();
  const written: string[] = [];
  output.on('data', (chunk: Buffer) => { written.push(chunk.toString()); });
  return { transport: new JsonLineTransport(output), output, written };
}

describe('JsonLineTransport', () => {
  it('parses one notification', () => {
    const { transport } = setup();
    const notification = vi.fn();
    transport.setHandlers({ notification });
    transport.handleChunk('{"method":"thread/started","params":{"id":"t1"}}\n');
    expect(notification).toHaveBeenCalledWith({ method: 'thread/started', params: { id: 't1' } });
  });

  it('parses multiple messages, ignores blanks, and buffers partial lines', () => {
    const { transport } = setup();
    const notification = vi.fn();
    transport.setHandlers({ notification });
    transport.handleChunk('\n{"method":"a"}\n{"method":"b"');
    expect(notification).toHaveBeenCalledTimes(1);
    transport.handleChunk('}\r\n');
    expect(notification.mock.calls).toEqual([[{ method: 'a', params: undefined }], [{ method: 'b', params: undefined }]]);
  });

  it('reports malformed JSON and continues', () => {
    const { transport } = setup();
    const malformed = vi.fn();
    const notification = vi.fn();
    transport.setHandlers({ malformed, notification });
    transport.handleChunk('{bad}\n{"method":"ok"}\n');
    expect(malformed).toHaveBeenCalledOnce();
    expect(notification).toHaveBeenCalledOnce();
  });

  it('resolves matching request IDs', async () => {
    const { transport, written } = setup();
    const pending = transport.request<{ ok: boolean }>('test', {});
    expect(JSON.parse(written[0] ?? '')).toEqual({ method: 'test', id: 1, params: {} });
    transport.handleChunk('{"id":1,"result":{"ok":true}}\n');
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('rejects response errors', async () => {
    const { transport } = setup();
    const pending = transport.request('test', {});
    transport.handleChunk('{"id":1,"error":{"code":-1,"message":"failed"}}\n');
    await expect(pending).rejects.toBeInstanceOf(RpcResponseError);
  });

  it('times out unresolved requests', async () => {
    vi.useFakeTimers();
    const { transport } = setup();
    const pending = transport.request('slow', {}, 10);
    const assertion = expect(pending).rejects.toThrow('Request timed out: slow');
    await vi.advanceTimersByTimeAsync(11);
    await assertion;
    vi.useRealTimers();
  });

  it('rejects all pending requests on exit', async () => {
    const { transport } = setup();
    const pending = transport.request('pending', {});
    transport.rejectAll(new Error('process exited'));
    await expect(pending).rejects.toThrow('process exited');
  });

  it('routes server requests and preserves their IDs', () => {
    const { transport } = setup();
    const serverRequest = vi.fn();
    transport.setHandlers({ serverRequest });
    transport.handleChunk('{"id":"approval-7","method":"item/commandExecution/requestApproval","params":{"command":"npm test"}}\n');
    expect(serverRequest).toHaveBeenCalledWith({
      id: 'approval-7', method: 'item/commandExecution/requestApproval', params: { command: 'npm test' }
    });
  });
});
