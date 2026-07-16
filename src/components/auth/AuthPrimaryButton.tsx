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
        colors={inactive ? ['#6B3A42', '#4A2830'] : ['#FF4D5E', '#C40E2E']}
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
    borderRadius: 99,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
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
