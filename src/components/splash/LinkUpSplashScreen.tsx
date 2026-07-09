/**
 * LinkUp — شاشة البداية (Splash)
 * نبض موسيقي حول الشعار + هوية LinkUp الحمراء/السوداء
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  type SharedValue,
} from 'react-native-reanimated';

import {
  LINKUP_MAIN_LOGO,
  LINKUP_SPLASH_WORDMARK,
  LINKUP_SPLASH_WORDMARK_ASPECT,
} from '@/constants/brandAssets';

const RING_GRADIENT = ['#FF6B6B', '#FF2D2D', '#B00E0E', '#3A0A0A'] as const;

function PulseRing({
  size,
  color,
  delay,
  borderWidth = 2,
}: {
  size: number;
  color: string;
  delay: number;
  borderWidth?: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.82, 1.55]) }],
    opacity: interpolate(progress.value, [0, 0.15, 1], [0.65, 0.45, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

function EqBar({
  value,
  width,
  maxHeight,
  color,
}: {
  value: SharedValue<number>;
  width: number;
  maxHeight: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    height: Math.max(4, value.value * maxHeight),
    opacity: interpolate(value.value, [0.3, 1], [0.55, 1]),
  }));

  return (
    <Animated.View
      style={[{ width, borderRadius: width, backgroundColor: color }, style]}
    />
  );
}

function MusicEqualizer() {
  const bars = [
    useSharedValue(0.5),
    useSharedValue(0.92),
    useSharedValue(0.62),
    useSharedValue(0.88),
    useSharedValue(0.54),
    useSharedValue(0.78),
    useSharedValue(0.48),
  ];
  const durations = [480, 560, 420, 520, 500, 440, 540];

  useEffect(() => {
    bars.forEach((bar, index) => {
      bar.value = withRepeat(
        withSequence(
          withTiming(1, { duration: durations[index], easing: Easing.inOut(Easing.ease) }),
          withTiming(0.28, { duration: durations[index], easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.eqRow}>
      {bars.map((bar, index) => (
        <EqBar
          key={index}
          value={bar}
          width={4}
          maxHeight={22}
          color={index % 2 === 0 ? '#FF4D5A' : '#E11414'}
        />
      ))}
    </View>
  );
}

export function LinkUpSplashScreen() {
  const { width } = useWindowDimensions();
  const iconSize = Math.min(width * 0.34, 148);
  const ringSize = iconSize + 28;
  const innerSize = ringSize - 6;
  const innerRadius = ringSize * 0.22 - 3;
  const fullLogoW = Math.min(width * 0.72, 300);

  const breathe = useSharedValue(0);
  const glow = useSharedValue(0.35);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.72, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.28, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breathe, glow, reveal]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.045]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.95, 1.08]) }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: interpolate(reveal.value, [0, 1], [0.92, 1]) }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A0506', '#120608', '#0A0506']}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(225,20,20,0.22)', 'transparent', 'rgba(225,20,20,0.08)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.vignetteTop}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <Animated.View style={[styles.logoStage, revealStyle, { width: ringSize * 1.65, height: ringSize * 1.65 }]}>
          <PulseRing size={ringSize * 1.5} color="rgba(255, 92, 92, 0.42)" delay={0} />
          <PulseRing size={ringSize * 1.5} color="rgba(225, 20, 20, 0.38)" delay={800} />
          <PulseRing size={ringSize * 1.5} color="rgba(176, 14, 14, 0.28)" delay={1600} borderWidth={1.5} />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowOrb,
              {
                width: ringSize + 36,
                height: ringSize + 36,
                borderRadius: (ringSize + 36) / 2,
              },
              glowStyle,
            ]}
          />

          <LinearGradient
            colors={[...RING_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.iconRing,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize * 0.22,
                padding: 3,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.iconInner,
                {
                  width: innerSize,
                  height: innerSize,
                  borderRadius: innerRadius,
                },
                iconStyle,
              ]}
            >
              <Image
                source={LINKUP_MAIN_LOGO}
                style={{ width: innerSize, height: innerSize, borderRadius: innerRadius }}
                contentFit="cover"
              />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        <MusicEqualizer />

        <Image
          source={LINKUP_SPLASH_WORDMARK}
          style={{
            width: fullLogoW,
            height: fullLogoW / LINKUP_SPLASH_WORDMARK_ASPECT,
            marginTop: 18,
          }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0506',
  },
  vignetteTop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  logoStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  glowOrb: {
    position: 'absolute',
    backgroundColor: '#E11414',
  },
  iconRing: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  iconInner: {
    backgroundColor: '#0A0506',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: 24,
    marginTop: 22,
  },
});
