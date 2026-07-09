/**
 * AuthPrimaryButton — زر CTA بتدرّج الهوية
 */

import React, { ReactNode } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lu } from '@/theme/lu-brand';

type AuthPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AuthPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
}: AuthPrimaryButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btn,
        !inactive && lu.shadows.grad,
        inactive && styles.btnDisabled,
        pressed && !inactive && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      <LinearGradient
        colors={inactive ? ['#E0CACA', '#A8A6AE'] : [...lu.gradients.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {loading ? (
        <ActivityIndicator color={lu.colors.onGrad} />
      ) : (
        <>
          {icon}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: lu.radius.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: lu.spacing.sm,
    overflow: 'hidden',
    marginTop: lu.spacing.sm,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  label: {
    color: lu.colors.onGrad,
    fontSize: 16,
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
});
