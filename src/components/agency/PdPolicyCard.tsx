/**
 * بطاقة سياسة الـ BD — مركز BD
 *
 * جدول نِسَب التحصيل حسب دخل الوكالة الشهري (مطابق للسياسة الرسمية).
 * يظهر داخل شاشة مركز BD عبر جميع الحالات.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Info } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';
import { lu } from '@/theme/lu-brand';
import { radius } from '@/theme';

/** صفوف السياسة الثابتة (دخل الوكالة الشهري → النسبة) */
const ROWS: { income: string; rate: string }[] = [
  { income: '5,000,000 – 10,000,000', rate: '5%' },
  { income: '10,000,001 – 20,000,000', rate: '7.5%' },
  { income: '20,000,001 – 40,000,000', rate: '10%' },
  { income: '+50,000,000', rate: '15%' },
];

function IncomeWithCoin({ value }: { value: string }) {
  return (
    <View style={styles.incomeValueRow}>
      <Text variant="bodySmall" weight="bold" color={lu.colors.ink} align="center">
        {value}
      </Text>
      <Image
        source={WALLET_ASSETS.coin}
        style={styles.coinIconRow}
        contentFit="contain"
      />
    </View>
  );
}

export default function PdPolicyCard() {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      {/* رأس البطاقة بتدرّج الهوية */}
      <LinearGradient
        colors={lu.gradients.pink}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.head}
      >
        <Text variant="h4" weight="bold" color="#fff" align="center">
          {t('pdPolicy.title')}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.92)" align="center" style={{ marginTop: 2 }}>
          {t('pdPolicy.subtitle')}
        </Text>
      </LinearGradient>

      {/* جدول النِّسَب */}
      <View style={styles.table}>
        {/* رأس الأعمدة */}
        <View style={[styles.row, styles.headerRow]}>
          <View style={[styles.incomeCell, styles.incomeHeadCell]}>
            <Image
              source={WALLET_ASSETS.coin}
              style={styles.coinIcon}
              contentFit="contain"
            />
            <Text variant="bodySmall" weight="bold" color={lu.colors.ink} align="center">
              {t('pdPolicy.colIncome')}
            </Text>
          </View>
          <View style={styles.rateCell}>
            <Text variant="bodySmall" weight="bold" color={lu.colors.ink} align="center">
              {t('pdPolicy.colRate')}
            </Text>
          </View>
        </View>

        {ROWS.map((r, i) => (
          <View
            key={r.rate}
            style={[styles.row, i % 2 === 1 && styles.rowAlt, i === ROWS.length - 1 && styles.rowLast]}
          >
            <View style={styles.incomeCell}>
              <IncomeWithCoin value={r.income} />
            </View>
            <View style={styles.rateCell}>
              <View style={styles.ratePill}>
                <Text variant="caption" weight="bold" color={lu.colors.gold2}>
                  {r.rate}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* ملاحظة */}
      <View style={styles.note}>
        <Info size={15} color={lu.colors.purple} strokeWidth={2.2} />
        <Text variant="caption" color={lu.colors.ink2} style={styles.noteText}>
          {t('pdPolicy.note')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: lu.colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lu.colors.line,
    overflow: 'hidden',
  },
  head: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  table: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
  },
  headerRow: {
    backgroundColor: lu.colors.card2,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  rowAlt: {
    backgroundColor: lu.colors.bg2,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  incomeCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: lu.colors.line,
  },
  incomeHeadCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coinIcon: {
    width: 18,
    height: 18,
  },
  coinIconRow: {
    width: 16,
    height: 16,
  },
  incomeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  rateCell: {
    width: 92,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: lu.colors.goldSoft,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
  noteText: {
    flex: 1,
    lineHeight: 19,
  },
});
