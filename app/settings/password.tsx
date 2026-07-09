/**
 * كلمة المرور — تحقق / تغيير / تأكيد حذف الحساب
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import { ensurePublicAccountId } from '@/services/accountSecurity';
import { lu } from '@/theme/lu-brand';

type Intent = 'change' | 'delete';

export default function AccountPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const mode: Intent = intent === 'delete' ? 'delete' : 'change';

  const {
    user,
    verifyPassword,
    changePassword,
    requestAccountDeletionWithPassword,
    isLoading,
  } = useAuth();

  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'verify' | 'new'>('verify');
  const [showPassword, setShowPassword] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (user?.uid) {
      ensurePublicAccountId(user.uid).then(setAccountId);
    }
  }, [user?.uid]);

  const handleConfirm = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('accountSecurity.enterPassword'));
      return;
    }

    if (mode === 'delete') {
      setBusy(true);
      try {
        await requestAccountDeletionWithPassword(password);
        Alert.alert(
          t('common.success'),
          t('accountSecurity.deletionRequested'),
          [{ text: t('common.ok'), onPress: () => router.replace('/(auth)/welcome' as any) }],
        );
      } catch (e: any) {
        Alert.alert(t('common.error'), e.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === 'verify') {
      setBusy(true);
      try {
        await verifyPassword(password);
        setStep('new');
      } catch (e: any) {
        Alert.alert(t('common.error'), e.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('accountSecurity.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('accountSecurity.passwordMismatch'));
      return;
    }

    setBusy(true);
    try {
      await changePassword(password, newPassword);
      Alert.alert(t('common.success'), t('accountSecurity.passwordChanged'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    mode === 'delete'
      ? t('accountSecurity.verifyToDelete')
      : step === 'verify'
        ? t('accountSecurity.enterPassword')
        : t('accountSecurity.enterNewPassword');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <BackChevron size={26} color={lu.colors.ink} />
      </Pressable>

      <View style={styles.body}>
        <Text variant="body" style={styles.idLine}>
          {t('accountSecurity.yourId', { id: accountId || '—' })}
        </Text>

        {step === 'verify' ? (
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder={subtitle}
              placeholderTextColor={lu.colors.muted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              textAlign={I18nManager.isRTL ? 'right' : 'left'}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={22} color={lu.colors.muted} />
              ) : (
                <Eye size={22} color={lu.colors.muted} />
              )}
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.inputWrap, { marginBottom: 12 }]}>
              <TextInput
                style={styles.input}
                placeholder={t('accountSecurity.enterNewPassword')}
                placeholderTextColor={lu.colors.muted}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                textAlign={I18nManager.isRTL ? 'right' : 'left'}
              />
              <Pressable onPress={() => setShowNew((v) => !v)} style={styles.eyeBtn}>
                {showNew ? (
                  <EyeOff size={22} color={lu.colors.muted} />
                ) : (
                  <Eye size={22} color={lu.colors.muted} />
                )}
              </Pressable>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder={t('accountSecurity.confirmNewPassword')}
                placeholderTextColor={lu.colors.muted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                textAlign={I18nManager.isRTL ? 'right' : 'left'}
              />
            </View>
          </>
        )}

        <Pressable
          onPress={handleConfirm}
          disabled={busy || isLoading}
          style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={['#FFB199', '#FF9A6B', '#FF7A8A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {busy || isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text variant="button" weight="bold" color="#fff">
              {t('accountSecurity.confirm')}
            </Text>
          )}
        </Pressable>

        {mode === 'change' && (
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password' as any)}
            style={styles.forgotWrap}
          >
            <Text variant="body" color="#E88B6A" weight="medium">
              {t('accountSecurity.forgotPassword')}
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F5' },
  backBtn: {
    marginStart: 12,
    marginTop: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 48 },
  idLine: {
    textAlign: 'center',
    color: lu.colors.ink,
    marginBottom: 36,
    fontSize: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 20,
    minHeight: 56,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: lu.colors.ink,
    paddingVertical: 14,
  },
  eyeBtn: { padding: 4 },
  confirmBtn: {
    marginTop: 28,
    height: 54,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotWrap: { marginTop: 24, alignItems: 'center' },
});
