/**
 * How full an Antigravity conversation's context window is, for the app's context indicator.
 *
 * Antigravity CLI reports token usage in its ACP config updates. The runner captures
 * usage from the `usage` event emitted by AcpBackend and forwards it to the app; this
 * module resolves the window size for a reported model via the shared catalog.
 */

import { getMaxContextSize } from 'happy-wire';

export type AntigravityUsage = { usedTokens: number; windowSize: number; model?: string };

/**
 * Resolve a usage payload reported by Antigravity into the values the app expects.
 * Various token field names are accepted because ACP providers are not uniform.
 */
export function readAntigravityContextUsage(payload: unknown): AntigravityUsage | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  const usage = (data.usage && typeof data.usage === 'object' ? data.usage : data) as Record<string, unknown>;

  const usedTokens = firstNumber(usage.input_tokens, usage.inputTokens, usage.prompt_tokens, usage.context_used_tokens, usage.usedTokens);
  if (usedTokens === null || usedTokens <= 0) return null;

  const model = typeof usage.model === 'string' ? usage.model : typeof data.model === 'string' ? data.model : undefined;
  const reportedWindow = firstNumber(usage.context_window_size, usage.contextWindowSize, usage.windowSize);
  const windowSize = reportedWindow && reportedWindow > 0 ? reportedWindow : getMaxContextSize(model ?? null, 'antigravity');
  return { usedTokens, windowSize, model };
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}
