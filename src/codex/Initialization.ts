import type { JsonLineTransport } from './JsonLineTransport';

export interface ClientIdentity {
  name: string;
  title: string;
  version: string;
}

export async function initializeAppServer(transport: JsonLineTransport, clientInfo: ClientIdentity): Promise<void> {
  await transport.request('initialize', {
    clientInfo,
    capabilities: { experimentalApi: true }
  });
  transport.notify('initialized');
}
