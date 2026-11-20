/**
 * Antigravity proxy environment persistence.
 *
 * The Antigravity CLI (`agy`) is a Go program that only reads proxy settings
 * from HTTP(S)_PROXY environment variables. A terminal `happy antigravity`
 * inherits the user's exported proxy, but sessions spawned later by the daemon
 * (new session / model switch from the app) start from the daemon's environment,
 * which usually has no proxy. That is why some requests go through the proxy
 * and others connect directly and get a 400 "location not supported".
 *
 * This module persists the proxy variables seen in a terminal-launched
 * antigravity session and restores them into every antigravity process, so all
 * antigravity requests use the same proxy. It is only used by antigravity code
 * paths; other agents are untouched.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';

/** Proxy variables `agy` (Go http.ProxyFromEnvironment) understands. */
const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'] as const;

type ProxyEnv = Partial<Record<(typeof PROXY_ENV_KEYS)[number], string>>;

/** File holding the proxy env, next to other CLI state, readable only by the user. */
const proxyEnvFile = () => join(configuration.happyHomeDir, 'antigravity-proxy.json');

/**
 * Read proxy variables from an environment object. Uppercase keys are canonical
 * for `agy`; lowercase variants are accepted as a fallback and normalized up.
 */
function readProxyEnv(env: NodeJS.ProcessEnv): ProxyEnv {
    const result: ProxyEnv = {};
    for (const key of PROXY_ENV_KEYS) {
        const upper = env[key]?.trim();
        const lower = env[key.toLowerCase()]?.trim();
        const value = upper || lower;
        if (value) result[key] = value;
    }
    return result;
}

/**
 * Persist the current process proxy env. Called only by a terminal-launched
 * antigravity session so later daemon-spawned sessions can inherit it. An empty
 * proxy env is ignored so a stray run without exports never clears a good one.
 */
export function persistAntigravityProxyEnv(): void {
    try {
        const proxyEnv = readProxyEnv(process.env);
        if (Object.keys(proxyEnv).length === 0) return;
        const file = proxyEnvFile();
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(proxyEnv, null, 2), { encoding: 'utf8', mode: 0o600 });
        logger.debug('[Antigravity] Persisted proxy env', Object.keys(proxyEnv));
    } catch (error) {
        logger.debug('[Antigravity] Failed to persist proxy env', error);
    }
}

/**
 * Load the persisted proxy env. Returns an empty object when absent or invalid.
 */
export function loadAntigravityProxyEnv(): ProxyEnv {
    try {
        const file = proxyEnvFile();
        if (!existsSync(file)) return {};
        const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
        if (!parsed || typeof parsed !== 'object') return {};
        const result: ProxyEnv = {};
        for (const key of PROXY_ENV_KEYS) {
            const value = (parsed as Record<string, unknown>)[key];
            if (typeof value === 'string' && value.trim()) result[key] = value.trim();
        }
        return result;
    } catch (error) {
        logger.debug('[Antigravity] Failed to load proxy env', error);
        return {};
    }
}

/**
 * Restore the persisted proxy env into the current antigravity process. Values
 * already present in the process environment win, so an explicit export in the
 * launching shell always takes precedence over a stale persisted value.
 */
export function restoreAntigravityProxyEnv(): void {
    const persisted = loadAntigravityProxyEnv();
    for (const [key, value] of Object.entries(persisted)) {
        if (value && !process.env[key] && !process.env[key.toLowerCase()]) {
            process.env[key] = value;
        }
    }
}

/**
 * Proxy env to hand to the `agy` child process on top of the process env.
 * Merges the persisted values with the current process so both terminal and
 * daemon-spawned sessions end up with the same proxy settings.
 */
export function getAntigravityProxyEnv(): ProxyEnv {
    return { ...loadAntigravityProxyEnv(), ...readProxyEnv(process.env) };
}
