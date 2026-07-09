/**
 * LinkUp App — Login with Account ID + Password
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Hash, Lock, Eye, EyeOff, LogIn } from 'lucide-react-native';

import { useAuth } from '@/hooks/useAuth';
import { AuthShell, AuthField, AuthPrimaryButton } from '@/components/auth';
import { normalizePublicId } from '@/services/publicAccountIndex';
import { lu } from '@/theme/lu-brand';

export default function LoginWithIdScreen() {
  const { t, i18n } = useTranslation();
  const linkDir = { flexDirection: ('row') as 'row' | 'row-reverse' };
  const router = useRouter();
  const { loginWithAccountId, isLoading } = useAuth();

  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const normalizedId = normalizePublicId(accountId);
  const isValidId = normalizedId.length === 8;
  const canSubmit = isValidId && password.length >= 6 && !isLoading;

  const handleAccountIdChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    setAccountId(digits);
  };

  const resolveErrorMessage = (code: string) => {
    switch (code) {
      case 'INVALID_ACCOUNT_ID':
        return t('auth.accountIdInvalid');
      case 'ACCOUNT_ID_NOT_FOUND':
        return t('auth.accountIdNotFound');
      case 'ACCOUNT_NO_EMAIL':
        return t('auth.accountIdNoEmail');
      default:
        if (code.includes('كلمة المرور') || code.includes('البريد')) return code;
        return code;
    }
  };

  const handleLogin = async () => {
    if (!canSubmit) {
      if (!isValidId) {
        Alert.alert(t('common.error'), t('auth.accountIdInvalid'));
      } else if (password.length < 6) {
        Alert.alert(t('common.error'), t('auth.passwordMinLen'));
      }
      return;
    }

    try {
      await loginWithAccountId(accountId, password);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      Alert.alert(t('auth.loginFailed'), resolveErrorMessage(e.message));
    }
  };

  return (
    <AuthShell
      title={t('auth.loginWithIdTitle')}
      subtitle={t('auth.loginWithIdSubtitle')}
    >
      <View style={styles.tipCard}>
        <Text style={styles.tipText}>{t('auth.loginWithIdHint')}</Text>
      </View>

      <AuthField
        label={t('auth.accountIdLoginLabel')}
        icon={<Hash size={18} color={lu.colors.muted} strokeWidth={2} />}
        value={accountId}
        onChangeText={handleAccountIdChange}
        placeholder="12345678"
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={8}
        textAlign="left"
      />

      <AuthField
        label={t('auth.passwordLabel')}
        icon={<Lock size={18} color={lu.colors.muted} strokeWidth={2} />}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry={!showPassword}
        autoComplete="password"
        textAlign="left"
        trailing={
          showPassword ? (
            <EyeOff size={18} color={lu.colors.muted} strokeWidth={2} />
          ) : (
            <Eye size={18} color={lu.colors.muted} strokeWidth={2} />
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
        <Text style={styles.dividerText}>{t('auth.text52428')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={() => router.push('/(auth)/login' as any)}
        style={[styles.linkRow, linkDir]}
      >
        <Text style={styles.linkMuted}>{t('auth.loginWithEmailInstead')} </Text>
        <Text style={styles.linkAccent}>{t('auth.signIn')}</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(auth)/register' as any)}
        style={[styles.linkRowSecondary, linkDir]}
      >
        <Text style={styles.linkMuted}>{t('auth.dontHaveAccount')} </Text>
        <Text style={styles.linkAccent}>{t('auth.text46120')}</Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  tipCard: {
    padding: lu.spacing.md,
    marginBottom: lu.spacing.base,
    backgroundColor: lu.colors.card2,
    borderRadius: lu.radius.sm,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
    textAlign: 'center',
    includeFontPadding: false,
  },
  forgotBtn: {
    alignSelf: 'flex-start',
    paddingVertical: lu.spacing.sm,
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13,
    color: lu.colors.purple,
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
    backgroundColor: lu.colors.line,
  },
  dividerText: {
    fontSize: 12,
    color: lu.colors.muted,
    fontFamily: lu.fonts.bodyMedium,
    includeFontPadding: false,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: lu.spacing.sm,
  },
  linkRowSecondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: lu.spacing.xs,
  },
  linkMuted: {
    fontSize: 14,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  linkAccent: {
    fontSize: 14,
    color: lu.colors.pink,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
});
