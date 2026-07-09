/**
 * مكوّنات الرد على رسالة — معاينة فوق حقل الكتابة + اقتباس داخل الفقاعة (WhatsApp-style)
 */
import React from 'react';
import { View, Pressable, StyleSheet, I18nManager } from 'react-native';
import { X } from 'lucide-react-native';

import { Text } from '@/components/ui';
import type { ChatReplySnapshot } from '@/services/firebase/chat';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';

type ReplyLabels = {
  you: string;
};

function replyAuthorName(
  replyTo: ChatReplySnapshot,
  myUid: string | undefined,
  peerName: string,
  labels: ReplyLabels,
): string {
  if (replyTo.fromUid === myUid) return labels.you;
  return peerName.trim() || '…';
}

/** شريط «الرد على…» فوق حقل الإرسال */
export function ChatReplyComposerBar({
  replyTo,
  peerName,
  myUid,
  onClose,
  labels,
}: {
  replyTo: ChatReplySnapshot;
  peerName: string;
  myUid?: string;
  onClose: () => void;
  labels: ReplyLabels & { replyingTo: string };
}) {
  const isRTL = I18nManager.isRTL;
  const author = replyAuthorName(replyTo, myUid, peerName, labels);

  return (
    <View style={[styles.composerBar, isRTL && styles.rowRtl]}>
      <View style={styles.composerAccent} />
      <View style={styles.composerBody}>
        <Text variant="caption" weight="bold" color={lu.colors.purple} numberOfLines={1}>
          {labels.replyingTo} {author}
        </Text>
        <Text variant="caption" color={lu.colors.muted} numberOfLines={2}>
          {replyTo.text}
        </Text>
      </View>
      <Pressable onPress={onClose} hitSlop={10} style={styles.composerClose}>
        <X size={18} color={lu.colors.muted} />
      </Pressable>
    </View>
  );
}

/** اقتباس الرسالة الأصلية داخل فقاعة الرد */
export function ChatReplyQuote({
  replyTo,
  peerName,
  myUid,
  isMine,
  onPress,
  labels,
}: {
  replyTo: ChatReplySnapshot;
  peerName: string;
  myUid?: string;
  isMine: boolean;
  onPress?: () => void;
  labels: ReplyLabels;
}) {
  const isRTL = I18nManager.isRTL;
  const author = replyAuthorName(replyTo, myUid, peerName, labels);
  const quoteFromPeer = replyTo.fromUid !== myUid;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.quote,
        isMine ? styles.quoteMine : styles.quoteOther,
        isRTL && styles.quoteRtl,
      ]}
    >
      <View
        style={[
          styles.quoteBar,
          { backgroundColor: quoteFromPeer ? lu.colors.purple : isMine ? '#FFFFFF' : lu.colors.purple },
          isMine && !quoteFromPeer && { backgroundColor: 'rgba(255,255,255,0.85)' },
        ]}
      />
      <View style={styles.quoteContent}>
        <Text
          variant="caption"
          weight="bold"
          numberOfLines={1}
          color={isMine ? (quoteFromPeer ? '#DCFCE7' : '#FFFFFF') : lu.colors.purple}
          style={isMine && !quoteFromPeer ? { color: '#FFFFFF' } : undefined}
        >
          {author}
        </Text>
        <Text
          variant="caption"
          numberOfLines={2}
          color={isMine ? 'rgba(255,255,255,0.82)' : lu.colors.muted}
        >
          {replyTo.text}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  composerAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: lu.colors.purple,
  },
  composerBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  composerClose: {
    padding: 4,
  },
  quote: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  quoteRtl: {
    flexDirection: 'row-reverse',
  },
  quoteMine: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  quoteOther: {
    backgroundColor: 'rgba(225, 20, 20, 0.06)',
  },
  quoteBar: {
    width: 3,
    borderRadius: 2,
    marginEnd: 8,
  },
  quoteContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
