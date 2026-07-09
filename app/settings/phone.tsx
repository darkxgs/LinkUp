/**
 * ربط رقم الهاتف — يحفظ في Firestore
 */
import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import { getSecurityProfile, updatePhoneNumber } from '@/services/accountSecurity';
import { lu } from '@/theme/lu-brand';

export default function LinkPhoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getSecurityProfile(user.uid).then((p) => {
      if (p.phoneNumber) setPhone(p.phoneNumber);
    });
  }, [user?.uid]);

  const handleSave = async () => {
    const trimmed = phone.trim();
    if (trimmed.length < 8 || !/^\+?[\d\s-]{8,}$/.test(trimmed)) {
      Alert.alert(t('common.error'), t('accountSecurity.invalidPhone'));
      return;
    }
    if (!user?.uid) {
      Alert.alert(t('common.error'), t('accountSecurity.loginRequired'));
      return;
    }
    setBusy(true);
    try {
      await updatePhoneNumber(user.uid, trimmed);
      Alert.alert(t('common.success'), t('accountSecurity.phoneSaved'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackChevron size={26} color={lu.colors.ink} />
        </Pressable>
        <Text variant="h3" weight="bold">
          {t('accountSecurity.phoneTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Text variant="body" color={lu.colors.ink2} style={styles.hint}>
          {t('accountSecurity.phoneHint')}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={t('accountSecurity.phonePlaceholder')}
          placeholderTextColor={lu.colors.muted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textAlign={I18nManager.isRTL ? 'right' : 'left'}
        />
        <Pressable
          onPress={handleSave}
          disabled={busy}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text variant="button" weight="bold" color="#fff">
              {t('accountSecurity.savePhone')}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lu.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 24 },
  hint: { marginBottom: 16, lineHeight: 22 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: lu.colors.ink,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  saveBtn: {
    marginTop: 24,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
