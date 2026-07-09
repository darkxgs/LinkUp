/**
 * نص رسالة شات الروم — منشن باسم الشخص وقابل للضغط لفتح الملف
 */
import React, { useMemo } from 'react';
import {
  Text as RNText,
  StyleSheet,
  I18nManager,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { useRoomMentionLabels } from '@/hooks/useRoomMentionLabels';
import {
  ROOM_MENTION_DISPLAY_REGEX,
  lookupRoomMention,
  normalizeMentionToken,
  type RoomMentionEntry,
} from '@/utils/mentions';

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; token: string };

function splitMentionSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  const re = new RegExp(ROOM_MENTION_DISPLAY_REGEX.source, 'g');
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) {
      segments.push({ kind: 'text', value: text.slice(last, start) });
    }
    const token = normalizeMentionToken(match[1] ?? match[0]);
    if (token) segments.push({ kind: 'mention', token });
    last = start + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: 'text', value: text.slice(last) });
  }
  return segments.length ? segments : [{ kind: 'text', value: text }];
}

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  mentionIndex?: Map<string, RoomMentionEntry>;
  onMentionPress?: (uid: string) => void;
};

export const RoomChatMessageText = React.memo(function RoomChatMessageText({
  text,
  style,
  mentionIndex,
  onMentionPress,
}: Props) {
  const segments = useMemo(() => splitMentionSegments(text), [text]);
  const index = mentionIndex ?? EMPTY_INDEX;
  const resolved = useRoomMentionLabels(text, index);
  const rtl = I18nManager.isRTL;

  return (
    <RNText
      style={[
        style,
        {
          textAlign: rtl ? 'right' : 'left',
          writingDirection: rtl ? 'rtl' : 'ltr',
        },
      ]}
    >
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return (
            <RNText key={`t-${i}`} style={style}>
              {seg.value}
            </RNText>
          );
        }

        const entry = lookupRoomMention(seg.token, index, resolved);
        const label = entry?.name ?? `@${seg.token}`;
        const uid = entry?.uid;

        return (
          <RNText
            key={`m-${i}-${seg.token}`}
            style={[style, styles.mention, uid ? styles.mentionTappable : null]}
            suppressHighlighting={false}
            onPress={
              uid && onMentionPress
                ? () => onMentionPress(uid)
                : undefined
            }
          >
            @{label.replace(/^@/, '')}
          </RNText>
        );
      })}
    </RNText>
  );
});

const EMPTY_INDEX = new Map<string, RoomMentionEntry>();

const styles = StyleSheet.create({
  mention: {
    color: '#FFD86F',
    fontWeight: '700',
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  mentionTappable: {
    textDecorationLine: 'underline',
  },
});
