import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpHome } = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  return { tmpHome: mkdtempSync(join(tmpdir(), 'agy-proxy-')) };
});

vi.mock('@/configuration', () => ({
  configuration: { happyHomeDir: tmpHome },
}));
vi.mock('@/ui/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }));

import {
  getAntigravityProxyEnv,
  loadAntigravityProxyEnv,
  persistAntigravityProxyEnv,
  restoreAntigravityProxyEnv,
} from './proxyEnv';

const PROXY_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'];

describe('antigravity proxyEnv', () => {
  const saved: Record<string, string | undefined> = {};
  let previous: NodeJS.ProcessEnv;

  beforeEach(() => {
    previous = process.env;
    for (const key of PROXY_KEYS) {
      saved[key] = process.env[key];
      saved[key.toLowerCase()] = process.env[key.toLowerCase()];
      delete process.env[key];
      delete process.env[key.toLowerCase()];
    }
  });

  afterEach(() => {
    process.env = previous;
    const file = join(tmpHome, 'antigravity-proxy.json');
    try { rmSync(file); } catch { /* already absent */ }
  });

  it('persists exported proxy variables and ignores an empty env', () => {
    process.env.HTTP_PROXY = 'http://proxy.test:7890';
    process.env.HTTPS_PROXY = 'http://proxy.test:7890';
    persistAntigravityProxyEnv();
    expect(loadAntigravityProxyEnv()).toEqual({
      HTTP_PROXY: 'http://proxy.test:7890',
      HTTPS_PROXY: 'http://proxy.test:7890',
    });

    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    persistAntigravityProxyEnv();
    expect(loadAntigravityProxyEnv()).toEqual({
      HTTP_PROXY: 'http://proxy.test:7890',
      HTTPS_PROXY: 'http://proxy.test:7890',
    });
  });

  it('normalizes lowercase exports and restores them into the process', () => {
    process.env.http_proxy = 'http://lower.test:7890';
    persistAntigravityProxyEnv();
    expect(loadAntigravityProxyEnv()).toEqual({ HTTP_PROXY: 'http://lower.test:7890' });

    delete process.env.http_proxy;
    restoreAntigravityProxyEnv();
    expect(process.env.HTTP_PROXY).toBe('http://lower.test:7890');
  });

  it('restores persisted proxy for daemon-spawned processes without overriding explicit exports', () => {
    process.env.HTTP_PROXY = 'http://daemon-shell.test:7890';
    persistAntigravityProxyEnv();

    delete process.env.HTTP_PROXY;
    process.env.HTTP_PROXY = 'http://explicit.test:7890';
    restoreAntigravityProxyEnv();
    expect(process.env.HTTP_PROXY).toBe('http://explicit.test:7890');
  });

  it('merges persisted and current env for the agy child with current winning', () => {
    process.env.HTTPS_PROXY = 'http://persisted.test:7890';
    persistAntigravityProxyEnv();
    process.env.HTTPS_PROXY = 'http://current.test:7890';
    expect(getAntigravityProxyEnv().HTTPS_PROXY).toBe('http://current.test:7890');
  });
});
