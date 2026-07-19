import { isRecord } from './ProtocolTypes';
import type { RpcClient } from './RpcClient';

export interface CollaborationModeOption {
  name: string;
  mode: 'default' | 'plan';
  model?: string;
  reasoningEffort?: string;
}

export class CollaborationModeService {
  public constructor(private readonly client: RpcClient) {}

  public async list(): Promise<CollaborationModeOption[]> {
    const raw = await this.client.request<unknown>('collaborationMode/list', {});
    if (!isRecord(raw) || !Array.isArray(raw.data)) throw new Error('Invalid collaborationMode/list response');
    return raw.data.flatMap(value => {
      if (!isRecord(value) || typeof value.name !== 'string' || (value.mode !== 'default' && value.mode !== 'plan')) return [];
      const option: CollaborationModeOption = { name: value.name, mode: value.mode };
      if (typeof value.model === 'string') option.model = value.model;
      if (typeof value.reasoning_effort === 'string') option.reasoningEffort = value.reasoning_effort;
      return [option];
    });
  }
}
