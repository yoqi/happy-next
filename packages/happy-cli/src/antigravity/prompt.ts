/**
 * Antigravity first-turn prompt
 *
 * ACP takes one prompt string, so Happy's session guidance rides along with the
 * first user message. It goes after the message and is wrapped in a tag so a
 * resumed session can strip it out of replayed history before showing it.
 */

const INSTRUCTIONS_TAG = 'happy-session-instructions';
const INSTRUCTIONS_BLOCK = new RegExp(`\\s*<${INSTRUCTIONS_TAG}>[\\s\\S]*?</${INSTRUCTIONS_TAG}>\\s*$`);

export function buildAntigravityFirstTurnPrompt(opts: {
  userMessage: string;
  appendSystemPrompt?: string | null;
  firstTurnInstruction?: string | null;
}): string {
  const guidance = [opts.appendSystemPrompt, opts.firstTurnInstruction]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n\n');
  return guidance ? `${opts.userMessage}\n\n<${INSTRUCTIONS_TAG}>\n${guidance}\n</${INSTRUCTIONS_TAG}>` : opts.userMessage;
}

export function stripAntigravitySessionInstructions(text: string): string {
  return text.replace(INSTRUCTIONS_BLOCK, '');
}
