import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { initializeAppServer } from './Initialization';
import { JsonLineTransport } from './JsonLineTransport';

describe('initializeAppServer', () => {
  it('sends metadata and experimental capability before initialized', async () => {
    const output = new PassThrough();
    const messages: unknown[] = [];
    const transport = new JsonLineTransport(output);
    output.on('data', (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString()) as unknown;
      messages.push(message);
      if (messages.length === 1) transport.handleChunk('{"id":1,"result":{"userAgent":"test"}}\n');
    });
    await initializeAppServer(transport, { name: 'codex_agent_map', title: 'Codex Agent Map', version: '0.1.0' });
    expect(messages).toEqual([
      {
        method: 'initialize', id: 1,
        params: {
          clientInfo: { name: 'codex_agent_map', title: 'Codex Agent Map', version: '0.1.0' },
          capabilities: { experimentalApi: true }
        }
      },
      { method: 'initialized' }
    ]);
  });

  it('does not send initialized when initialize fails', async () => {
    const output = new PassThrough();
    const messages: unknown[] = [];
    const transport = new JsonLineTransport(output);
    output.on('data', (chunk: Buffer) => {
      messages.push(JSON.parse(chunk.toString()) as unknown);
      transport.handleChunk('{"id":1,"error":{"code":-1,"message":"denied"}}\n');
    });
    await expect(initializeAppServer(transport, { name: 'n', title: 't', version: 'v' })).rejects.toThrow('denied');
    expect(messages).toHaveLength(1);
  });
});
