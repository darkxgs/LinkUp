/**
 * إطار موسيقى متموّج حول صورة الوكالة عند وجود فعالية جارية
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const RING_GRADIENT = ['#FECACA', '#FF5C5C', '#E11414', '#B00E0E'] as const;
const RIPPLE_COLOR = 'rgba(255, 92, 92, 0.55)';
const WAVE_MS = 2200;

function AudioBars({ size }: { size: number }) {
  const h1 = useSharedValue(0.42);
  const h2 = useSharedValue(0.88);
  const h3 = useSharedValue(0.58);
  const h4 = useSharedValue(0.72);

  useEffect(() => {
    const anim = (v: SharedValue<number>, delay: number) => {
      v.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 220 + delay, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.32, { duration: 220 + delay, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    };
    anim(h1, 0);
    anim(h2, 55);
    anim(h3, 110);
    anim(h4, 165);
  }, [h1, h2, h3, h4]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: h1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: h2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: h3.value }] }));
  const s4 = useAnimatedStyle(() => ({ transform: [{ scaleY: h4.value }] }));

  const barW = Math.max(2, size * 0.045);
  const barH = Math.max(7, size * 0.14);

  return (
    <View style={styles.barsRow}>
      <Animated.View style={[styles.bar, { width: barW, height: barH }, s1]} />
      <Animated.View style={[styles.bar, { width: barW, height: barH * 1.15 }, s2]} />
      <Animated.View style={[styles.bar, { width: barW, height: barH * 0.9 }, s3]} />
      <Animated.View style={[styles.bar, { width: barW, height: barH }, s4]} />
    </View>
  );
}

function RippleWave({ size, delayMs }: { size: number; delayMs: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.28, { duration: WAVE_MS, easing: Easing.out(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: WAVE_MS, easing: Easing.out(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, opacity, scale]);

  const waveStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        waveStyle,
      ]}
    />
  );
}

export function AgencyPartyAvatarFrame({
  active,
  size,
  children,
}: {
  active: boolean;
  size: number;
  children: React.ReactNode;
}) {
  const glow = useSharedValue(0.38);
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      glow.value = 0;
      breathe.value = 1;
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(0.82, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.38, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [active, breathe, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: breathe.value }],
  }));

  if (!active) {
    return <>{children}</>;
  }

  const ringWidth = Math.max(2.5, size * 0.035);
  const outerSize = size + ringWidth * 2 + 4;
  const badgeW = Math.max(28, size * 0.38);
  const badgeH = Math.max(14, size * 0.17);

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize + badgeH * 0.15 }]}>
      <RippleWave size={outerSize} delayMs={0} />
      <RippleWave size={outerSize} delayMs={Math.round(WAVE_MS / 3)} />
      <RippleWave size={outerSize} delayMs={Math.round((WAVE_MS * 2) / 3)} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowOrb,
          {
            width: outerSize + 10,
            height: outerSize + 10,
            borderRadius: (outerSize + 10) / 2,
          },
          glowStyle,
        ]}
      />

      <LinearGradient
        colors={[...RING_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.ring,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            padding: ringWidth,
          },
        ]}
      >
        <View
          style={[
            styles.avatarClip,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>

      <View
        style={[
          styles.badge,
          {
            width: badgeW,
            height: badgeH,
            borderRadius: badgeH / 2,
            bottom: -badgeH * 0.22,
          },
        ]}
      >
        <LinearGradient
          colors={['#FF3340', '#B00E0E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.badgeInner, { borderRadius: badgeH / 2 }]}
        >
          <AudioBars size={size} />
        </LinearGradient>
      </View>
    </View>
  );
}

/** @deprecated استخدم AgencyPartyAvatarFrame */
export const AgencyPartyCardGlow = AgencyPartyAvatarFrame;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: RIPPLE_COLOR,
    backgroundColor: 'transparent',
  },
  glowOrb: {
    position: 'absolute',
    backgroundColor: '#FF5C5C',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    elevation: 8,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarClip: {
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    height: '100%',
    paddingBottom: 2,
  },
  bar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
});
