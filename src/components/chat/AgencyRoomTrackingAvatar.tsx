/**
 * إطار موسيقى للوكالة — حلقة متدرجة حول الصورة + موجات صوت في الأسفل
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

interface Props {
  size: number;
  active: boolean;
  children: React.ReactNode;
}

const RING_GRADIENT = ['#FDE68A', '#FB923C', '#F97316', '#EA580C'] as const;

function AudioBars({ size }: { size: number }) {
  const h1 = useSharedValue(0.45);
  const h2 = useSharedValue(0.85);
  const h3 = useSharedValue(0.6);

  useEffect(() => {
    const anim = (v: SharedValue<number>, delay: number) => {
      v.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 260 + delay, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 260 + delay, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    };
    anim(h1, 0);
    anim(h2, 90);
    anim(h3, 180);
  }, [h1, h2, h3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: h1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: h2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: h3.value }] }));

  const barW = Math.max(2, size * 0.055);
  const barH = Math.max(7, size * 0.18);

  return (
    <View style={styles.barsRow}>
      <Animated.View style={[styles.bar, { width: barW, height: barH }, s1]} />
      <Animated.View style={[styles.bar, { width: barW, height: barH }, s2]} />
      <Animated.View style={[styles.bar, { width: barW, height: barH }, s3]} />
    </View>
  );
}

export function AgencyRoomTrackingAvatar({ size, active, children }: Props) {
  const glow = useSharedValue(0.35);

  useEffect(() => {
    if (!active) {
      glow.value = 0.35;
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [active, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.06 }],
  }));

  if (!active) {
    return <>{children}</>;
  }

  const ringWidth = Math.max(2.5, size * 0.048);
  const outerSize = size + ringWidth * 2;
  const badgeW = Math.max(26, size * 0.46);
  const badgeH = Math.max(13, size * 0.24);

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: outerSize + 6,
            height: outerSize + 6,
            borderRadius: (outerSize + 6) / 2,
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
            bottom: -badgeH * 0.28,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(24, 24, 27, 0.92)', 'rgba(9, 9, 11, 0.96)']}
          style={[styles.badgeInner, { borderRadius: badgeH / 2 }]}
        >
          <AudioBars size={size} />
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#F97316',
    shadowColor: '#FB923C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
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
    borderColor: '#F97316',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
  badgeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
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
    backgroundColor: '#FFF7ED',
    borderRadius: 1.5,
  },
});
