/**
 * إشعار هدية عائم — يظهر على طرف الشاشة (صورة + مرسل + مستلم)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { Text, GiftVisual } from '@/components/ui';
import type { Gift as GiftType } from '@/services/firebase/shop';
import { getDefaultAvatar } from '@/constants/defaultAvatars';
import { lu } from '@/theme/lu-brand';

export type RoomGiftNoticePillProps = {
  senderName: string;
  gift: GiftType;
  recipientName?: string;
  recipientUid?: string;
  recipientAvatar?: string;
  quantity?: number;
  isGroupGift?: boolean;
  recipientCount?: number;
};

function RoomGiftNoticePillBase({
  senderName,
  gift,
  recipientName,
  recipientUid,
  recipientAvatar,
  quantity = 1,
  isGroupGift = false,
  recipientCount,
}: RoomGiftNoticePillProps) {
  const { t } = useTranslation();
  const giftName = (gift.name ?? '').trim() || t('chat.messagePreviewGift');
  const qtyPrefix = quantity > 1 ? `×${quantity} ` : '';
  const recipientLabel = isGroupGift
    ? recipientCount && recipientCount > 0
      ? `${t('room.sendToAll')} (${recipientCount})`
      : t('room.sendToAll')
    : (recipientName ?? '').trim();

  const avatarUri =
    recipientAvatar?.trim() ||
    (recipientUid ? getDefaultAvatar('male', recipientUid) : undefined);

  const detailLine = isGroupGift
    ? t('room.groupGiftChatDetail', { count: quantity, gift: giftName })
    : recipientLabel
      ? t('room.giftChatTo', { gift: `${qtyPrefix}${giftName}`, name: recipientLabel })
      : t('room.giftChatSent', { gift: `${qtyPrefix}${giftName}` });

  return (
    <View style={styles.pill}>
      <View style={styles.giftThumb}>
        <GiftVisual gift={gift} size={34} preferAnimation={false} />
      </View>

      <Text style={styles.plus}>+</Text>

      <View style={styles.textCol}>
        <Text variant="caption" weight="bold" color="#fff" numberOfLines={1} style={styles.senderLine}>
          {senderName}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.88)" numberOfLines={2} style={styles.detailLine}>
          {detailLine}
        </Text>
      </View>

      {avatarUri && !isGroupGift ? (
        <Image
          source={{ uri: avatarUri }}
          style={styles.recipientAvatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={recipientUid ?? avatarUri}
        />
      ) : isGroupGift ? (
        <View style={styles.groupBadge}>
          <Text variant="caption" weight="bold" color="#fff" style={styles.groupBadgeText}>
            {recipientCount && recipientCount > 0 ? recipientCount : '∞'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const RoomGiftNoticePill = React.memo(
  RoomGiftNoticePillBase,
  (prev, next) =>
    prev.senderName === next.senderName &&
    prev.gift === next.gift &&
    prev.recipientName === next.recipientName &&
    prev.recipientUid === next.recipientUid &&
    prev.recipientAvatar === next.recipientAvatar &&
    prev.quantity === next.quantity &&
    prev.isGroupGift === next.isGroupGift &&
    prev.recipientCount === next.recipientCount,
);

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingStart: 6,
    paddingEnd: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderTopStartRadius: 6,
    borderBottomStartRadius: 6,
    backgroundColor: 'rgba(6, 6, 10, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: 280,
    minHeight: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  giftThumb: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plus: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    alignItems: 'flex-start',
  },
  senderLine: {
    fontSize: 11,
    lineHeight: 15,
  },
  detailLine: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  recipientAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: lu.colors.purpleDark,
  },
  groupBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(225, 20, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  groupBadgeText: {
    fontSize: 10,
    includeFontPadding: false,
  },
});
