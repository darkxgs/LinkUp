import { useEffect, useState } from 'react';

import {
  extractMentionTokens,
  lookupRoomMention,
  mentionLookupKey,
  resolveMentionEntry,
  type RoomMentionEntry,
} from '@/utils/mentions';

/** يحل أسماء المنشنات غير الموجودة في فهرس الروم */
export function useRoomMentionLabels(
  text: string,
  index: Map<string, RoomMentionEntry>,
): Record<string, RoomMentionEntry> {
  const [resolved, setResolved] = useState<Record<string, RoomMentionEntry>>({});

  useEffect(() => {
    const tokens = extractMentionTokens(text.replace(/[\u2066-\u2069]/g, ''));
    if (!tokens.length) return;

    let cancelled = false;
    void (async () => {
      const updates: Record<string, RoomMentionEntry> = {};
      for (const token of tokens) {
        const key = mentionLookupKey(token);
        if (index.has(key)) continue;
        const entry = await resolveMentionEntry(token);
        if (entry) updates[key] = entry;
      }
      if (!cancelled && Object.keys(updates).length) {
        setResolved((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text, index]);

  return resolved;
}
