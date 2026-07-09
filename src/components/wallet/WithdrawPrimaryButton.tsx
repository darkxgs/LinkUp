import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  submitting?: boolean;
  colors?: [string, string];
};

export function WithdrawPrimaryButton({
  label,
  onPress,
  disabled = false,
  submitting = false,
  colors = ['#FF4D4D', '#B00E0E'],
}: Props) {
  const canPress = !disabled && !submitting;

  return (
    <Pressable
      onPress={onPress}
      disabled={!canPress}
      style={({ pressed }) => [
        styles.btn,
        !canPress && styles.btnDisabled,
        pressed && canPress && { opacity: 0.92 },
      ]}
    >
      <LinearGradient
        colors={canPress ? colors : ['#D1D5DB', '#9CA3AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text
            variant="button"
            weight="bold"
            color="#fff"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={styles.label}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    textAlign: 'center',
    letterSpacing: 0.3,
    fontSize: 16,
  },
});
