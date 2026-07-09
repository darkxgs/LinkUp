/**
 * فحص إصدار APK من لوحة التحكم — تحديث إجباري أو اختياري على Android
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { LINKUP_ID_LOGO } from '@/constants/brandAssets';
import { useConfig } from '@/contexts/ConfigContext';
import { evaluateAppUpdate, getUpdatePageUrl } from '@/services/firebase/appRelease';
import { getInstalledVersionCode } from '@/utils/appVersion';
import { lu } from '@/theme/lu-brand';

export function AppUpdateGate() {
  const { t, i18n } = useTranslation();
  const { appRelease, loading } = useConfig();
  const insets = useSafeAreaInsets();
  const [dismissedCode, setDismissedCode] = useState<number | null>(null);

  const installedCode = getInstalledVersionCode();
  const check = useMemo(
    () => evaluateAppUpdate(appRelease, installedCode),
    [appRelease, installedCode],
  );

  if (Platform.OS !== 'android') return null;
  if (loading) return null;
  if (!check.required && !check.optional) return null;
  if (check.optional && dismissedCode === appRelease.versionCode) return null;

  const isAr = i18n.language?.startsWith('ar');
  const title = isAr ? appRelease.updateTitleAr : appRelease.updateTitleEn;
  const message = isAr ? appRelease.updateMessageAr : appRelease.updateMessageEn;
  const notes = isAr ? appRelease.releaseNotesAr : appRelease.releaseNotesEn;
  const updateUrl = getUpdatePageUrl(appRelease);

  const openUpdate = () => {
    if (!updateUrl) return;
    void Linking.openURL(updateUrl);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(46, 11, 11, 0.94)', 'rgba(105, 27, 27, 0.98)']}
        style={[styles.card, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.logoRing}>
          <Image source={LINKUP_ID_LOGO} style={styles.logo} contentFit="contain" />
        </View>

        <View style={styles.badge}>
          <Sparkles size={12} color={lu.colors.gold} />
          <Text variant="caption" color={lu.colors.gold} weight="bold">
            v{appRelease.versionName}
          </Text>
        </View>

        <Text variant="h2" color="#fff" weight="bold" align="center" style={{ marginTop: 16 }}>
          {title || t('appUpdate.title')}
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.85)" align="center" style={styles.body}>
          {message || t('appUpdate.message')}
        </Text>

        {notes?.trim() ? (
          <View style={styles.notesBox}>
            <Text variant="caption" color={lu.colors.gold} weight="bold" style={{ marginBottom: 6 }}>
              {t('appUpdate.whatsNew')}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.88)" style={{ lineHeight: 20 }}>
              {notes}
            </Text>
          </View>
        ) : null}

        <Text variant="caption" color="rgba(255,255,255,0.5)" align="center" style={{ marginBottom: 16 }}>
          {t('appUpdate.installedBuild', { code: installedCode })}
        </Text>

        <Pressable
          onPress={openUpdate}
          disabled={!updateUrl}
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }, !updateUrl && { opacity: 0.5 }]}
        >
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Download size={18} color="#fff" />
          <Text variant="button" color="#fff" weight="bold">
            {t('appUpdate.download')}
          </Text>
        </Pressable>

        {check.optional ? (
          <Pressable
            onPress={() => setDismissedCode(appRelease.versionCode)}
            style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.8 }]}
          >
            <Text variant="button" color="rgba(255,255,255,0.75)" weight="bold">
              {t('appUpdate.later')}
            </Text>
          </Pressable>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 10000,
    elevation: 100,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(252,211,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.28)',
  },
  body: {
    marginTop: 10,
    lineHeight: 24,
    paddingHorizontal: 4,
  },
  notesBox: {
    alignSelf: 'stretch',
    marginTop: 14,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnPrimary: {
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnGhost: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
