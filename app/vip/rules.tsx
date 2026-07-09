/**
 * قواعد VIP — مطابقة شاشة المنافس
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useConfig } from '@/contexts/ConfigContext';
import { VIP_DESIGN } from '@/components/vip/vipDesign';
import { WlBackIcon } from '@/components/wealthLevel/WealthLevelDesignIcons';
import { lu } from '@/theme/lu-brand';

function SectionDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerDiamond} />
      <View style={styles.dividerLine} />
    </View>
  );
}

export default function VipRulesScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vipSystem } = useConfig();

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...VIP_DESIGN.header]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          <WlBackIcon size={18} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>{t('vipHub.rulesTitle')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text weight="bold" style={styles.sectionTitle}>LinkUp VIP</Text>
        <SectionDivider />
        <Text style={styles.body}>{t('vipHub.rulesIntro')}</Text>

        <Text weight="bold" style={[styles.sectionTitle, { marginTop: 24 }]}>
          {t('vipHub.pointsTitle')}
        </Text>
        <SectionDivider />
        <Text style={styles.body}>{t('vipHub.pointsRule1')}</Text>
        <Text style={styles.body}>{t('vipHub.pointsRule2')}</Text>
        <Text style={styles.body}>{t('vipHub.pointsRule3')}</Text>
        <Text style={styles.body}>{t('vipHub.pointsRule4')}</Text>

        <Text weight="bold" style={[styles.sectionTitle, { marginTop: 24 }]}>
          {t('vipHub.levelTitle')}
        </Text>
        <SectionDivider />
        <Text style={styles.body}>{t('vipHub.levelIntro')}</Text>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text weight="bold" style={styles.th}>{t('vipHub.tableLevel')}</Text>
            <Text weight="bold" style={styles.th}>{isAr ? 'حد النقاط' : 'Points threshold'}</Text>
            <Text weight="bold" style={styles.th}>{isAr ? 'الاحتفاظ شهرياً' : 'Monthly maintain'}</Text>
          </View>
          {vipSystem.levels.map((lv) => (
            <View key={lv.level} style={styles.tableRow}>
              <Text style={styles.td}>{lv.label}</Text>
              <Text style={styles.td}>{(lv.priceCoins ?? 0).toLocaleString('en-US')}</Text>
              <Text style={styles.td}>{(lv.maintainPoints ?? 0).toLocaleString('en-US')}</Text>
            </View>
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
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  headerTitle: { fontSize: 17, color: VIP_DESIGN.ink },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 16,
    color: VIP_DESIGN.purple,
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: VIP_DESIGN.line },
  dividerDiamond: {
    width: 8,
    height: 8,
    backgroundColor: VIP_DESIGN.purpleMid,
    transform: [{ rotate: '45deg' }],
  },
  body: {
    fontSize: 13,
    lineHeight: 22,
    color: VIP_DESIGN.ink2,
    marginBottom: 10,
  },
  table: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: VIP_DESIGN.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: VIP_DESIGN.purpleSoft,
    paddingVertical: 10,
  },
  th: { flex: 1, textAlign: 'center', fontSize: 12, color: VIP_DESIGN.purple },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: VIP_DESIGN.line,
    paddingVertical: 9,
  },
  td: { flex: 1, textAlign: 'center', fontSize: 11, color: VIP_DESIGN.ink2 },
});
