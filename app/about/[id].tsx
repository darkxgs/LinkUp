/**
 * عرض محتوى قسم من «حول التطبيق»
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useConfig } from '@/contexts/ConfigContext';
import { getAboutSection } from '@/services/firebase/aboutPages';
import { colors, radius, spacing, shadows } from '@/theme';

export default function AboutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { aboutPages } = useConfig();
  const isAr = i18n.language?.startsWith('ar');

  const section = useMemo(
    () => (id ? getAboutSection(aboutPages, id) : undefined),
    [aboutPages, id],
  );

  const title = section ? (isAr ? section.titleAr : section.titleEn) : '';
  const content = section ? (isAr ? section.contentAr : section.contentEn) : '';
  const paragraphs = content.split('\n').map((p) => p.trim()).filter(Boolean);

  const openExternal = () => {
    const url = section?.externalUrl;
    if (url?.startsWith('http')) {
      Linking.openURL(url).catch(() => {
        Alert.alert(t('common.error'), 'تعذر فتح الرابط');
      });
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FCDDDD', '#FEE2E2', '#fff']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1A0A0C" strokeWidth={2.5} />
        </Pressable>
        <Text variant="h3" weight="bold" color="#1A0A0C" style={styles.headerTitle} numberOfLines={1}>
          {title || t('profile.aboutApp')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {paragraphs.length > 0 ? (
            paragraphs.map((para, i) => (
              <Text key={i} variant="body" color="#374151" style={styles.para}>
                {para}
              </Text>
            ))
          ) : (
            <Text variant="body" color="#9CA3AF" align="center" style={{ paddingVertical: 24 }}>
              {isAr ? 'لم يُضف محتوى لهذا القسم بعد' : 'No content added for this section yet'}
            </Text>
          )}

          {section?.externalUrl?.startsWith('http') && (
            <Pressable onPress={openExternal} style={styles.linkBtn}>
              <Text variant="button" color={colors.brand.primary} weight="bold">
                {isAr ? 'فتح الرابط الكامل' : 'Open full link'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { padding: spacing.base },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  para: { lineHeight: 26, marginBottom: 14 },
  linkBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
});
