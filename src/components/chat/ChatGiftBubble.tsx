/**
 * بطاقة هدية في الشات — صورة + اسم + قيمة (مثل التصميم المرجعي)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, GiftVisual } from '@/components/ui';
import { LuCoinIcon } from '@/components/icons/LuDesignIcons';
import type { Gift as GiftType } from '@/services/firebase/shop';
import type { ChatMessage } from '@/services/firebase/chat';
import { radius, spacing } from '@/theme';

export type ChatGiftMessageLike = Pick<
  ChatMessage,
  | 'id'
  | 'giftId'
  | 'giftName'
  | 'giftQuantity'
  | 'giftPrice'
  | 'imageUrl'
  | 'animationUrl'
  | 'soundUrl'
  | 'videoUrl'
> & {
  text?: string;
  giftValue?: number;
  isGroupGift?: boolean;
  recipientCount?: number;
  toName?: string;
};

type Props = {
  msg: ChatGiftMessageLike;
  gift?: GiftType | null;
  /** رسالة مرسلة مني — نص البطاقة العلوي يختلف */
  isMine?: boolean;
  /** محادثة خاصة أو شات الغرفة */
  context?: 'dm' | 'room';
};

function formatGiftValue(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return Math.round(n).toLocaleString('en-US');
}

function ChatGiftBubbleBase({ msg, gift, isMine = false, context = 'dm' }: Props) {
  const { t } = useTranslation();
  const qty = Math.max(1, msg.giftQuantity ?? 1);
  const name = (msg.giftName ?? gift?.name ?? msg.text ?? '').trim() || t('chat.messagePreviewGift');
  const unitPrice = gift?.price ?? 0;
  const totalValue =
    msg.giftPrice ??
    msg.giftValue ??
    (unitPrice > 0 ? unitPrice * qty : 0);

  const displayGift: GiftType = gift ?? {
    id: msg.giftId ?? '',
    name,
    price: unitPrice,
    category: '',
    iconName: 'Gift',
    iconColor: '#E11414',
    rarity: 'common',
    imageUrl: msg.imageUrl,
    animationUrl: msg.animationUrl,
    soundUrl: msg.soundUrl,
    videoUrl: msg.videoUrl,
  };

  const headerText = msg.isGroupGift
    ? t('room.groupGiftChat')
    : context === 'room'
      ? t('chat.giftCardTitleRoom')
      : isMine
        ? t('chat.giftCardTitleSent')
        : t('chat.giftCardTitleReceived');

  const footerName =
    qty > 1 ? `${name} ×${qty}` : name;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.thumbWrap}>
          <GiftVisual gift={displayGift} size={44} preferAnimation={false} />
        </View>
        <Text variant="bodySmall" weight="semibold" color="#1E3A5F" style={styles.headerText}>
          {headerText}
        </Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.valueRow}>
          <LuCoinIcon size={16} />
          <Text variant="bodySmall" weight="bold" color="#2563EB" style={styles.valueText}>
            {formatGiftValue(totalValue)}
          </Text>
        </View>
        <Text variant="caption" weight="semibold" color="#374151" numberOfLines={1} style={styles.nameText}>
          {footerName}
        </Text>
      </View>
      {msg.isGroupGift && msg.recipientCount ? (
        <Text variant="caption" color="#6B7280" style={styles.groupHint}>
          {msg.recipientCount} {t('room.sendToAll')}
          {msg.toName ? ` · ${msg.toName}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

export const ChatGiftBubble = React.memo(
  ChatGiftBubbleBase,
  (prev, next) =>
    prev.gift === next.gift &&
    prev.isMine === next.isMine &&
    prev.context === next.context &&
    prev.msg.id === next.msg.id &&
    prev.msg.giftQuantity === next.msg.giftQuantity &&
    prev.msg.giftName === next.msg.giftName &&
    prev.msg.giftPrice === next.msg.giftPrice &&
    prev.msg.giftValue === next.msg.giftValue &&
    prev.msg.text === next.msg.text,
);

const styles = StyleSheet.create({
  card: {
    width: 248,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: '#E8F3FC',
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerText: {
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  valueText: {
    fontSize: 13,
  },
  nameText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
  },
  groupHint: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    textAlign: 'right',
  },
});
