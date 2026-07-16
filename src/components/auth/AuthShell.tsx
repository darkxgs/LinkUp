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

import { Image } from 'expo-image';

import { BackButton } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { LINKUP_MAIN_LOGO } from '@/constants/brandAssets';

const LOGIN_BG = require('../../../assets/images/login_bg.png');

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
      {/* خلفية العميل — كما هي */}
      <Image source={LOGIN_BG} style={StyleSheet.absoluteFill} contentFit="cover" />

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
            <BackButton color="#FFFFFF" bg="rgba(255,255,255,0.08)" />
          </View>

          <View style={styles.hero}>
            <Image
              source={LINKUP_MAIN_LOGO}
              style={styles.heroLogo}
              contentFit="cover"
            />
            <Text style={styles.wordmark}>
              Link<Text style={styles.wordmarkUp}>Up</Text>
            </Text>
            <View style={styles.titleRow}>
              <View style={styles.titleLine} />
              <View style={styles.titleDot} />
              <Text style={styles.title}>{title}</Text>
              <View style={styles.titleDot} />
              <View style={styles.titleLine} />
            </View>
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
  root: { flex: 1, backgroundColor: '#0C0709' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  topBar: {
    paddingHorizontal: lu.spacing.md,
    marginBottom: lu.spacing.sm,
  },

  hero: {
    alignItems: 'center',
    paddingHorizontal: lu.spacing.lg,
    marginBottom: lu.spacing.lg,
    gap: 6,
  },
  heroLogo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,77,94,0.5)',
  },
  wordmark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    fontWeight: '900',
    includeFontPadding: false,
    writingDirection: 'ltr',
  },
  wordmarkUp: {
    color: '#E11414',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  titleLine: {
    width: 42,
    height: 1,
    backgroundColor: 'rgba(255,70,80,0.45)',
  },
  titleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11414',
  },
  title: {
    fontSize: 28,
    color: '#FFF0F0',
    fontFamily: lu.fonts.displayBold,
    textAlign: 'center',
    includeFontPadding: false,
    marginHorizontal: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: lu.fonts.body,
    textAlign: 'center',
    includeFontPadding: false,
    maxWidth: 300,
  },

  formCard: {
    marginHorizontal: lu.spacing.md,
    padding: lu.spacing.lg,
    backgroundColor: 'rgba(22,10,13,0.72)',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(255,45,60,0.4)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
});
