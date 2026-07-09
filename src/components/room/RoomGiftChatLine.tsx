/**
 * سطر هدية داخل شات الروم — بنفس تنسيق الرسائل النصية (مدمج ومرتب)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, GiftVisual } from '@/components/ui';
import type { Gift as GiftType } from '@/services/firebase/shop';
import { lu } from '@/theme/lu-brand';

export type RoomGiftChatLineProps = {
  gift: GiftType;
  recipientName?: string;
  quantity?: number;
  isGroupGift?: boolean;
  recipientCount?: number;
};

function RoomGiftChatLineBase({
  gift,
  recipientName,
  quantity = 1,
  isGroupGift = false,
  recipientCount,
}: RoomGiftChatLineProps) {
  const { t } = useTranslation();
  const giftName = (gift.name ?? '').trim() || t('chat.messagePreviewGift');

  const lineText = isGroupGift
    ? t('room.groupGiftChatDetail', { count: quantity, gift: giftName })
    : recipientName?.trim()
      ? t('room.giftChatTo', { gift: giftName, name: recipientName.trim() })
      : t('room.giftChatSent', { gift: giftName });

  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        <View style={styles.thumb}>
          <GiftVisual gift={gift} size={28} preferAnimation={false} />
        </View>
        {quantity > 1 ? (
          <View style={styles.countBadge}>
            <Text variant="caption" weight="bold" color="#FCD34D" style={styles.countText}>
              ×{quantity}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" color="rgba(255,255,255,0.92)" numberOfLines={2} style={styles.text}>
        {lineText}
      </Text>
    </View>
  );
}

export const RoomGiftChatLine = React.memo(
  RoomGiftChatLineBase,
  (prev, next) =>
    prev.gift === next.gift &&
    prev.recipientName === next.recipientName &&
    prev.quantity === next.quantity &&
    prev.isGroupGift === next.isGroupGift &&
    prev.recipientCount === next.recipientCount,
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  thumbWrap: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  countBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 18,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 9,
    lineHeight: 11,
    fontFamily: lu.fonts.body,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: lu.fonts.body,
  },
});
