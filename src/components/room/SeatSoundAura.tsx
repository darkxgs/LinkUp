/**
 * هالة صوت حول المقعد — توهّج يتجاوب مع مستوى الصوت الحقيقي + حلقات متموّجة
 * تُظهر فوراً أنّ صاحب المقعد يتكلّم بأي مستوى صوت.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { lu } from '@/theme/lu-brand';

const RING_COUNT = 3;
// عتبة صغيرة: تحت هذا المستوى نعتبر المقعد صامتاً فنوقف الحلقات (توفير حرارة/بطارية)
const ACTIVE_THRESHOLD = 0.02;
// مهلة صغيرة قبل إيقاف الحلقات حتى لا تتذبذب مع فجوات الكلام القصيرة
const PARK_DELAY_MS = 600;

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

  // مراجع الحلقات + حالة التشغيل + مؤقّت الإيقاف المؤجّل (تُنشأ الحلقات مرّة واحدة، لا مع كل فجوة كلام)
  const ringLoopsRef = useRef<Animated.CompositeAnimation[] | null>(null);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const loopsRunningRef = useRef(false);
  const parkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLoops = useCallback(() => {
    if (loopsRunningRef.current) return; // تعمل أصلاً — لا تُنشئ حلقات جديدة (تجنّب هدر GC)
    loopsRunningRef.current = true;

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

    ringLoopsRef.current = ringLoops;
    glowLoopRef.current = glowLoop;
    ringLoops.forEach((l) => l.start());
    glowLoop.start();
  }, [rings, glowAnim]);

  const stopLoops = useCallback(() => {
    if (!loopsRunningRef.current) return;
    loopsRunningRef.current = false;
    ringLoopsRef.current?.forEach((l) => l.stop());
    glowLoopRef.current?.stop();
    ringLoopsRef.current = null;
    glowLoopRef.current = null;
    // إعادة للراحة حتى تختفي الحلقات ويهدأ التوهّج عند الصمت
    rings.forEach((a) => a.setValue(0));
    glowAnim.setValue(0);
  }, [rings, glowAnim]);

  // شغّل الحلقات فقط عند وجود صوت فعلي؛ أوقفها (بعد مهلة قصيرة) عند الصمت.
  // في وضع الموسيقى/غياب audioLevel نُبقيها دائمة كالسابق (لا نغيّر مظهر مقعد الموسيقى).
  const soundActive =
    audioLevel == null || (audioLevel ?? 0) >= ACTIVE_THRESHOLD;

  useEffect(() => {
    if (soundActive) {
      // استأنف فوراً عند عودة الصوت وألغِ أي إيقاف مؤجّل
      if (parkTimerRef.current) {
        clearTimeout(parkTimerRef.current);
        parkTimerRef.current = null;
      }
      startLoops();
    } else if (loopsRunningRef.current && !parkTimerRef.current) {
      // صمت: أوقف الحلقات بعد مهلة قصيرة (نتحمّل فجوات الكلام القصيرة)
      parkTimerRef.current = setTimeout(() => {
        parkTimerRef.current = null;
        stopLoops();
      }, PARK_DELAY_MS);
    }
  }, [soundActive, startLoops, stopLoops]);

  // تنظيف نهائي عند إزالة المكوّن: أوقف كل الحلقات وألغِ المؤقّت
  useEffect(() => {
    return () => {
      if (parkTimerRef.current) {
        clearTimeout(parkTimerRef.current);
        parkTimerRef.current = null;
      }
      stopLoops();
    };
  }, [stopLoops]);

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
