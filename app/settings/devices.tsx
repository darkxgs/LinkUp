/**
 * الأجهزة المسجّلة
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Smartphone, Monitor, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import {
  getRegisteredDevices,
  registerCurrentDevice,
  revokeRegisteredDevice,
  type RegisteredDevice,
} from '@/services/accountSecurity';
import { lu } from '@/theme/lu-brand';

function formatDate(ts: number, locale: string): string {
  try {
    return new Date(ts).toLocaleString(locale === 'ar' ? 'ar' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export default function RegisteredDevicesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await registerCurrentDevice(user.uid);
      const list = await getRegisteredDevices(user.uid);
      setDevices(list.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0)));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRevoke = (device: RegisteredDevice) => {
    if (!user?.uid) return;
    const title = device.isCurrent
      ? t('accountSecurity.revokeCurrentTitle')
      : t('accountSecurity.revokeDeviceTitle');
    const message = device.isCurrent
      ? t('accountSecurity.revokeCurrentBody')
      : t('accountSecurity.revokeDeviceBody', { name: device.name });

    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('accountSecurity.revokeAction'),
        style: 'destructive',
        onPress: async () => {
          setRevokingId(device.id);
          try {
            await revokeRegisteredDevice(user.uid, device.id);
            if (device.isCurrent) {
              await signOut();
              return;
            }
            setDevices((prev) => prev.filter((d) => d.id !== device.id));
            Alert.alert(t('common.success'), t('accountSecurity.revokeSuccess'));
          } catch (e: any) {
            Alert.alert(t('common.error'), e?.message ?? t('accountSecurity.revokeFailed'));
          } finally {
            setRevokingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackChevron size={26} color={lu.colors.ink} />
        </Pressable>
        <Text variant="h3" weight="bold">
          {t('accountSecurity.devicesTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <Text variant="caption" color={lu.colors.muted} style={styles.hint}>
        {t('accountSecurity.devicesHint')}
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={lu.colors.pink} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {devices.length === 0 ? (
            <Text variant="body" color={lu.colors.muted} align="center" style={{ marginTop: 32 }}>
              {t('accountSecurity.noDevices')}
            </Text>
          ) : (
            devices.map((d) => (
              <View key={d.id} style={styles.card}>
                <View style={styles.iconBg}>
                  {d.platform === 'ios' || d.platform === 'android' ? (
                    <Smartphone size={22} color={lu.colors.purple} />
                  ) : (
                    <Monitor size={22} color={lu.colors.purple} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">
                    {d.name}
                    {d.isCurrent ? ` (${t('accountSecurity.currentDevice')})` : ''}
                  </Text>
                  <Text variant="caption" color={lu.colors.muted} style={{ marginTop: 4 }}>
                    {t('accountSecurity.lastActive', {
                      date: formatDate(d.lastActiveAt, i18n.language),
                    })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRevoke(d)}
                  disabled={revokingId === d.id}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.removeBtn,
                    pressed && { opacity: 0.85 },
                    revokingId === d.id && { opacity: 0.5 },
                  ]}
                  accessibilityLabel={t('accountSecurity.revokeAction')}
                >
                  {revokingId === d.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Trash2 size={18} color="#EF4444" />
                  )}
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lu.colors.line,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
});
