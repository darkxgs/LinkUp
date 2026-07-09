/**
 * LuckyBagFloatingBadge — أيقونة حقيبة الحظ العائمة في الروم (للجميع بما فيهم صاحب الوكالة)
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import {
  type LuckyBag,
  getBagOpenCountdownSecondsLeft,
  getBagSecondsLeft,
  isBagOpenUnlocked,
} from '@/services/luckyBag';
import { lu } from '@/theme/lu-brand';

type Props = {
  bags: LuckyBag[];
  onPress: (bagId: string) => void;
  /** المسافة من أعلى الشاشة — تُمرَّر من الروم لتظهر الأيقونة فوق بعيداً عن المايكات */
  topOffset?: number;
  variant?: 'floating' | 'inline';
};

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function LuckyBagFloatingBadge({
  bags,
  onPress,
  topOffset = 100,
  variant = 'floating',
}: Props) {
  const { t } = useTranslation();
  const pulse = React.useRef(new Animated.Value(1)).current;
  const [tick, setTick] = useState(0);

  const activeBag = bags.find(
    (b) => b.status === 'active' && b.remainingSlots > 0 && getBagSecondsLeft(b) > 0,
  );

  useEffect(() => {
    if (!activeBag) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeBag?.id]);

  useEffect(() => {
    if (!activeBag) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [activeBag?.id, pulse]);

  if (!activeBag) return null;

  const inline = variant === 'inline';
  void tick;
  const openLeft = getBagOpenCountdownSecondsLeft(activeBag);
  const unlocked = isBagOpenUnlocked(activeBag);
  const timerStr = formatTimer(unlocked ? getBagSecondsLeft(activeBag) : openLeft);

  return (
    <Pressable
      onPress={() => onPress(activeBag.id)}
      style={[styles.wrap, inline ? styles.wrapInline : { top: topOffset }]}
      hitSlop={8}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <LinearGradient
          colors={[lu.colors.gold, lu.colors.pink]}
          style={[styles.circle, inline && styles.circleInline]}
        >
          <Gift size={inline ? 18 : 22} color="#fff" strokeWidth={2.4} />
        </LinearGradient>
      </Animated.View>
      <View style={[styles.timerPill, inline && styles.timerPillInline]}>
        <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: inline ? 8 : 9 }}>
          {timerStr}
        </Text>
      </View>
      {!inline ? (
        <Text variant="caption" weight="bold" color="#fff" style={styles.label} numberOfLines={1}>
          {t('luckyBag.roomBadge')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    zIndex: 40,
    alignItems: 'center',
    width: 56,
  },
  wrapInline: {
    position: 'relative',
    right: 0,
    zIndex: 0,
    width: 40,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: lu.colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  circleInline: {
    width: 34,
    height: 34,
    borderRadius: 17,
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  timerPill: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  timerPillInline: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  label: {
    fontSize: 9,
    marginTop: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
