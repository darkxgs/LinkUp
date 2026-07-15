/**
 * RoomThroneSeat — كرسي العرش بجانب المضيف
 * كرسي ذهبي (RoomThroneIcon) تظهر صورة الشاغل داخله مع مؤشّر المايك،
 * وتحته شارة بسعر الكرسي (الحد المطلوب) — لا قيمة الدعم.
 */
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Crown, Mic } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text, CoinIcon } from '@/components/ui';
import { IMG_AVATAR } from '@/utils/imageConfig';
import { sanitizeDisplayName } from '@/utils/displayName';
import { type RoomThroneState } from '@/services/roomThrone';
import { RoomThroneIcon } from './RoomThroneIcon';

interface Props {
  throne: RoomThroneState;
  label?: string;
  /** سعر الكرسي = الحد المطلوب لتولّي العرش (minGiftCoins) */
  price?: number;
  onPress: () => void;
}

const CHAIR_W = 60;
const CHAIR_H = Math.round((CHAIR_W * 72) / 64); // نسبة viewBox للكرسي
const AVATAR = 30;

function formatThronePrice(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en-US');
}

export function RoomThroneSeat({ throne, label, price, onPress }: Props) {
  const occupied = Boolean(throne.occupantUid);

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      {label ? (
        <View style={styles.labelWrap}>
          <Text variant="caption" color="#FFD700" weight="bold" style={styles.label}>
            {label}
          </Text>
        </View>
      ) : null}

      <View style={styles.chairBox}>
        {/* تاج فوق الكرسي */}
        <View style={styles.crownIcon}>
          <Crown size={16} color="#FFD700" fill="#FFD700" strokeWidth={0} />
        </View>

        {/* كرسي العرش (SVG ذهبي) */}
        <RoomThroneIcon size={CHAIR_W} />

        {/* صورة الشاغل داخل ظهر الكرسي + مؤشّر المايك */}
        <View style={styles.avatarSlot}>
          {occupied && throne.occupantAvatar?.trim() ? (
            <Image
              source={{ uri: throne.occupantAvatar.trim() }}
              style={styles.avatar}
              contentFit="cover"
              recyclingKey={throne.occupantAvatar.trim()}
              {...IMG_AVATAR}
            />
          ) : occupied ? (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text variant="caption" color="#fff" weight="bold">
                {throne.occupantName?.charAt(0) ?? '?'}
              </Text>
            </View>
          ) : (
            <View style={styles.avatarEmpty}>
              <Crown size={16} color="rgba(255,215,0,0.55)" strokeWidth={2} />
            </View>
          )}

          {occupied ? (
            <View style={styles.micDot}>
              <Mic size={7} color="#fff" strokeWidth={2.6} />
            </View>
          ) : null}
        </View>
      </View>

      {occupied ? (
        <Text variant="caption" color="#FFF" numberOfLines={1} style={styles.name}>
          {sanitizeDisplayName(throne.occupantName)}
        </Text>
      ) : null}

      {/* شارة سعر الكرسي (الحد المطلوب) */}
      {typeof price === 'number' && price > 0 ? (
        <View style={styles.priceChip}>
          <LinearGradient
            colors={['#FDE68A', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 9 }]}
          />
          <CoinIcon size={11} style={styles.coinIcon} />
          <Text variant="caption" weight="bold" color="#3B1D00" style={styles.priceText}>
            {formatThronePrice(price)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: 64,
    marginBottom: 4,
  },
  labelWrap: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    marginBottom: 6,
  },
  label: {
    fontSize: 9,
    textShadowColor: 'rgba(255,215,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  chairBox: {
    width: CHAIR_W,
    height: CHAIR_H,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  crownIcon: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    zIndex: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },
  // الأفاتار يجلس داخل ظهر الكرسي (المنطقة البنفسجية العليا)
  avatarSlot: {
    position: 'absolute',
    top: Math.round(CHAIR_H * 0.2),
    alignSelf: 'center',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'visible',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(27, 8, 8, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarEmpty: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  micDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(27, 8, 8, 0.92)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  name: {
    fontSize: 10,
    marginTop: 5,
    maxWidth: 72,
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // شارة السعر — نفس شكل الكوينات الذهبي في الصورة
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    height: 17,
    minWidth: 30,
    paddingHorizontal: 6,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  coinIcon: {
    marginRight: 3,
  },
  priceText: {
    fontSize: 9,
    lineHeight: 11,
  },
});
