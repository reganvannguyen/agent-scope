import { describe, expect, it } from 'vitest';
import { parseWebviewMessage } from './WebviewMessages';

describe('parseWebviewMessage', () => {
  it('accepts valid discriminated messages', () => {
    expect(parseWebviewMessage({ type: 'sendMessage', text: 'hi' })).toEqual({ type: 'sendMessage', text: 'hi' });
    expect(parseWebviewMessage({ type: 'resolveServerRequest', requestId: 'r1', answer: {} })).toBeDefined();
    expect(parseWebviewMessage({ type: 'setSidebarWidth', width: 320 })).toEqual({ type: 'setSidebarWidth', width: 320 });
  });
  it('rejects unknown and malformed messages', () => {
    expect(parseWebviewMessage({ type: 'sendMessage', text: 3 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'destroyEverything' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'setSidebarWidth', width: 900 })).toBeUndefined();
  });
});
