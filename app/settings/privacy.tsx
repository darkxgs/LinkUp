/**
 * LinkUp — إعدادات الخصوصية (VIP / أرستقراطية)
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { lu } from '@/theme/lu-brand';
import {
  subscribePrivacySettings,
  updatePrivacySettings,
  resolvePrivacyFeatures,
  canUsePrivacyFeature,
  type PrivacySettings,
  type PrivacyFeatureKey,
  type PrivacyFeatureDefResolved,
} from '@/services/firebase/privacySettings';
import { readAristocracyState, isAristocracyActive } from '@/services/firebase/aristocracySystem';
import { getEffectiveVipLevel } from '@/services/firebase/vipSystem';

export default function PrivacySettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { privacy: privacyConfig } = useConfig();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const isAr = i18n.language?.startsWith('ar');
  const pageTitle = isAr ? privacyConfig.titleAr : privacyConfig.titleEn;
  const intro = isAr ? privacyConfig.introAr : privacyConfig.introEn;
  const features = resolvePrivacyFeatures(privacyConfig) as PrivacyFeatureDefResolved[];

  const vipLevel = getEffectiveVipLevel(user);
  const aristo = readAristocracyState({
    aristocracy: user?.aristocracy,
    aristocracyLevel: user?.aristocracyLevel,
  });
  const aristocracyLevel = isAristocracyActive(aristo) ? aristo.level : 0;

  useEffect(() => {
    if (!user?.uid) return;
    return subscribePrivacySettings(user.uid, setSettings);
  }, [user?.uid]);

  const patch = async (key: PrivacyFeatureKey, value: boolean) => {
    if (!user?.uid) return;
    const feature = features.find((f) => f.key === key);
    if (!feature) return;

    const allowed = canUsePrivacyFeature(feature, { vipLevel, aristocracyLevel });
    if (!allowed) {
      Alert.alert(
        t('privacy.locked'),
        t(feature.lockLabelKey ?? 'privacy.locked'),
      );
      return;
    }

    setSettings((s) => (s ? { ...s, [key]: value } : s));
    try {
      await updatePrivacySettings(user.uid, { [key]: value });
    } catch {
      subscribePrivacySettings(user.uid, setSettings);
    }
  };

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={22} color={lu.colors.ink} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>{pageTitle || t('privacy.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {intro.map((line, i) => (
          <Text key={i} style={styles.intro}>{line}</Text>
        ))}
        {features.map((feature) => {
          const unlocked = canUsePrivacyFeature(feature, { vipLevel, aristocracyLevel });
          const value = settings?.[feature.key] ?? false;
          const label = (isAr ? feature.labelAr : feature.labelEn) || t(feature.labelKey);
          const lockText = (isAr ? feature.lockLabelAr : feature.lockLabelEn)
            || t(feature.lockLabelKey ?? 'privacy.locked');

          return (
            <View key={feature.key} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              {unlocked ? (
                <Switch
                  value={value}
                  onValueChange={(v) => patch(feature.key, v)}
                  trackColor={{ false: '#E5E7EB', true: lu.colors.pink }}
                  thumbColor="#fff"
                />
              ) : (
                <Pressable
                  style={styles.lockWrap}
                  onPress={() => Alert.alert(t('privacy.locked'), lockText)}
                >
                  <Text style={styles.lockText}>{lockText}</Text>
                  <Lock size={14} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 17, color: lu.colors.ink },
  scroll: { paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F2',
  },
  label: { flex: 1, fontSize: 15, color: lu.colors.ink },
  lockWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockText: { fontSize: 12, color: '#9CA3AF' },
  intro: {
    fontSize: 13,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingBottom: 8,
    lineHeight: 20,
  },
});
