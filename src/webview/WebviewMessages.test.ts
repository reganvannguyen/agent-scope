import { describe, expect, it } from 'vitest';
import { parseWebviewMessage } from './WebviewMessages';

describe('parseWebviewMessage', () => {
  it('accepts valid discriminated messages', () => {
    expect(parseWebviewMessage({ type: 'sendMessage', text: 'hi' })).toEqual({ type: 'sendMessage', text: 'hi' });
    expect(parseWebviewMessage({ type: 'resolveServerRequest', requestId: 'r1', answer: {} })).toBeDefined();
    expect(parseWebviewMessage({ type: 'setSidebarWidth', width: 320 })).toEqual({ type: 'setSidebarWidth', width: 320 });
    expect(parseWebviewMessage({ type: 'setComposerHeight', height: 180 })).toEqual({ type: 'setComposerHeight', height: 180 });
  });
  it('rejects unknown and malformed messages', () => {
    expect(parseWebviewMessage({ type: 'sendMessage', text: 3 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'destroyEverything' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'setSidebarWidth', width: 900 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'setComposerHeight', height: 20 })).toBeUndefined();
  });
  it('validates visualization view and entity selections', () => {
    expect(parseWebviewMessage({ type: 'selectViewMode', mode: 'agents' })).toEqual({ type: 'selectViewMode', mode: 'agents' });
    expect(parseWebviewMessage({ type: 'selectGraphEntity', kind: 'agent', id: 'thread-1' })).toEqual({ type: 'selectGraphEntity', kind: 'agent', id: 'thread-1' });
    expect(parseWebviewMessage({ type: 'selectViewMode', mode: 'unknown' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'selectGraphEntity', kind: 'component', id: '' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'saveProjectMap', map: { schemaVersion: 1 } })).toBeDefined();
    expect(parseWebviewMessage({ type: 'saveProjectMap', map: 'unsafe' })).toBeUndefined();
  });
});
