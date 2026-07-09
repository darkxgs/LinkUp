/**
 * بطاقة سجل مكالمة في المحادثة — أسلوب واتساب
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import type { ChatMessage } from '@/services/firebase/chat';
import { radius, spacing } from '@/theme';

type Props = {
  msg: ChatMessage;
  isMine: boolean;
  onPress?: () => void;
};

function formatCallDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function ChatCallBubbleBase({ msg, isMine, onPress }: Props) {
  const { t } = useTranslation();
  const isVideo = msg.callType === 'video';
  const status = msg.callStatus ?? 'missed';
  const isOutgoing = isMine;
  const duration = msg.callDurationSeconds ?? 0;

  const { title, accent, Icon } = useMemo(() => {
    const missedLike = status === 'missed' || status === 'declined';

    if (status === 'completed') {
      return {
        title: isOutgoing
          ? isVideo
            ? t('chat.callOutgoingVideo')
            : t('chat.callOutgoingVoice')
          : isVideo
            ? t('chat.callIncomingVideo')
            : t('chat.callIncomingVoice'),
        accent: isOutgoing ? '#16A34A' : '#0F766E',
        Icon: isOutgoing ? PhoneOutgoing : PhoneIncoming,
      };
    }

    if (isOutgoing) {
      return {
        title: status === 'declined'
          ? isVideo
            ? t('chat.callDeclinedOutgoingVideo')
            : t('chat.callDeclinedOutgoingVoice')
          : isVideo
            ? t('chat.callNoAnswerVideo')
            : t('chat.callNoAnswerVoice'),
        accent: '#6B7280',
        Icon: PhoneOutgoing,
      };
    }

    return {
      title: missedLike
        ? isVideo
          ? t('chat.callMissedVideo')
          : t('chat.callMissedVoice')
        : isVideo
          ? t('chat.callIncomingVideo')
          : t('chat.callIncomingVoice'),
      accent: '#DC2626',
      Icon: PhoneMissed,
    };
  }, [isOutgoing, isVideo, status, t]);

  const MediaIcon = isVideo ? Video : Phone;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        isOutgoing ? styles.cardOutgoing : styles.cardIncoming,
        pressed && onPress ? { opacity: 0.92 } : null,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${accent}18` }]}>
        <Icon size={18} color={accent} strokeWidth={2.2} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <MediaIcon size={14} color={accent} strokeWidth={2} />
          <Text variant="bodySmall" weight="semibold" style={{ color: accent, flex: 1 }}>
            {title}
          </Text>
        </View>
        {status === 'completed' && duration > 0 ? (
          <Text variant="caption" color="#6B7280" style={styles.duration}>
            {formatCallDuration(duration)}
          </Text>
        ) : onPress ? (
          <Text variant="caption" color="#9CA3AF" style={styles.duration}>
            {t('chat.tapToCallAgain')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const ChatCallBubble = React.memo(
  ChatCallBubbleBase,
  (prev, next) =>
    prev.isMine === next.isMine &&
    prev.msg.id === next.msg.id &&
    prev.msg.callStatus === next.msg.callStatus &&
    prev.msg.callDurationSeconds === next.msg.callDurationSeconds &&
    prev.msg.callType === next.msg.callType,
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 210,
    maxWidth: 280,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  cardOutgoing: {
    backgroundColor: '#F0FDF4',
  },
  cardIncoming: {
    backgroundColor: '#FFFFFF',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  duration: {
    textAlign: 'right',
    marginTop: 2,
  },
});
