import { isRecord } from './ProtocolTypes';
import type { RpcClient } from './RpcClient';

export interface ReasoningOption { id: string; description: string; }
export interface ModelOption {
  id: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  efforts: ReasoningOption[];
  defaultEffort: string;
  inputModalities: string[];
  supportsPersonality: boolean;
  upgrade?: string;
}

export interface ModelSelection { modelId: string; effort: string; }

export class ModelService {
  public constructor(private readonly client: RpcClient) {}

  public async list(): Promise<ModelOption[]> {
    const models: ModelOption[] = [];
    let cursor: string | null = null;
    do {
      const raw: unknown = await this.client.request<unknown>('model/list', { cursor, includeHidden: false });
      if (!isRecord(raw) || !Array.isArray(raw.data) || (raw.nextCursor !== null && typeof raw.nextCursor !== 'string')) {
        throw new Error('Invalid model/list response');
      }
      for (const entry of raw.data) {
        const model = parseModel(entry);
        if (model !== undefined) models.push(model);
      }
      cursor = raw.nextCursor;
    } while (cursor !== null);
    return models;
  }

  public select(models: ModelOption[], preferredModel?: string, preferredEffort?: string): ModelSelection | undefined {
    const model = models.find(item => item.id === preferredModel) ?? models.find(item => item.isDefault) ?? models[0];
    if (model === undefined) return undefined;
    const effort = preferredEffort !== undefined && model.efforts.some(item => item.id === preferredEffort)
      ? preferredEffort
      : model.defaultEffort;
    return { modelId: model.id, effort };
  }

  public validate(models: ModelOption[], selection: ModelSelection): boolean {
    const model = models.find(item => item.id === selection.modelId);
    return model !== undefined && model.efforts.some(item => item.id === selection.effort);
  }
}

function parseModel(value: unknown): ModelOption | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.displayName !== 'string' ||
      typeof value.description !== 'string' || typeof value.isDefault !== 'boolean' ||
      typeof value.defaultReasoningEffort !== 'string' || !Array.isArray(value.supportedReasoningEfforts)) return undefined;
  const efforts = value.supportedReasoningEfforts.flatMap(entry => {
    if (!isRecord(entry) || typeof entry.reasoningEffort !== 'string' || typeof entry.description !== 'string') return [];
    return [{ id: entry.reasoningEffort, description: entry.description }];
  });
  if (efforts.length === 0) efforts.push({ id: value.defaultReasoningEffort, description: value.defaultReasoningEffort });
  const model: ModelOption = {
    id: value.id,
    displayName: value.displayName,
    description: value.description,
    isDefault: value.isDefault,
    efforts,
    defaultEffort: value.defaultReasoningEffort,
    inputModalities: Array.isArray(value.inputModalities) ? value.inputModalities.filter(item => typeof item === 'string') : [],
    supportsPersonality: value.supportsPersonality === true
  };
  if (typeof value.upgrade === 'string') model.upgrade = value.upgrade;
  return model;
}
