/**
 * RoomRocketBanner — بانر صاروخ الغرفة فوق الدردشة (تصميم مدمج وعصري وهادئ)
 */
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Rocket, ChevronLeft } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { type RoomRocketLaunch, ROCKET_LEVEL_COINS } from '@/services/roomRocket';

interface Props {
  launch: RoomRocketLaunch | null;
  onPress: () => void;
}

export function RoomRocketBanner({ launch, onPress }: Props) {
  const { t } = useTranslation();
  if (!launch) return null;

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <Pressable onPress={onPress} style={styles.banner}>
        <LinearGradient
          colors={['rgba(184, 52, 52, 0.92)', 'rgba(110, 30, 30, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.bg]}
        />

        {/* أيقونة صاروخ صغيرة في حاوية دائرية */}
        <View style={styles.iconWrap}>
          <Rocket size={18} color="#fff" strokeWidth={2.2} />
        </View>

        {/* النص */}
        <View style={styles.textWrap} pointerEvents="none">
          <Text variant="caption" color="#fff" weight="bold" numberOfLines={1} style={styles.title}>
            {t('roomRocket.bannerTitle', { level: launch.level })}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.72)" numberOfLines={1} style={styles.sub}>
            {t('roomRocket.bannerFrom', {
              name: launch.senderName,
              coins: ROCKET_LEVEL_COINS[launch.level].toLocaleString(),
            })}
          </Text>
        </View>

        {/* زر العرض */}
        <View style={styles.viewBtn} pointerEvents="none">
          <Text variant="caption" color="#fff" weight="bold" style={styles.viewText}>
            {t('roomRocket.view')}
          </Text>
          <ChevronLeft size={14} color="#fff" strokeWidth={2.5} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 12,
    marginVertical: 4,
    zIndex: 50,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 140, 140, 0.35)',
  },
  bg: {
    borderRadius: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingStart: 12,
    paddingEnd: 8,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewText: {
    fontSize: 12,
  },
});
