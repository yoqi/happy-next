/**
 * Antigravity Permission Handler
 *
 * Antigravity applies its own approval mode over ACP (session/set_config_option)
 * and only sends `session/request_permission` when that mode wants a human, so
 * every request it does send goes to the app. Happy's own MCP tools are the
 * exception: they only touch Happy state and are approved without asking, as are
 * the shell commands "don't ask again" covers.
 */

import { logger } from '@/ui/logger';
import type { ApiSessionClient } from '@/api/apiSession';
import type { PushNotificationClient } from '@/api/pushNotifications';
import { BasePermissionHandler, type PermissionResult } from '@/utils/BasePermissionHandler';
import { HAPPY_TOOLS_APPROVED_WITHOUT_ASKING_PREFIXED } from '@/agent/mcp/happyToolsApproved';

// Antigravity sees Happy's MCP tools with the `mcp__happy__` prefix.
export const HAPPY_TOOLS_APPROVED_WITHOUT_ASKING = HAPPY_TOOLS_APPROVED_WITHOUT_ASKING_PREFIXED;

export class AntigravityPermissionHandler extends BasePermissionHandler {
    constructor(session: ApiSessionClient, pushClient: PushNotificationClient) {
        super(session, pushClient);
    }

    protected getLogPrefix(): string {
        return '[Antigravity]';
    }

    protected getAgentName(): string {
        return 'Antigravity';
    }

    async handleToolCall(toolCallId: string, toolName: string, toolInput: Record<string, unknown>): Promise<PermissionResult> {
        if (HAPPY_TOOLS_APPROVED_WITHOUT_ASKING.includes(toolName) || this.isShellCommandAllowed(toolName, toolInput)) {
            logger.debug(`${this.getLogPrefix()} Auto-approving ${toolName} (${toolCallId})`);
            return { decision: 'approved' };
        }

        return new Promise<PermissionResult>((resolve, reject) => {
            this.pendingRequests.set(toolCallId, { resolve, reject, toolName, input: toolInput });
            this.addPendingRequestToState(toolCallId, toolName, toolInput);
            logger.debug(`${this.getLogPrefix()} Permission request sent for ${toolName} (${toolCallId})`);
        });
    }
}
