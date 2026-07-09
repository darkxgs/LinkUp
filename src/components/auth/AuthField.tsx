/**
 * AuthField — حقل إدخال موحّد لشاشات المصادقة
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { lu } from '@/theme/lu-brand';

type AuthFieldProps = TextInputProps & {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  onTrailingPress?: () => void;
};

export function AuthField({
  label,
  icon,
  trailing,
  error,
  containerStyle,
  onTrailingPress,
  style,
  ...inputProps
}: AuthFieldProps) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          {...inputProps}
          style={[styles.input, style]}
          placeholderTextColor={lu.colors.muted}
        />
        {trailing ? (
          onTrailingPress ? (
            <Pressable onPress={onTrailingPress} hitSlop={8}>
              {trailing}
            </Pressable>
          ) : (
            trailing
          )
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: lu.spacing.base,
  },
  label: {
    marginBottom: lu.spacing.xs,
    paddingHorizontal: 2,
    fontSize: 13,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: lu.spacing.sm,
    paddingHorizontal: lu.spacing.md,
    paddingVertical: 13,
    backgroundColor: lu.colors.card2,
    borderRadius: lu.radius.sm,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  inputRowError: {
    borderColor: lu.colors.live,
    backgroundColor: lu.colors.redSoft,
  },
  icon: {
    opacity: 0.85,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
    padding: 0,
    includeFontPadding: false,
  },
  error: {
    marginTop: 4,
    paddingHorizontal: 2,
    fontSize: 12,
    color: lu.colors.live,
    fontFamily: lu.fonts.bodyMedium,
    includeFontPadding: false,
  },
});
