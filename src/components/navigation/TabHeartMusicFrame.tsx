/**
 * TabHeartMusicFrame — زر الهوم المركزي (أحمر/أسود LinkUp) مع بث صوتي حي
 * نفس الـ props ({ size, active, children }) — بديل مباشر بدون تعديل التخطيط.
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
  withDelay,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';

interface Props {
  size: number;
  active: boolean;
  children: React.ReactNode;
}

// حلقة متدرّجة: أحمر فاتح → أحمر → أحمر داكن → أسود محمرّ
const RING_GRADIENT = ['#FF6B6B', '#FF2D2D', '#B00E0E', '#3A0A0A'] as const;

/* ───────── موجة بث واحدة ───────── */
function BroadcastWave({
  size,
  color,
  delay,
}: {
  size: number;
  color: string;
  delay: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [p, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [0.72, 1.75]) }],
    opacity: interpolate(p.value, [0, 1], [0.5, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/* ───────── معادل الموسيقى ───────── */
function EqualizerBars({ size, active }: { size: number; active: boolean }) {
  const bars = [
    useSharedValue(0.45),
    useSharedValue(0.95),
    useSharedValue(0.6),
    useSharedValue(0.85),
    useSharedValue(0.5),
  ];
  const durations = [520, 600, 460, 560, 500];

  useEffect(() => {
    bars.forEach((v, i) => {
      v.value = withRepeat(
        withSequence(
          withTiming(1, { duration: durations[i], easing: Easing.inOut(Easing.ease) }),
          withTiming(0.32, { duration: durations[i], easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barW = Math.max(2, size * 0.05);
  const barMaxH = Math.max(8, size * 0.2);
  const color = active ? '#FFFFFF' : '#E11414';

  return (
    <View style={styles.barsRow}>
      {bars.map((v, i) => (
        <Bar key={i} v={v} w={barW} maxH={barMaxH} color={color} />
      ))}
    </View>
  );
}

function Bar({
  v,
  w,
  maxH,
  color,
}: {
  v: SharedValue<number>;
  w: number;
  maxH: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({ height: Math.max(3, v.value * maxH) }));
  return (
    <Animated.View
      style={[{ width: w, borderRadius: w, backgroundColor: color }, style]}
    />
  );
}

export function TabHeartMusicFrame({ size, active, children }: Props) {
  const glow = useSharedValue(0.3);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(active ? 0.8 : 0.5, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(active ? 0.38 : 0.22, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [active, glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const ringWidth = Math.max(2, size * 0.045);
  const outerSize = size + ringWidth * 2;
  const waveColor = active ? '#FF3340' : '#E11414';
  const badgeW = Math.max(26, size * 0.5);
  const badgeH = Math.max(13, size * 0.26);

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize + badgeH * 0.25 }]}>
      {/* موجات البث */}
      <BroadcastWave size={outerSize} color={waveColor} delay={0} />
      <BroadcastWave size={outerSize} color={waveColor} delay={1100} />

      {/* توهّج ناعم مزدوج */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: outerSize + 14,
            height: outerSize + 14,
            borderRadius: (outerSize + 14) / 2,
            backgroundColor: active ? '#FF2D2D' : '#E11414',
          },
          glowStyle,
        ]}
      />

      {/* الحلقة المتدرّجة + الأيقونة */}
      <LinearGradient
        colors={[...RING_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.ring,
          { width: outerSize, height: outerSize, borderRadius: outerSize / 2, padding: ringWidth },
        ]}
      >
        <View style={[styles.inner, { width: size, height: size, borderRadius: size / 2 }]}>
          {children}
        </View>
      </LinearGradient>

      {/* شارة المعادل */}
      <View
        style={[
          styles.badge,
          {
            width: badgeW,
            height: badgeH,
            borderRadius: badgeH / 2,
            bottom: -badgeH * 0.4,
            borderColor: active ? '#FF6B6B' : '#E11414',
          },
        ]}
      >
        <LinearGradient
          colors={
            active
              ? ['rgba(176, 14, 14, 0.96)', 'rgba(225, 20, 20, 0.98)']
              : ['rgba(255, 255, 255, 0.96)', 'rgba(255, 214, 214, 0.98)']
          }
          style={[styles.badgeInner, { borderRadius: badgeH / 2 }]}
        >
          <EqualizerBars size={size} active={active} />
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 9,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B00E0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 9,
    elevation: 6,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',   // كان '#15151A'
  },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 4,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
