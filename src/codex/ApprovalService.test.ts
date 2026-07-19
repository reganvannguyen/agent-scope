import { describe, expect, it, vi } from 'vitest';
import { ApprovalService } from './ApprovalService';

function request(method: string, params: Record<string, unknown>, id: number | string = 7) {
  return { id, method, params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'item-1', ...params } };
}

describe('ApprovalService', () => {
  it('registers command approval, validates listed decisions, and preserves the original ID', () => {
    const respond = vi.fn();
    const service = new ApprovalService(respond);
    service.register(request('item/commandExecution/requestApproval', { availableDecisions: ['accept', 'decline'] }, 'approval-1'));
    expect(() => { service.resolve('approval-1', { decision: 'acceptForSession' }); }).toThrow('not allowed');
    service.resolve('approval-1', { decision: 'accept' });
    expect(respond).toHaveBeenCalledWith('approval-1', { decision: 'accept' });
    expect(() => { service.resolve('approval-1', { decision: 'decline' }); }).toThrow('already resolving');
    service.markResolved('approval-1');
    expect(service.requests).toHaveLength(0);
  });

  it('supports only valid file decisions', () => {
    const respond = vi.fn();
    const service = new ApprovalService(respond);
    service.register(request('item/fileChange/requestApproval', {}));
    expect(() => { service.resolve(7, { decision: 'always' }); }).toThrow('Invalid');
    service.resolve(7, { decision: 'decline' });
    expect(respond).toHaveBeenCalledWith(7, { decision: 'decline' });
  });

  it('allows only a subset of requested permissions', () => {
    const respond = vi.fn();
    const service = new ApprovalService(respond);
    service.register(request('item/permissions/requestApproval', {
      permissions: { network: { enabled: true, domains: ['example.com'] }, fileSystem: null }
    }));
    expect(() => { service.resolve(7, { permissions: { network: { enabled: true, domains: ['evil.com'] } }, scope: 'turn' }); }).toThrow('exceed');
    service.resolve(7, { permissions: { network: { domains: ['example.com'] } }, scope: 'turn' });
    expect(respond).toHaveBeenCalledOnce();
  });

  it('validates tool user input against server questions', () => {
    const respond = vi.fn();
    const service = new ApprovalService(respond);
    service.register(request('item/tool/requestUserInput', { questions: [{
      id: 'choice', question: 'Choose', header: 'Choice', isOther: false, options: [{ label: 'A' }, { label: 'B' }]
    }] }));
    expect(() => { service.resolve(7, { answers: { choice: { answers: ['C'] } } }); }).toThrow('Unsupported');
    service.resolve(7, { answers: { choice: { answers: ['A'] } } });
    expect(respond).toHaveBeenCalledWith(7, { answers: { choice: { answers: ['A'] } } });
  });

  it('clears stale requests when a turn completes and rejects unknown methods', () => {
    const service = new ApprovalService(vi.fn());
    service.register(request('item/fileChange/requestApproval', {}, 1));
    service.clearTurn('thread-1', 'turn-1');
    expect(service.requests).toHaveLength(0);
    expect(() => service.register(request('unknown/request', {}, 2))).toThrow('Unsupported server request');
  });
});
