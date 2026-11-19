/**
 * Antigravity Constants
 *
 * Google Antigravity CLI (`agy`) signs in interactively and caches its credentials.
 * It speaks ACP through `agy acp` (v1.5.0+); login for headless/editor use is
 * `agy acp --login`. There is no API key environment variable to resolve.
 */

import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

/** Overrides which Antigravity executable Happy spawns. */
export const ANTIGRAVITY_PATH_ENV = 'HAPPY_ANTIGRAVITY_PATH';

/** Set by the daemon to restore an Antigravity conversation through ACP `session/load`. */
export const ANTIGRAVITY_RESUME_SESSION_ID_ENV = 'HAPPY_ANTIGRAVITY_RESUME_SESSION_ID';

const ANTIGRAVITY_COMMAND = 'agy';

/** Text `agy` emits (stderr or JSON-RPC error) when it has no credentials. */
const ANTIGRAVITY_AUTH_ERROR_MARKERS = ['Not logged in', 'not authenticated', 'Authentication required', 'agy acp --login'];

/**
 * Executable to spawn: `HAPPY_ANTIGRAVITY_PATH`, else `agy` on PATH or in
 * ~/.local/bin (the official installer's default), else the bare name so the
 * spawn error names it.
 */
export function resolveAntigravityCommand(env: NodeJS.ProcessEnv = process.env): string {
  const override = env[ANTIGRAVITY_PATH_ENV]?.trim();
  if (override) return override;

  const searchDirs = [
    ...(env.PATH ?? '').split(delimiter).filter(Boolean),
    join(env.HOME?.trim() || homedir(), '.local', 'bin'),
  ];
  const dir = searchDirs.find((candidateDir) => existsSync(join(candidateDir, ANTIGRAVITY_COMMAND)));
  return dir ? join(dir, ANTIGRAVITY_COMMAND) : ANTIGRAVITY_COMMAND;
}

export function isAntigravityAuthError(text: string): boolean {
  return ANTIGRAVITY_AUTH_ERROR_MARKERS.some((marker) => text.toLowerCase().includes(marker.toLowerCase()));
}

export function antigravityAuthErrorMessage(command: string): string {
  return `Antigravity CLI is not signed in. Run \`${command} acp --login\` in a terminal, then start the session again.`;
}
