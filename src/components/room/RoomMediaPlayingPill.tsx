/**
 * مؤشر موسيقى/فيديو شغّال — أعلى الروم تحت زر الحفلة، مع ذبذبات متحركة.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Music2, Video } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { ROOM_DESIGN } from '@/theme/room-design';
import { lu } from '@/theme/lu-brand';

export type RoomMediaPlayingKind = 'music' | 'video';

type Props = {
  kind: RoomMediaPlayingKind;
  label?: string;
  title?: string;
};

function EqBars({ color }: { color: string }) {
  const a1 = useRef(new Animated.Value(0.35)).current;
  const a2 = useRef(new Animated.Value(0.65)).current;
  const a3 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const bar = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.25,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const l1 = bar(a1, 0);
    const l2 = bar(a2, 120);
    const l3 = bar(a3, 220);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a1, a2, a3]);

  const BAR_H1 = 11;
  const BAR_H2 = 13;
  const BAR_H3 = 10;

  const s1 = a1.interpolate({ inputRange: [0.25, 1], outputRange: [4 / BAR_H1, 1] });
  const s2 = a2.interpolate({ inputRange: [0.25, 1], outputRange: [5 / BAR_H2, 1] });
  const s3 = a3.interpolate({ inputRange: [0.25, 1], outputRange: [4 / BAR_H3, 1] });

  return (
    <View style={styles.eqWrap}>
      <Animated.View
        style={[
          styles.eqBar,
          { height: BAR_H1, backgroundColor: color, transform: [{ scaleY: s1 }] },
        ]}
      />
      <Animated.View
        style={[
          styles.eqBar,
          { height: BAR_H2, backgroundColor: color, transform: [{ scaleY: s2 }] },
        ]}
      />
      <Animated.View
        style={[
          styles.eqBar,
          { height: BAR_H3, backgroundColor: color, transform: [{ scaleY: s3 }] },
        ]}
      />
    </View>
  );
}

export const RoomMediaPlayingPill = React.memo(function RoomMediaPlayingPill({
  kind,
  label,
  title,
}: Props) {
  const accent = kind === 'music' ? lu.colors.pink : '#F06A6A';
  const Icon = kind === 'music' ? Music2 : Video;
  const showLabel = kind !== 'music' && !!label?.trim();
  const a11yLabel = title ? `${label ?? kind}: ${title}` : (label ?? (kind === 'music' ? 'Music playing' : 'Video playing'));

  return (
    <View
      style={[styles.pill, !showLabel && styles.pillIconOnly]}
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.glassWhite} />
      <View style={[styles.glassTint, kind === 'music' ? styles.tintMusic : styles.tintVideo]} />
      <View style={styles.iconWrap}>
        <Icon size={showLabel ? 11 : 13} color={accent} strokeWidth={2.4} />
      </View>
      <EqBars color={accent} />
      {showLabel ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 209, 0.42)',
    overflow: 'hidden',
    maxWidth: 118,
  },
  pillIconOnly: {
    paddingHorizontal: 6,
    maxWidth: 52,
  },
  glassWhite: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ROOM_DESIGN.glass,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  tintMusic: {
    backgroundColor: 'rgba(225, 20, 20,0.22)',
  },
  tintVideo: {
    backgroundColor: 'rgba(240, 106, 106, 0.2)',
  },
  iconWrap: {
    zIndex: 1,
  },
  eqWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 13,
    zIndex: 1,
  },
  eqBar: {
    width: 2.5,
    borderRadius: 2,
  },
  label: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    flexShrink: 1,
    zIndex: 1,
  },
});
