/**
 * RoomRocketFloatingBadge — أيقونة عائمة لصاروخ الغرفة
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { RocketIcon } from '@/components/ui/GameIcons';
import { type RoomRocketLaunch } from '@/services/roomRocket';

interface Props {
  launch: RoomRocketLaunch | null;
  onPress: () => void;
  /** المسافة من أعلى الشاشة — يُمرَّر من الروم (تحت الهيدر) */
  topOffset?: number;
  variant?: 'floating' | 'inline';
}

export function RoomRocketFloatingBadge({
  launch,
  onPress,
  topOffset = 8,
  variant = 'floating',
}: Props) {
  if (!launch) return null;

  const inline = variant === 'inline';
  const levelColors =
    launch.level === 1
      ? { main: '#ED4444', secondary: '#F06A6A' }
      : launch.level === 2
        ? { main: '#E11414', secondary: '#FF6670' }
        : { main: '#F59E0B', secondary: '#FBBF24' };

  return (
    <Pressable
      style={[styles.wrap, inline ? styles.wrapInline : { top: topOffset }]}
      onPress={onPress}
      hitSlop={inline ? 6 : 0}
    >
      <LinearGradient
        colors={['#E11414', '#8A0E0E']}
        style={[styles.badge, inline && styles.badgeInline]}
      >
        <RocketIcon
          size={inline ? 18 : 22}
          color={levelColors.main}
          secondaryColor={levelColors.secondary}
        />
      </LinearGradient>
      {!inline ? <View style={styles.glow} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    zIndex: 70,
  },
  wrapInline: {
    position: 'relative',
    right: 0,
    zIndex: 0,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgeInline: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
  },
  glow: {
    position: 'absolute',
    inset: -4,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(225, 20, 20,0.45)',
    zIndex: -1,
  },
});
