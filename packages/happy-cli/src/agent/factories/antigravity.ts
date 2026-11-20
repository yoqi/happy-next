/**
 * Antigravity ACP Backend - Google Antigravity CLI (`agy acp`) via ACP
 *
 * `agy acp` starts an ACP server over stdio (v1.5.0+). Credentials come from
 * `agy acp --login` / an interactive `agy` session and are cached by the CLI, so
 * one process serves a whole Happy session and a resumed session is restored with
 * `session/load`. Model and approval mode are applied over ACP before each prompt.
 */

import type { SessionNotification } from '@agentclientprotocol/sdk';
import { AcpBackend, type AcpBackendOptions, type AcpPermissionHandler } from '../acp/AcpBackend';
import type { AgentFactoryOptions, McpServerConfig } from '../core';
import { agentRegistry } from '../core';
import { DefaultTransport } from '../transport';
import { logger } from '@/ui/logger';
import { resolveAntigravityCommand } from '@/antigravity/constants';

export interface AntigravityBackendOptions extends AgentFactoryOptions {
  mcpServers?: Record<string, McpServerConfig>;
  permissionHandler?: AcpPermissionHandler;
  /** Antigravity conversation id to restore with session/load. */
  resumeSessionId?: string;
  /** Receives the history `agy` replays while loading `resumeSessionId`. */
  onReplayedUpdate?: (update: SessionNotification['update']) => void;
  /** Normalizes Happy's MCP tool names to the `mcp__happy__` form the app expects. */
  normalizeToolName?: (rawName: string) => string;
  /** agy's own full-access flag; the ACP `mode` config option alone does not disable its prompts. */
  dangerouslySkipPermissions?: boolean;
}

/** A generic transport is enough: agy reports tools with normal ACP names. */
const antigravityTransport = new DefaultTransport('antigravity');

/**
 * Create an Antigravity backend backed by `agy acp`.
 *
 * The Antigravity CLI must be installed (v1.5.0+) and signed in. Happy does not
 * pass CLI flags for model/mode; it uses ACP session config options so changes
 * apply in place without restarting the agent.
 */
export function createAntigravityBackend(options: AntigravityBackendOptions): AcpBackend {
  const command = resolveAntigravityCommand();
  logger.debug('[Antigravity] Creating ACP backend', {
    command,
    cwd: options.cwd,
    resumeSessionId: options.resumeSessionId,
    mcpServerCount: options.mcpServers ? Object.keys(options.mcpServers).length : 0,
  });

  return new AcpBackend({
    agentName: 'antigravity',
    cwd: options.cwd,
    command,
    args: options.dangerouslySkipPermissions ? ['acp', '--dangerously-skip-permissions'] : ['acp'],
    // Suppress debug chatter so it cannot pollute the ACP stdio stream.
    env: { ...options.env, NODE_ENV: 'production', DEBUG: '' },
    mcpServers: options.mcpServers,
    permissionHandler: options.permissionHandler,
    transportHandler: antigravityTransport,
    normalizeToolName: options.normalizeToolName,
    resumeSessionId: options.resumeSessionId,
    onReplayedUpdate: options.onReplayedUpdate,
    // ACP-native tool names only; no change-title instruction to auto-approve.
  } satisfies AcpBackendOptions);
}

export function registerAntigravityAgent(): void {
  agentRegistry.register('antigravity', (opts) => createAntigravityBackend(opts));
  logger.debug('[Antigravity] Registered with agent registry');
}
