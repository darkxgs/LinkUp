/**
 * إنهاءات مهام المضيفين — للوكيل
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Users, Search, Gem } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import {
  getAgencyHostCompletions,
  type AgencyHostCompletionRow,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';

function fmt(n: number) {
  return Number(n).toLocaleString('en-US');
}

export default function AgencyHostCompletionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [todayCompletions, setTodayCompletions] = useState(0);
  const [cycleEndsAt, setCycleEndsAt] = useState(0);
  const [hosts, setHosts] = useState<AgencyHostCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const res = await getAgencyHostCompletions(debounced || undefined);
    setTotalCompletions(res.totalCompletions);
    setTodayCompletions(res.todayCompletions);
    setCycleEndsAt(res.cycleEndsAt);
    setHosts(res.hosts);
  }, [debounced]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cycleEndLabel = cycleEndsAt
    ? new Date(cycleEndsAt).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'short' })
    : '—';

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          <BackChevron color={lu.colors.ink} size={22} />
        </Pressable>
        <Text weight="bold" style={styles.headTitle}>بيانات المذيعين</Text>
        <View style={styles.headBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
        }
      >
        <Text variant="caption" color={lu.colors.ink2} align="center">
          هذه الدورة تُنهي الوكالة: {cycleEndLabel}
        </Text>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>عدد مرات الإنهاء</Text>
          <View style={styles.statRow}>
            {todayCompletions > 0 && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayText}>اليوم {todayCompletions}</Text>
              </View>
            )}
            <Users size={22} color="#EA580C" />
            <Text weight="bold" style={styles.statValue}>{totalCompletions}</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="أدخل معرف المستخدم"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={lu.colors.purple} style={{ marginTop: 32 }} />
        ) : hosts.length === 0 ? (
          <View style={styles.empty}>
            <Search size={40} color="#D1D5DB" strokeWidth={1.5} />
            <Text variant="caption" color={lu.colors.ink2} style={{ marginTop: 12 }}>
              لا يوجد مزيد من البيانات
            </Text>
          </View>
        ) : (
          hosts.map((h) => (
            <View key={h.uid} style={styles.hostRow}>
              {h.avatar ? (
                <Image source={{ uri: h.avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]} />
              )}
              <View style={{ flex: 1 }}>
                <Text weight="semibold" numberOfLines={1}>{h.name}</Text>
                <Text variant="caption" color={lu.colors.ink2}>
                  {h.publicAccountId || h.uid.slice(0, 10)}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text weight="bold" style={{ color: '#EA580C' }}>{h.completions} إنهاء</Text>
                <View style={styles.pearlRow}>
                  <Gem size={12} color={lu.colors.purple} />
                  <Text variant="caption">{fmt(h.pearlsThisWeek)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
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
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F5E6D8',
  },
  statLabel: { fontSize: 13, color: lu.colors.ink2, textAlign: 'right', marginBottom: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  statValue: { fontSize: 28, color: lu.colors.ink },
  todayBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  todayText: { fontSize: 11, color: '#EA580C', fontFamily: lu.fonts.bodyBold },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F0E6D8',
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: lu.colors.ink, textAlign: 'right' },
  empty: { alignItems: 'center', marginTop: 48, opacity: 0.8 },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarEmpty: { backgroundColor: '#FEE2E2' },
  metaCol: { alignItems: 'flex-end', gap: 4 },
  pearlRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
