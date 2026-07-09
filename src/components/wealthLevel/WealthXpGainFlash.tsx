/**
 * وميض +EXP عند جمع الفقاعة أو زيادة السكور
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Easing } from 'react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

type Props = {
  amount: number;
  triggerKey: number;
  label: string;
};

export function WealthXpGainFlash({ amount, triggerKey, label }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (triggerKey <= 0) return;
    opacity.setValue(0);
    translateY.setValue(0);
    scale.setValue(0.6);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(translateY, {
        toValue: -28,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.15,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [triggerKey, opacity, scale, translateY]);

  if (triggerKey <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text weight="bold" style={styles.text}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -4,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(225, 20, 20,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
});
