/**
 * LinkUp App — BackButton Component
 * زر رجوع ذكي يحترم RTL تلقائياً
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, shadows } from '@/theme';
import { BackChevron } from './RtlChevron';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  size?: number;
  bg?: string;
  style?: ViewStyle;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = '#1A0A0C',
  size = 24,
  bg = colors.white,
  style,
}) => {
  const router = useRouter();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={[styles.button, { backgroundColor: bg }, style]}
    >
      <BackChevron size={size} color={color} strokeWidth={2.5} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
