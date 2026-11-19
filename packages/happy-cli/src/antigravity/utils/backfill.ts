/**
 * Antigravity Session Backfill
 *
 * ACP `session/load` replays a restored conversation as session updates. The
 * runner collects them while loading and this turns the user prompts and the text
 * each turn ended on into a message batch, so a resumed or copied session shows
 * its history in the app.
 */

import type { SessionNotification } from '@agentclientprotocol/sdk';
import { userPromptText } from 'happy-wire';
import { stripAntigravitySessionInstructions } from '@/antigravity/prompt';
import { selectBackfillTurns, withForkedHistoryNotices } from '@/modules/common/backfillTurns';

type BackfillMessage = { content: unknown; localId: string };

export function buildAntigravityBackfillMessages(updates: SessionNotification['update'][], sessionId: string, maxTurns = 20): BackfillMessage[] {
  const entries: { role: 'user' | 'agent'; text: string; index: number }[] = [];
  let continues = false;
  for (const update of updates) {
    if (update.sessionUpdate === 'tool_call') {
      continues = false;
      continue;
    }
    if (update.sessionUpdate !== 'user_message_chunk' && update.sessionUpdate !== 'agent_message_chunk') continue;
    if (update.content.type !== 'text') continue;
    const role = update.sessionUpdate === 'user_message_chunk' ? 'user' : 'agent';
    const last = entries[entries.length - 1];
    if (continues && last?.role === role) {
      last.text += update.content.text;
    } else {
      entries.push({ role, text: update.content.text, index: entries.length });
    }
    continues = true;
  }

  const texts = entries.flatMap((entry) => {
    const text = entry.role === 'user' ? userPromptText(stripAntigravitySessionInstructions(entry.text)) : entry.text;
    return text?.trim() ? [{ ...entry, text }] : [];
  });
  const { selected, omittedTurns } = selectBackfillTurns(texts, (entry) => entry.role === 'agent' ? 'reply' : 'prompt', maxTurns);
  const localIdPrefix = `antigravity-log:${sessionId}:`;
  return withForkedHistoryNotices(localIdPrefix, omittedTurns, selected.map((entry) => ({
    localId: `${localIdPrefix}${entry.index}`,
    content: entry.role === 'user'
      ? { role: 'user', content: { type: 'text', text: entry.text }, meta: { sentFrom: 'cli' } }
      : { role: 'agent', content: { type: 'acp', provider: 'antigravity', data: { type: 'message', message: entry.text } }, meta: { sentFrom: 'cli' } },
  })));
}
