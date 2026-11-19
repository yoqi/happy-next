import { useState, useEffect } from 'react';
import { machineBash } from '@/sync/ops';

interface CLIAvailability {
    claude: boolean | null; // null = unknown/loading, true = installed, false = not installed
    codex: boolean | null;
    gemini: boolean | null;
    qoder: boolean | null;
    antigravity: boolean | null;
    isDetecting: boolean; // Explicit loading state
    timestamp: number; // When detection completed
    error?: string; // Detection error message (for debugging)
}

type AgentCLI = 'claude' | 'codex' | 'gemini' | 'qoder' | 'antigravity';

const CLI_DETECTION_COMMAND =
    '(command -v claude >/dev/null 2>&1 && echo "claude:true" || echo "claude:false") && ' +
    '(command -v codex >/dev/null 2>&1 && echo "codex:true" || echo "codex:false") && ' +
    '(command -v gemini >/dev/null 2>&1 && echo "gemini:true" || echo "gemini:false") && ' +
    // Qoder's installer puts qodercli (or the China build qoderclicn) in ~/.local/bin, which the daemon's PATH may lack
    '((command -v qodercli || command -v qoderclicn || test -x ~/.local/bin/qodercli || test -x ~/.local/bin/qoderclicn) >/dev/null 2>&1 && echo "qoder:true" || echo "qoder:false") && ' +
    // Antigravity CLI (`agy`) is also installed into ~/.local/bin by its installer.
    '((command -v agy || test -x ~/.local/bin/agy) >/dev/null 2>&1 && echo "antigravity:true" || echo "antigravity:false")';

function parseCLIOutput(stdout: string): CLIAvailability {
    const lines = stdout.trim().split('\n');
    const cliStatus: Partial<Record<AgentCLI, boolean>> = {};

    lines.forEach(line => {
        const [cli, status] = line.split(':');
        if (cli && status) {
            cliStatus[cli.trim() as AgentCLI] = status.trim() === 'true';
        }
    });

    return {
        claude: cliStatus.claude ?? null,
        codex: cliStatus.codex ?? null,
        gemini: cliStatus.gemini ?? null,
        qoder: cliStatus.qoder ?? null,
        antigravity: cliStatus.antigravity ?? null,
        isDetecting: false,
        timestamp: Date.now(),
    };
}

function undetectedAvailability(isDetecting: boolean, error?: string): CLIAvailability {
    return {
        claude: null,
        codex: null,
        gemini: null,
        qoder: null,
        antigravity: null,
        isDetecting,
        timestamp: 0,
        ...(error ? { error } : {}),
    };
}

/**
 * Detects which CLI tools (claude, codex, gemini, qoder, antigravity) are installed on a remote machine.
 *
 * NON-BLOCKING: Detection runs asynchronously in useEffect. UI shows all profiles
 * while detection is in progress, then updates when results arrive.
 *
 * Detection is automatic when machineId changes. Uses existing machineBash() RPC
 * to run `command -v` checks on the remote machine.
 *
 * CONSERVATIVE FALLBACK: If detection fails (network error, timeout, bash error),
 * sets all CLIs to null and timestamp to 0, hiding status from UI.
 * User discovers CLI availability when attempting to spawn.
 *
 * @param machineId - The machine to detect CLIs on (null = no detection)
 * @returns CLI availability status for the supported agents
 */
export function useCLIDetection(machineId: string | null): CLIAvailability {
    const [availability, setAvailability] = useState<CLIAvailability>(() => undetectedAvailability(false));

    useEffect(() => {
        if (!machineId) {
            setAvailability(undetectedAvailability(false));
            return;
        }

        let cancelled = false;

        const detectCLIs = async () => {
            // Set detecting flag (non-blocking - UI stays responsive)
            setAvailability(prev => ({ ...prev, isDetecting: true }));
            console.log('[useCLIDetection] Starting detection for machineId:', machineId);

            try {
                const result = await machineBash(machineId, CLI_DETECTION_COMMAND, '/');

                if (cancelled) return;
                console.log('[useCLIDetection] Result:', { success: result.success, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });

                if (result.success && result.exitCode === 0) {
                    setAvailability(parseCLIOutput(result.stdout));
                } else {
                    console.log('[useCLIDetection] Detection failed (success=false or exitCode!=0):', result);
                    setAvailability(undetectedAvailability(false, `Detection failed: ${result.stderr || 'Unknown error'}`));
                }
            } catch (error) {
                if (cancelled) return;
                console.log('[useCLIDetection] Network/RPC error:', error);
                setAvailability(undetectedAvailability(false, error instanceof Error ? error.message : 'Detection error'));
            }
        };

        detectCLIs();

        // Cleanup: Cancel detection if component unmounts or machineId changes
        return () => {
            cancelled = true;
        };
    }, [machineId]);

    return availability;
}

/**
 * Detects CLI availability for multiple machines in parallel.
 * Only runs detection on online machines. Results are keyed by machineId.
 *
 * @param machineIds - Array of machine IDs to detect CLIs on (only online ones)
 * @returns Map of machineId → CLIAvailability
 */
export function useCLIDetectionBatch(machineIds: string[]): Record<string, CLIAvailability> {
    const [availabilityMap, setAvailabilityMap] = useState<Record<string, CLIAvailability>>({});

    // Stabilize the dependency — machineIds is a new array ref each render
    const machineIdsKey = machineIds.slice().sort().join(',');

    useEffect(() => {
        const ids = machineIdsKey ? machineIdsKey.split(',') : [];
        if (ids.length === 0) {
            setAvailabilityMap({});
            return;
        }

        let cancelled = false;

        // Mark all as detecting synchronously
        const detecting: Record<string, CLIAvailability> = {};
        for (const id of ids) {
            detecting[id] = undetectedAvailability(true);
        }
        setAvailabilityMap(detecting);

        // Detect each machine independently (not awaiting Promise.all)
        for (const machineId of ids) {
            machineBash(machineId, CLI_DETECTION_COMMAND, '/').then(result => {
                if (cancelled) return;
                if (result.success && result.exitCode === 0) {
                    setAvailabilityMap(prev => ({ ...prev, [machineId]: parseCLIOutput(result.stdout) }));
                } else {
                    setAvailabilityMap(prev => ({
                        ...prev,
                        [machineId]: undetectedAvailability(false),
                    }));
                }
            }).catch(() => {
                if (cancelled) return;
                setAvailabilityMap(prev => ({
                    ...prev,
                    [machineId]: undetectedAvailability(false),
                }));
            });
        }

        return () => { cancelled = true; };
    }, [machineIdsKey]);

    return availabilityMap;
}
