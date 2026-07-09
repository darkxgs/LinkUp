/**
 * Sada App — Button Component
 */

import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Text } from './Text';
import { colors, radius, spacing, shadows } from '@/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title?: string;
  i18nKey?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  i18nKey,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  haptic = true,
  disabled,
  onPress,
  style,
  children,
  ...rest
}) => {
  const handlePress = (e: any) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.(e);
  };
  
  const isDisabled = disabled || loading;
  
  const buttonStyles = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];
  
  const textColor = getTextColor(variant);
  const textVariant = size === 'sm' ? 'buttonSmall' : 'button';
  
  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        ...buttonStyles,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          {(title || i18nKey || children) && (
            <Text variant={textVariant} color={textColor} weight="semibold">
              {i18nKey ? undefined : title}
              {children}
            </Text>
          )}
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </Pressable>
  );
};

const getTextColor = (variant: Variant): string => {
  switch (variant) {
    case 'primary':
    case 'danger':
    case 'gradient':
      return colors.white;
    case 'secondary':
      return colors.brand.primary;
    case 'outline':
    case 'ghost':
      return colors.brand.primary;
    default:
      return colors.text.primary;
  }
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconLeft: {
    marginEnd: 4,
  },
  iconRight: {
    marginStart: 4,
  },
  
  // Sizes
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  size_lg: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  
  // Variants
  variant_primary: {
    backgroundColor: colors.brand.primary,
    ...shadows.purpleGlow,
  },
  variant_secondary: {
    backgroundColor: colors.brand.primaryLightest,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: colors.semantic.error,
  },
  variant_gradient: {
    backgroundColor: colors.brand.primary,
    ...shadows.purpleGlow,
  },
});
