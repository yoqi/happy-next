import { describe, expect, it, vi } from 'vitest';
import type { AcpBackendOptions } from '../acp/AcpBackend';

const mocks = vi.hoisted(() => ({ createBackend: vi.fn() }));
vi.mock('../acp/AcpBackend', () => ({
  AcpBackend: class {
    constructor(public options: AcpBackendOptions) { mocks.createBackend(options); }
  },
}));
vi.mock('@/ui/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }));
vi.mock('@/antigravity/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/antigravity/constants')>()),
  resolveAntigravityCommand: () => '/opt/antigravity/agy',
}));
import { createAntigravityBackend } from './antigravity';

describe('createAntigravityBackend', () => {
  it('runs agy in ACP mode with debug output suppressed and the resume session passed on', () => {
    const onReplayedUpdate = vi.fn();
    const normalizeToolName = (name: string) => `mcp__happy__${name}`;
    createAntigravityBackend({ cwd: '/work', env: { KEEP: '1' }, resumeSessionId: 'abc', onReplayedUpdate, normalizeToolName });

    expect(mocks.createBackend).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'antigravity',
      cwd: '/work',
      command: '/opt/antigravity/agy',
      args: ['acp'],
      env: expect.objectContaining({ NODE_ENV: 'production', DEBUG: '', KEEP: '1' }),
      resumeSessionId: 'abc',
      onReplayedUpdate,
      normalizeToolName,
    }));
  });

  it('passes --dangerously-skip-permissions for full access', () => {
    createAntigravityBackend({ cwd: '/work', dangerouslySkipPermissions: true });

    expect(mocks.createBackend).toHaveBeenCalledWith(expect.objectContaining({
      command: '/opt/antigravity/agy',
      args: ['acp', '--dangerously-skip-permissions'],
    }));
  });
});
