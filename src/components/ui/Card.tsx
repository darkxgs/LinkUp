/**
 * Sada App — Card Component
 */

import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PressableProps,
} from 'react-native';

import { colors, radius, spacing, shadows } from '@/theme';

interface CardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: 'flat' | 'elevated' | 'outlined';
  padding?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'flat',
  padding = spacing.base,
  style,
  onPress,
  ...rest
}) => {
  const cardStyle = [
    styles.base,
    styles[`variant_${variant}`],
    { padding },
    style,
  ];
  
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  
  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.card,
    borderRadius: radius.base,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  variant_flat: {},
  variant_elevated: {
    ...shadows.base,
  },
  variant_outlined: {
    borderWidth: 1,
    borderColor: colors.border.light,
  },
});
