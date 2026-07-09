/**
 * خط بيانات المضيفين — للوكيل
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Users, Gem, Info } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { SimpleLineChart } from '@/components/agency/SimpleLineChart';
import {
  getAgencyManagerAnalytics,
  type AgencyAnalyticsPeriod,
  type AgencyDataType,
  type AgencyIncomeFilter,
  type AgencyManagerAnalytics,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';

const PERIODS: { id: AgencyAnalyticsPeriod; label: string }[] = [
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'last_week', label: 'الأسبوع الماضي' },
  { id: '4weeks_day', label: '4 أسابيع (يومي)' },
  { id: '4weeks_week', label: '4 أسابيع (أسبوعي)' },
];

const DATA_TYPES: { id: AgencyDataType; label: string }[] = [
  { id: 'income', label: 'الدخل' },
  { id: 'people', label: 'عدد الأشخاص' },
];

const INCOME_TYPES: { id: AgencyIncomeFilter; label: string }[] = [
  { id: 'all', label: 'الجميع' },
  { id: 'chat', label: 'دردشة' },
  { id: 'gifts', label: 'هدايا' },
  { id: 'calls', label: 'مكالمات' },
  { id: 'refund', label: 'استرداد' },
  { id: 'other', label: 'أخرى' },
];

function fmt(n: number) {
  return Number(n).toLocaleString('en-US');
}

export default function AgencyHostChartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<AgencyAnalyticsPeriod>('week');
  const [dataType, setDataType] = useState<AgencyDataType>('income');
  const [incomeType, setIncomeType] = useState<AgencyIncomeFilter>('all');
  const [data, setData] = useState<AgencyManagerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getAgencyManagerAnalytics({ period, dataType, incomeType });
      setData(res);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل البيانات');
    }
  }, [period, dataType, incomeType]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const chip = (active: boolean) => [
    styles.chip,
    active && styles.chipActive,
  ];

  const chipText = (active: boolean) => [
    styles.chipText,
    active && styles.chipTextActive,
  ];

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          <BackChevron color={lu.colors.ink} size={22} />
        </Pressable>
        <Text weight="bold" style={styles.headTitle}>خط بيانات المضيفين</Text>
        <View style={styles.headBtn} />
      </View>

      <Pressable
        onPress={() => router.push('/agency/host-completions' as any)}
        style={styles.linkBanner}
      >
        <Text weight="semibold" style={styles.linkBannerText}>
          معلومات وبيانات المذيعين
        </Text>
        <ChevronLeft size={18} color={lu.colors.gold2} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>نطاق التاريخ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {PERIODS.map((p) => (
            <Pressable key={p.id} onPress={() => setPeriod(p.id)} style={chip(period === p.id)}>
              <Text style={chipText(period === p.id)}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>نوع البيانات</Text>
        <View style={styles.chipRowWrap}>
          {DATA_TYPES.map((t) => (
            <Pressable key={t.id} onPress={() => setDataType(t.id)} style={chip(dataType === t.id)}>
              <Text style={chipText(dataType === t.id)}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {dataType === 'income' && (
          <>
            <Text style={styles.sectionLabel}>نوع الدخل</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {INCOME_TYPES.map((t) => (
                <Pressable key={t.id} onPress={() => setIncomeType(t.id)} style={chip(incomeType === t.id)}>
                  <Text style={chipText(incomeType === t.id)}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {loading ? (
          <ActivityIndicator color={lu.colors.purple} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text color={lu.colors.ink2} align="center" style={{ marginTop: 24 }}>{error}</Text>
        ) : data ? (
          <>
            <View style={styles.chartCard}>
              <View style={styles.totalRow}>
                <Users size={18} color={lu.colors.pink} />
                <Text weight="bold" style={styles.totalValue}>
                  {fmt(data.total)}{dataType === 'income' ? '' : ' مضيف'}
                </Text>
                {data.todayTotal > 0 && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayText}>اليوم {fmt(data.todayTotal)}</Text>
                  </View>
                )}
              </View>
              <SimpleLineChart
                data={data.series}
                valueSuffix={dataType === 'income' ? 'ماسة' : 'مضيف نشط'}
              />
            </View>

            <View style={styles.noteRow}>
              <Info size={14} color="#9CA3AF" />
              <Text variant="caption" color={lu.colors.ink2} style={{ flex: 1 }}>
                قد يتأخر تحديث أحدث البيانات اليوم قليلاً، يرجى التحلي بالصبر
              </Text>
            </View>

            <Text style={styles.sectionLabel}>تفاصيل دخل المضيفين</Text>
            {data.hosts.length === 0 ? (
              <Text variant="caption" color={lu.colors.ink2} align="center">لا يوجد مزيد من البيانات</Text>
            ) : (
              data.hosts.map((h) => (
                <View key={h.uid} style={styles.hostRow}>
                  {h.avatar ? (
                    <Image source={{ uri: h.avatar }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarEmpty]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" numberOfLines={1}>{h.name}</Text>
                    <Text variant="caption" color={lu.colors.ink2}>ID: {h.uid.slice(0, 8)}…</Text>
                  </View>
                  <View style={styles.earnCol}>
                    <Gem size={14} color={lu.colors.purple} />
                    <Text weight="bold">{fmt(h.earnings)}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#FFF9F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 17, color: lu.colors.ink },
  linkBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#FFF3D6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkBannerText: { color: '#B45309', fontSize: 14 },
  sectionLabel: {
    fontSize: 13,
    color: lu.colors.ink2,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'right',
    fontFamily: lu.fonts.bodySemi,
  },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0E6D8',
    marginEnd: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#FFE8D6', borderColor: '#FF9A5C' },
  chipText: { fontSize: 12, color: lu.colors.ink2, fontFamily: lu.fonts.bodySemi },
  chipTextActive: { color: '#EA580C' },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F5E6D8',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  totalValue: { fontSize: 22, color: lu.colors.ink },
  todayBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  todayText: { fontSize: 11, color: '#EA580C', fontFamily: lu.fonts.bodyBold },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: { backgroundColor: '#FEE2E2' },
  earnCol: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
