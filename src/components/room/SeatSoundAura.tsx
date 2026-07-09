/**
 * هالة صوت حول المقعد — توهّج يتجاوب مع مستوى الصوت الحقيقي + حلقات متموّجة
 * تُظهر فوراً أنّ صاحب المقعد يتكلّم بأي مستوى صوت.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { lu } from '@/theme/lu-brand';

const RING_COUNT = 3;

type Props = {
  size: number;
  variant?: 'voice' | 'music';
  audioLevel?: number;
};

export function SeatSoundAura({ size, variant = 'voice', audioLevel }: Props) {
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  ).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const levelAnim = useRef(new Animated.Value(0)).current;

  const color = variant === 'music' ? lu.colors.pink : '#4ADE80';
  const ringBase = size + 6;
  const borderW = Math.max(2, Math.round(size * 0.035));

  const hasAudioLevel = audioLevel != null && audioLevel > 0;

  useEffect(() => {
    if (hasAudioLevel) {
      const clamped = Math.min(1, Math.max(0, audioLevel ?? 0));
      const boosted = Math.min(1, clamped * 3.5);
      Animated.timing(levelAnim, {
        toValue: boosted,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(levelAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [audioLevel, hasAudioLevel, levelAnim]);

  useEffect(() => {
    const ringLoops = rings.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i * 700) / RING_COUNT),
          Animated.timing(a, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    ringLoops.forEach((l) => l.start());
    glowLoop.start();
    return () => {
      ringLoops.forEach((l) => l.stop());
      glowLoop.stop();
      rings.forEach((a) => a.setValue(0));
      glowAnim.setValue(0);
    };
  }, [rings, glowAnim]);

  const glowOpacity = hasAudioLevel
    ? Animated.add(
        levelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }),
        glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
      )
    : glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  const glowScale = hasAudioLevel
    ? Animated.add(
        levelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.22] }),
        glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] }),
      )
    : glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.14] });

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      pointerEvents="none"
    >
      {/* توهّج يتجاوب مع الصوت */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: ringBase,
            height: ringBase,
            borderRadius: ringBase / 2,
            backgroundColor: color,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* حلقات متموّجة سريعة */}
      {rings.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: ringBase,
              height: ringBase,
              borderRadius: ringBase / 2,
              borderWidth: borderW,
              borderColor: color,
              opacity: a.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.5, 0] }),
              transform: [
                { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.45] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});
