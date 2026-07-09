/**
 * LinkUp — قواعد الأرستقراطية
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
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

function RuleBlock({ title, rules }: { title: string; rules: string[] }) {
  if (!rules.length) return null;
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <View style={styles.line} />
        <Text style={styles.blockTitle}>{title}</Text>
        <View style={styles.line} />
      </View>
      {rules.map((r, i) => (
        <Text key={i} style={styles.ruleLine}>
          {i + 1}. {r}
        </Text>
      ))}
    </View>
  );
}

export default function AristocracyRulesScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { aristocracy: config } = useConfig();
  const isAr = i18n.language?.startsWith('ar');

  const sections = useMemo(
    () => [
      { title: t('aristocracy.rulesIntro'), rules: isAr ? config.rulesIntroAr : config.rulesIntroEn },
      { title: t('aristocracy.rulesPurchase'), rules: isAr ? config.rulesPurchaseAr : config.rulesPurchaseEn },
      { title: t('aristocracy.rulesRewards'), rules: isAr ? config.rulesRewardsAr : config.rulesRewardsEn },
      { title: t('aristocracy.rulesLegend'), rules: isAr ? config.rulesLegendAr : config.rulesLegendEn },
      { title: t('aristocracy.experienceCard'), rules: isAr ? config.experienceCardRulesAr : config.experienceCardRulesEn },
    ],
    [config, isAr, t],
  );

  const priceLevels = config.levels.filter((l) => !l.comingSoon && l.enabled);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={['#3A0A0A', '#1A0A0C', '#0E0E11']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('aristocracy.rulesPageTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((s) => (
          <RuleBlock key={s.title} title={s.title} rules={s.rules} />
        ))}

        <View style={styles.block}>
          <Text style={styles.tableTitle}>
            {isAr ? config.levelTableNoteAr : config.levelTableNoteEn}
          </Text>
          <View style={styles.table}>
            <View style={styles.tableRowHead}>
              <Text style={[styles.cell, styles.cellHead]}>{t('aristocracy.rank')}</Text>
              <Text style={[styles.cell, styles.cellHead]}>{t('aristocracy.activate')}</Text>
              <Text style={[styles.cell, styles.cellHead]}>{t('aristocracy.renew')}</Text>
            </View>
            {priceLevels.map((lv) => (
              <View key={lv.id} style={styles.tableRow}>
                <Text style={styles.cell}>{isAr ? lv.nameAr : lv.nameEn}</Text>
                <Text style={styles.cell}>{lv.activationCoins.toLocaleString('en-US')}</Text>
                <Text style={styles.cell}>{lv.renewalCoins.toLocaleString('en-US')}</Text>
              </View>
            ))}
          </View>
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFD700' },
  scroll: { paddingHorizontal: 16 },
  block: { marginBottom: 20 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,215,0,0.25)' },
  blockTitle: { color: '#FFD700', fontWeight: '800', fontSize: 14 },
  ruleLine: { color: '#fff', fontSize: 13, lineHeight: 22, marginBottom: 8, textAlign: 'right' },
  tableTitle: { color: '#FFD700', fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tableRowHead: { flexDirection: 'row', backgroundColor: 'rgba(255,215,0,0.15)' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  cell: { flex: 1, padding: 10, color: '#fff', fontSize: 11, textAlign: 'center' },
  cellHead: { fontWeight: '800', color: '#FFD700' },
});
