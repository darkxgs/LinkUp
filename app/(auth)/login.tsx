/**
 * LinkUp App — Login Screen
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, LogIn, ChevronRight } from 'lucide-react-native';

import { useAuth } from '@/hooks/useAuth';
import { AuthShell, AuthField, AuthPrimaryButton } from '@/components/auth';
import { lu } from '@/theme/lu-brand';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  // اتجاه الصفوف حسب اللغة: RTL للعربية (النص الرمادي يمين، الملوّن يسار)
  const isAr = i18n.language?.startsWith('ar');
  const linkDir = { flexDirection: ('row') as 'row' | 'row-reverse' };
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = isValidEmail && password.length >= 6 && !isLoading;

  const handleLogin = async () => {
    if (!canSubmit) {
      if (!isValidEmail) {
        Alert.alert(t('roomSettings.text32386'), t('auth.emailInvalid'));
      } else if (password.length < 6) {
        Alert.alert(t('roomSettings.text32386'), t('auth.passwordMinLen'));
      }
      return;
    }

    try {
      await login(email, password);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      Alert.alert(t('auth.loginFailed'), e.message);
    }
  };

  return (
    <AuthShell
      title={t('auth.text60529')}
      subtitle={t('auth.text26096')}
    >
      <AuthField
        label={t('auth.emailLabel')}
        icon={<Mail size={18} color="#FF4D5A" strokeWidth={2} />}
        value={email}
        onChangeText={setEmail}
        placeholder="example@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textAlign="left"
      />

      <AuthField
        label={t('auth.passwordLabel')}
        icon={<Lock size={18} color="#FF4D5A" strokeWidth={2} />}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry={!showPassword}
        autoComplete="password"
        textAlign="left"
        trailing={
          showPassword ? (
            <EyeOff size={18} color="#FF4D5A" strokeWidth={2} />
          ) : (
            <Eye size={18} color="#FF4D5A" strokeWidth={2} />
          )
        }
        onTrailingPress={() => setShowPassword(!showPassword)}
        containerStyle={{ marginBottom: 0 }}
      />

      <Pressable
        onPress={() => router.push('/(auth)/forgot-password' as any)}
        style={styles.forgotBtn}
      >
        <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
      </Pressable>

      <AuthPrimaryButton
        label={t('auth.login')}
        onPress={handleLogin}
        disabled={!canSubmit}
        loading={isLoading}
        icon={<LogIn size={20} color={lu.colors.onGrad} strokeWidth={2.5} />}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <View style={styles.dividerDot} />
        <Text style={styles.dividerText}>{t('auth.text52428')}</Text>
        <View style={styles.dividerDot} />
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={() => router.push('/(auth)/login-id' as any)}
        style={[styles.linkRow, linkDir]}
      >
        <Text style={styles.linkMuted}>{t('auth.loginWithIdInstead')} </Text>
        <Text style={styles.linkAccent}>{t('auth.loginWithId')}</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(auth)/register' as any)}
        style={({ pressed }) => [styles.registerCard, linkDir, pressed && { opacity: 0.88 }]}
      >
        <Text style={styles.linkMuted}>{t('auth.dontHaveAccount')} </Text>
        <Text style={styles.linkAccent}>{t('auth.text46120')}</Text>
        <ChevronRight size={17} color="#FF4D5A" style={isAr ? { transform: [{ scaleX: -1 }] } : undefined} />
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: lu.spacing.sm,
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13.5,
    color: '#FF4D5A',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: lu.spacing.base,
    marginTop: lu.spacing.lg,
    marginBottom: lu.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,70,80,0.35)',
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E11414',
  },
  dividerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: lu.fonts.bodyMedium,
    includeFontPadding: false,
    marginHorizontal: 2,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: lu.spacing.sm,
  },
  registerCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: lu.spacing.sm,
    paddingVertical: 12,
  },
  linkMuted: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  linkAccent: {
    fontSize: 14,
    color: '#FF4D5A',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
});
