import { describe, expect, it } from 'vitest';
import { sanitizeLogLine } from './SanitizedLog';

describe('sanitizeLogLine', () => {
  it('strips ANSI and control characters', () => {
    expect(sanitizeLogLine('\u001b[33mWARN\u001b[0m\u0007 message')).toBe('WARN message');
  });
  it('redacts secret-looking values', () => {
    expect(sanitizeLogLine('Bearer abc.def.ghi access_token=private sk-abcdefghijkl')).toBe('[REDACTED] [REDACTED] [REDACTED]');
  });
});
