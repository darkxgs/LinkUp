import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

type Props = {
  active?: boolean;
  color?: string;
};

export function MusicPlayingBars({ active = true, color = '#FF6B35' }: Props) {
  const a = useRef(new Animated.Value(0.35)).current;
  const b = useRef(new Animated.Value(0.65)).current;
  const c = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (!active) {
      a.setValue(0.25);
      b.setValue(0.25);
      c.setValue(0.25);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.3, duration: 280, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(b, { toValue: 0.35, duration: 240, useNativeDriver: true }),
          Animated.timing(b, { toValue: 1, duration: 360, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(c, { toValue: 0.9, duration: 300, useNativeDriver: true }),
          Animated.timing(c, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, a, b, c]);

  const bar = (anim: Animated.Value, h: number) => (
    <Animated.View
      style={[
        styles.bar,
        {
          height: h,
          backgroundColor: color,
          transform: [{ scaleY: anim }],
        },
      ]}
    />
  );

  return (
    <View style={styles.wrap}>
      {bar(a, 14)}
      {bar(b, 18)}
      {bar(c, 12)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    width: 22,
    height: 20,
    justifyContent: 'center',
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
