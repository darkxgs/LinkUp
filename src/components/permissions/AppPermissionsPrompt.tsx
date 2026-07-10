/**
 * طلب صلاحيات التطبيق بعد تسجيل الدخول — ميكروفون، كاميرا، صور، إشعارات
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, Camera, Image as ImageIcon, Bell, ShieldCheck, MapPin } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  hasPromptedAppPermissions,
  markAppPermissionsPrompted,
  requestAllAppPermissions,
} from '@/services/permissions';
import { updateUserLocation } from '@/services/locationService';
import { getNotificationSettings } from '@/services/firebase/notificationSettings';
import { setPushNotificationsEnabled } from '@/services/firebase/pushNotifications';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

const PERMISSION_ITEMS = [
  { key: 'microphone', Icon: Mic, color: '#E11414' },
  { key: 'camera', Icon: Camera, color: '#C40E1E' },
  { key: 'photos', Icon: ImageIcon, color: '#D97706' },
  { key: 'notifications', Icon: Bell, color: '#10B981' },
  { key: 'location', Icon: MapPin, color: '#2563EB' },
] as const;

export function AppPermissionsPrompt() {
  const { t } = useTranslation();
  const uid = useAuthStore((s) => s.user?.uid);
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!uid || Platform.OS === 'web') {
      setVisible(false);
      setChecked(false);
      return;
    }

    let cancelled = false;
    setChecked(false);

    void (async () => {
      const prompted = await hasPromptedAppPermissions(uid);
      if (cancelled) return;
      setVisible(!prompted);
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const finish = useCallback(async () => {
    if (!uid) return;
    await markAppPermissionsPrompted(uid);
    setVisible(false);
  }, [uid]);

  const handleAllowAll = useCallback(async () => {
    if (!uid || requesting) return;
    setRequesting(true);
    // مهلة لكل خطوة — على بعض الأجهزة (Infinix وغيرها) يعلق طلب صلاحية
    // أو جلب الموقع بلا حسم فيظل السبينر للأبد ويحتجز المستخدم
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
    try {
      await withTimeout(requestAllAppPermissions(), 25_000);
      const settings = await withTimeout(getNotificationSettings(uid), 6_000);
      if (settings) {
        await withTimeout(
          setPushNotificationsEnabled(uid, settings.pushEnabled !== false).catch(() => {}),
          6_000,
        );
      }
      await withTimeout(updateUserLocation(true).catch(() => {}), 8_000);
    } finally {
      setRequesting(false);
      await finish();
    }
  }, [finish, requesting, uid]);

  const handleLater = useCallback(async () => {
    if (requesting) return;
    await finish();
  }, [finish, requesting]);

  if (!checked || !visible) return null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconHero}
          >
            <ShieldCheck size={32} color="#fff" strokeWidth={2.2} />
          </LinearGradient>

          <Text variant="h3" weight="bold" align="center" style={styles.title}>
            {t('permissions.onboarding.title')}
          </Text>
          <Text variant="bodySmall" color={lu.colors.ink2} align="center" style={styles.subtitle}>
            {t('permissions.onboarding.subtitle')}
          </Text>

          <View style={styles.list}>
            {PERMISSION_ITEMS.map(({ key, Icon, color }) => (
              <View key={key} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: `${color}18` }]}>
                  <Icon size={18} color={color} strokeWidth={2.2} />
                </View>
                <View style={styles.rowText}>
                  <Text variant="bodySmall" weight="bold">
                    {t(`permissions.onboarding.items.${key}.title`)}
                  </Text>
                  <Text variant="caption" color={lu.colors.ink2}>
                    {t(`permissions.onboarding.items.${key}.hint`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => void handleAllowAll()}
            disabled={requesting}
            // alignSelf: stretch — بدونه كان الزر ينكمش لعرض المحتوى فيظهر
            // كحبة رفيعة مشوّهة بدل زر بعرض البطاقة
            style={({ pressed }) => [
              { alignSelf: 'stretch', opacity: pressed || requesting ? 0.88 : 1 },
            ]}
          >
            <LinearGradient
              colors={lu.gradients.pink}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              {requesting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="body" weight="bold" color="#fff">
                  {t('permissions.onboarding.allowAll')}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => void handleLater()} disabled={requesting} style={styles.laterBtn}>
            <Text variant="bodySmall" weight="semibold" color={lu.colors.muted}>
              {t('permissions.onboarding.later')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  iconHero: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: lu.colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    marginBottom: spacing.md,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  list: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: lu.colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
