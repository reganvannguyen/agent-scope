import { describe, expect, it, vi } from 'vitest';
import { AccountService } from './AccountService';
import { CollaborationModeService } from './CollaborationModeService';
import { ModelService } from './ModelService';
import type { RpcClient } from './RpcClient';

function clientWith(responses: unknown[]): RpcClient {
  return { request: vi.fn(() => Promise.resolve(responses.shift())) as RpcClient['request'] };
}

describe('AccountService', () => {
  it('parses signed-out and signed-in states without exposing tokens', async () => {
    const signedOut = new AccountService(clientWith([{ account: null, requiresOpenaiAuth: true }]));
    await expect(signedOut.read()).resolves.toEqual({ signedIn: false, requiresOpenaiAuth: true });
    const signedIn = new AccountService(clientWith([{
      account: { type: 'chatgpt', email: 'person@example.com', planType: 'plus', accessToken: 'secret' },
      requiresOpenaiAuth: true
    }]));
    const state = await signedIn.read();
    expect(state).toEqual({ signedIn: true, type: 'chatgpt', label: 'p…@example.com', planType: 'plus', requiresOpenaiAuth: true });
    expect(JSON.stringify(state)).not.toContain('secret');
  });

  it('starts only a supported browser login URL', async () => {
    const service = new AccountService(clientWith([{ type: 'chatgpt', loginId: 'login-1', authUrl: 'https://auth.openai.com/start' }]));
    await expect(service.startChatGptLogin()).resolves.toEqual({ loginId: 'login-1', authUrl: 'https://auth.openai.com/start' });
  });
});

describe('ModelService', () => {
  const model = {
    id: 'gpt-test', displayName: 'GPT Test', description: 'Test model', isDefault: true,
    defaultReasoningEffort: 'medium', supportedReasoningEfforts: [
      { reasoningEffort: 'low', description: 'Fast' }, { reasoningEffort: 'medium', description: 'Balanced' }
    ], inputModalities: ['text'], supportsPersonality: false, upgrade: null
  };

  it('loads pagination and selects the server default', async () => {
    const service = new ModelService(clientWith([
      { data: [{ ...model, id: 'other', isDefault: false }], nextCursor: 'next' },
      { data: [model], nextCursor: null }
    ]));
    const models = await service.list();
    expect(models).toHaveLength(2);
    expect(service.select(models)).toEqual({ modelId: 'gpt-test', effort: 'medium' });
  });

  it('preserves a supported resumed selection and rejects unsupported effort', () => {
    const service = new ModelService(clientWith([]));
    const models = [{
      id: 'gpt-test', displayName: 'GPT Test', description: '', isDefault: true,
      efforts: [{ id: 'low', description: 'Fast' }], defaultEffort: 'low', inputModalities: [], supportsPersonality: false
    }];
    expect(service.select(models, 'gpt-test', 'low')).toEqual({ modelId: 'gpt-test', effort: 'low' });
    expect(service.validate(models, { modelId: 'gpt-test', effort: 'ultra' })).toBe(false);
  });

  it('handles missing modalities defensively', async () => {
    const service = new ModelService(clientWith([{ data: [{ ...model, inputModalities: undefined }], nextCursor: null }]));
    await expect(service.list()).resolves.toMatchObject([{ inputModalities: [] }]);
  });
});

describe('CollaborationModeService', () => {
  it('discovers Plan mode and filters unsupported shapes', async () => {
    const service = new CollaborationModeService(clientWith([{
      data: [{ name: 'Default', mode: 'default' }, { name: 'Plan', mode: 'plan', reasoning_effort: 'high' }, { name: 'Bad', mode: 'other' }]
    }]));
    await expect(service.list()).resolves.toEqual([
      { name: 'Default', mode: 'default' }, { name: 'Plan', mode: 'plan', reasoningEffort: 'high' }
    ]);
  });
});
