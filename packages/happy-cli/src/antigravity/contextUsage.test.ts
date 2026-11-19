import { describe, expect, it } from 'vitest';
import { readAntigravityContextUsage } from './contextUsage';

describe('readAntigravityContextUsage', () => {
  it('reads an ACP usage payload with a reported window', () => {
    expect(readAntigravityContextUsage({ usage: { input_tokens: 42_000, context_window_size: 1_000_000 }, model: 'gemini-3-pro' }))
      .toEqual({ usedTokens: 42_000, windowSize: 1_000_000, model: 'gemini-3-pro' });
  });

  it('accepts flat token fields and falls back to the catalog window', () => {
    const usage = readAntigravityContextUsage({ context_used_tokens: 1000, model: 'gemini-3-pro' });
    expect(usage?.usedTokens).toBe(1000);
    expect(usage?.windowSize).toBeGreaterThan(0);
  });

  it('returns null when no positive token count is present', () => {
    expect(readAntigravityContextUsage({ usage: {} })).toBeNull();
    expect(readAntigravityContextUsage(null)).toBeNull();
  });
});
