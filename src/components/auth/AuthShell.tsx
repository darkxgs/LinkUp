/**
 * AuthShell — إطار موحّد لشاشات تسجيل الدخول / التسجيل
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui';
import { LuLogo } from '@/components/brand/LuBrand';
import { lu } from '@/theme/lu-brand';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AuthShell({ title, subtitle, children, footer, contentStyle }: AuthShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...lu.gradients.pageOnboarding]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft brand orbs */}
      <View style={styles.orbPink} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,46,62,0.32)', 'rgba(255,46,62,0)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.orbBlue} pointerEvents="none">
        <LinearGradient
          colors={['rgba(236, 62, 62, 0.28)', 'rgba(236, 62, 62, 0)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + lu.spacing.md,
              paddingBottom: insets.bottom + lu.spacing.xl,
            },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <BackButton color={lu.colors.ink} bg="rgba(255,255,255,0.92)" />
          </View>

          <View style={styles.hero}>
            <LuLogo size={42} />
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.formCard}>{children}</View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lu.colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  orbPink: {
    position: 'absolute',
    top: -40,
    end: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
  },
  orbBlue: {
    position: 'absolute',
    top: 120,
    start: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
  },

  topBar: {
    paddingHorizontal: lu.spacing.md,
    marginBottom: lu.spacing.sm,
  },

  hero: {
    alignItems: 'center',
    paddingHorizontal: lu.spacing.lg,
    marginBottom: lu.spacing.lg,
    gap: lu.spacing.sm,
  },
  title: {
    marginTop: lu.spacing.sm,
    fontSize: 28,
    color: lu.colors.ink,
    fontFamily: lu.fonts.displayBold,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
    textAlign: 'center',
    includeFontPadding: false,
    maxWidth: 300,
  },

  formCard: {
    marginHorizontal: lu.spacing.md,
    padding: lu.spacing.lg,
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.lg,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },
});
