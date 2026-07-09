/**
 * LinkUp App — About Screen
 * شاشة "حول التطبيق" — الأقسام من config/aboutPages
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { radius, spacing, shadows } from '@/theme';
import { useConfig } from '@/contexts/ConfigContext';
import { getEnabledAboutSections, type AboutPageSection } from '@/services/firebase/aboutPages';
import { LINKUP_ID_LOGO } from '@/constants/brandAssets';

export default function AboutScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { aboutPages } = useConfig();
  const isAr = i18n.language?.startsWith('ar');

  const sections = getEnabledAboutSections(aboutPages);

  const handleSectionPress = (section: AboutPageSection) => {
    if (section.actionType === 'support') {
      router.push('/support' as any);
      return;
    }
    if (section.actionType === 'url' && section.externalUrl?.startsWith('http')) {
      Linking.openURL(section.externalUrl).catch(() => {
        Alert.alert(t('common.error') || 'خطأ', 'تعذر فتح الرابط');
      });
      return;
    }
    router.push(`/about/${section.id}` as any);
  };

  const label = (section: AboutPageSection) =>
    isAr ? section.titleAr : section.titleEn;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(225, 20, 20, 0.12)', 'rgba(240, 242, 245, 0)']}
        style={styles.headerBg}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1A0A0C" strokeWidth={2.5} />
        </Pressable>
        <Text variant="h3" weight="bold" color="#1A0A0C">
          {t('profile.aboutApp')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.base }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.logoSection}>
          <View style={styles.logoGlow} />
          <View style={styles.logoFrame}>
            <Image source={LINKUP_ID_LOGO} style={styles.logoImg} contentFit="contain" />
          </View>
          <Text variant="h3" weight="bold" color="#111827" style={{ marginTop: 20 }}>
            LinkUp
          </Text>
          <Text variant="caption" weight="semibold" color="#9CA3AF" style={{ marginTop: 4, letterSpacing: 1 }}>
            VERSION {aboutPages.appVersion}
          </Text>
        </View>

        <View style={styles.linksList}>
          {sections.map((section, idx) => (
            <Pressable
              key={section.id}
              onPress={() => handleSectionPress(section)}
              style={({ pressed }) => [
                styles.linkRow,
                pressed && { backgroundColor: '#F9FAFC', transform: [{ scale: 0.98 }] }
              ]}
            >
              <View style={styles.iconDot} />
              <Text variant="body" weight="semibold" color="#374151" style={{ flex: 1 }}>
                {label(section)}
              </Text>
              <ChevronLeft size={20} color="#D1D5DB" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  headerBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 350,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  scrollContent: { paddingHorizontal: 0 },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 16,
  },
  logoGlow: {
    position: 'absolute',
    top: 40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(225, 20, 20, 0.2)',
    filter: 'blur(20px)',
  },
  logoFrame: {
    width: 140,
    height: 140,
    borderRadius: 36,
    backgroundColor: '#0F0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  linksList: {
    paddingHorizontal: 20,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11414',
    marginEnd: 16,
    opacity: 0.8,
  },
});
