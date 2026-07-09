/**
 * LinkUp — عن اللقب
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useConfig } from '@/contexts/ConfigContext';
import { TITLES_DESIGN } from '@/components/titles/titlesDesign';

export default function TitlesAboutScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { titles: config } = useConfig();
  const isAr = i18n.language?.startsWith('ar');

  const pageTitle = isAr ? config.aboutPageTitleAr : config.aboutPageTitleEn;
  const useRules = isAr ? config.aboutUseAr : config.aboutUseEn;
  const badgeRules = isAr ? config.aboutBadgeAr : config.aboutBadgeEn;

  const vipSlots = useMemo(
    () => config.slots.filter((s) => s.unlockType === 'vip'),
    [config.slots],
  );
  const wealthSlots = useMemo(
    () => config.slots.filter((s) => s.unlockType === 'wealth'),
    [config.slots],
  );

  return (
    <View style={styles.fill}>
      <LinearGradient colors={['#3A0A0A', '#1A0A0C']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{pageTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHead}>● {t('titles.aboutUse')} ●</Text>
        {useRules.map((line, i) => (
          <Text key={i} style={styles.para}>{line}</Text>
        ))}

        <Text style={[styles.sectionHead, { marginTop: 20 }]}>● {t('titles.aboutBadge')} ●</Text>
        {badgeRules.map((line, i) => (
          <Text key={i} style={styles.para}>{line}</Text>
        ))}

        <View style={styles.slotInfo}>
          <Text style={styles.slotInfoTitle}>{t('titles.slotUnlocks')}</Text>
          <Text style={styles.para}>
            {t('titles.defaultSlots', { count: config.defaultSlots })}
          </Text>
          {vipSlots.map((s) => (
            <Text key={s.slotIndex} style={styles.bullet}>
              • VIP {s.unlockValue}
            </Text>
          ))}
          {wealthSlots.map((s) => (
            <Text key={s.slotIndex} style={styles.bullet}>
              • {isAr ? `ثروة ${s.unlockValue}` : `Wealth Lv.${s.unlockValue}`}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  scroll: { paddingHorizontal: 20 },
  sectionHead: {
    color: TITLES_DESIGN.gold,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  para: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  slotInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: TITLES_DESIGN.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TITLES_DESIGN.cardBorder,
  },
  slotInfoTitle: { color: TITLES_DESIGN.gold, fontWeight: '800', marginBottom: 10 },
  bullet: { color: TITLES_DESIGN.ink2, fontSize: 13, marginBottom: 6 },
});
