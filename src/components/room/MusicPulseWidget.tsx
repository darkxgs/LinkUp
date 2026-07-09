/**
 * نبضات موسيقى فقط — بدون دائرة/أيقونة، الضغط على النبض يلغي الصوت
 */
import React, { useEffect } from 'react';
import { StyleSheet, Pressable, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

function PulseWave({
  size,
  color,
  delay,
  playing,
  borderWidth = 2,
}: {
  size: number;
  color: string;
  delay: number;
  playing: boolean;
  borderWidth?: number;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    if (!playing) {
      p.value = 0;
      return;
    }
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [p, delay, playing]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [0.35, 2.1]) }],
    opacity: playing ? interpolate(p.value, [0, 0.15, 1], [0.7, 0.5, 0]) : 0,
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
          borderWidth,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

interface Props {
  size?: number;
  playing: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function MusicPulseWidget({
  size = 64,
  playing,
  onPress,
  style,
  accessibilityLabel,
}: Props) {
  const coreGlow = useSharedValue(0.2);
  const coreBeat = useSharedValue(1);

  useEffect(() => {
    if (!playing) {
      coreGlow.value = withTiming(0.12, { duration: 300 });
      coreBeat.value = withTiming(1, { duration: 200 });
      return;
    }
    coreGlow.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 120, easing: Easing.out(Easing.ease) }),
        withTiming(0.25, { duration: 200 }),
        withTiming(0.75, { duration: 100, easing: Easing.out(Easing.ease) }),
        withTiming(0.2, { duration: 480 }),
      ),
      -1,
      false,
    );
    coreBeat.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 110, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 90 }),
        withTiming(1.2, { duration: 90, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 420 }),
      ),
      -1,
      false,
    );
  }, [playing, coreGlow, coreBeat]);

  const coreGlowStyle = useAnimatedStyle(() => ({
    opacity: coreGlow.value,
    transform: [{ scale: coreBeat.value }],
  }));

  const waveColor = playing ? '#FF3340' : 'rgba(255,80,80,0.35)';
  const hitSize = size + 24;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.hitArea, { width: hitSize, height: hitSize }, style]}
    >
      {playing ? (
        <>
          <PulseWave size={size} color={waveColor} delay={0} playing={playing} />
          <PulseWave size={size} color={waveColor} delay={530} playing={playing} />
          <PulseWave size={size} color={waveColor} delay={1060} playing={playing} borderWidth={1.5} />
        </>
      ) : (
        <PulseWave size={size * 0.85} color={waveColor} delay={0} playing={false} />
      )}

      {/* نواة توهج صغيرة — ليست دائرة صلبة، فقط بذرة النبض */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.coreGlow,
          {
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: size * 0.11,
            backgroundColor: playing ? '#FF2D2D' : 'rgba(255,60,60,0.4)',
            shadowColor: '#FF2D2D',
          },
          coreGlowStyle,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreGlow: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
});
