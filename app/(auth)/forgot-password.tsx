/**
 * LinkUp App — Forgot Password Screen
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Send, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react-native';

import { useAuth } from '@/hooks/useAuth';
import { AuthShell, AuthField, AuthPrimaryButton } from '@/components/auth';
import { lu } from '@/theme/lu-brand';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { resetPassword, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSend = async () => {
    if (!isValidEmail) {
      Alert.alert(t('roomSettings.text32386'), t('auth.emailInvalid'));
      return;
    }

    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      Alert.alert(t('chat.sendFailed'), e.message);
    }
  };

  return (
    <AuthShell
      title={t('auth.forgotPassword')}
      subtitle={sent ? t('auth.checkEmail') : t('auth.text16959')}
    >
      {!sent ? (
        <>
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <KeyRound size={20} color={lu.colors.purple} strokeWidth={2.2} />
            </View>
            <Text style={styles.tipText}>{t('auth.forgotPasswordTip')}</Text>
          </View>

          <AuthField
            label={t('auth.emailLabel')}
            icon={<Mail size={18} color={lu.colors.muted} strokeWidth={2} />}
            value={email}
            onChangeText={setEmail}
            placeholder="example@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textAlign="left"
          />

          <AuthPrimaryButton
            label={t('auth.text22426')}
            onPress={handleSend}
            disabled={!isValidEmail}
            loading={isLoading}
            icon={<Send size={20} color={lu.colors.onGrad} strokeWidth={2.5} />}
          />

          <Pressable
            onPress={() => router.replace('/(auth)/login' as any)}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>{t('auth.text36261')}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.success}>
          <View style={styles.successRing}>
            <LinearGradient
              colors={[...lu.gradients.brandSoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successRingGrad}
            />
            <View style={styles.successIcon}>
              <CheckCircle2 size={48} color={lu.colors.mint} strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.successTitle}>{t('auth.text6228')}</Text>
          <Text style={styles.successIntro}>{t('auth.resetEmailSentIntro')}</Text>

          <View style={styles.emailPill}>
            <ShieldCheck size={16} color={lu.colors.purple} strokeWidth={2.2} />
            <Text style={styles.emailText} numberOfLines={2}>
              {email.trim()}
            </Text>
          </View>

          <Text style={styles.successHint}>{t('auth.resetEmailSentHint')}</Text>

          <AuthPrimaryButton
            label={t('auth.text36261')}
            onPress={() => router.replace('/(auth)/login' as any)}
          />

          <Pressable
            onPress={() => {
              setSent(false);
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>{t('auth.text7728')}</Text>
          </Pressable>
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: lu.spacing.sm,
    padding: lu.spacing.md,
    marginBottom: lu.spacing.base,
    backgroundColor: lu.colors.purpleSoft,
    borderRadius: lu.radius.sm,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: lu.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },

  backLink: {
    alignItems: 'center',
    paddingVertical: lu.spacing.base,
    marginTop: lu.spacing.xs,
  },
  backLinkText: {
    fontSize: 14,
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },

  success: {
    alignItems: 'center',
    paddingVertical: lu.spacing.sm,
  },
  successRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: lu.spacing.lg,
  },
  successRingGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 52,
    opacity: 0.35,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(43,217,168,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(43,217,168,0.25)',
  },
  successTitle: {
    fontSize: 22,
    color: lu.colors.ink,
    fontFamily: lu.fonts.displaySemi,
    textAlign: 'center',
    includeFontPadding: false,
  },
  successIntro: {
    marginTop: lu.spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
    textAlign: 'center',
    includeFontPadding: false,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: lu.spacing.sm,
    marginTop: lu.spacing.md,
    marginBottom: lu.spacing.sm,
    paddingVertical: lu.spacing.sm,
    paddingHorizontal: lu.spacing.md,
    backgroundColor: lu.colors.card2,
    borderRadius: lu.radius.pill,
    borderWidth: 1,
    borderColor: lu.colors.line,
    maxWidth: '100%',
  },
  emailText: {
    flexShrink: 1,
    fontSize: 14,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  successHint: {
    marginBottom: lu.spacing.lg,
    fontSize: 13,
    lineHeight: 20,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
    textAlign: 'center',
    includeFontPadding: false,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: lu.spacing.base,
    paddingVertical: lu.spacing.sm,
  },
  retryText: {
    fontSize: 14,
    color: lu.colors.pink,
    fontFamily: lu.fonts.bodyBold,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
