/**
 * لوحة إحصائيات المضيفة — ترتيبها في الوكالة وأبرز الشاحنين
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Gem, Crown, Users, Star, Gift } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import {
  getHostDashboardStats,
  type HostDashboardStats,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';

function fmt(n: number) {
  return Number(n).toLocaleString('en-US');
}

export default function HostStatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<HostDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getHostDashboardStats();
      setStats(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'تعذّر تحميل البيانات');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#E11414', '#C40E1E', '#E11414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.header}>
          <View style={styles.headBtnPlaceholder} />
          <Text weight="bold" style={styles.headTitle}>إحصائياتي</Text>
          <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
            <BackChevron color="#fff" size={22} />
          </Pressable>
        </View>

        {stats && (
          <View style={styles.agencyBadge}>
            <Text style={styles.agencyBadgeText}>{stats.agencyName}</Text>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={lu.colors.purple} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text color={lu.colors.ink2}>{error}</Text>
        </View>
      ) : stats ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* الأرصدة */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: lu.colors.purple + '33' }]}>
              <Gem size={22} color={lu.colors.purple} strokeWidth={2} />
              <Text style={styles.statValue}>{fmt(stats.availablePearls)}</Text>
              <Text style={styles.statLabel}>ماسة متاحة</Text>
            </View>
            <View style={[styles.statCard, { borderColor: lu.colors.pink + '33' }]}>
              <Crown size={22} color={lu.colors.pink} strokeWidth={2} />
              <Text style={styles.statValue}>{fmt(stats.pearlsEarned)}</Text>
              <Text style={styles.statLabel}>إجمالي المكتسب</Text>
            </View>
          </View>

          {/* الترتيب */}
          <View style={[styles.card, styles.rankCard]}>
            <Star size={28} color="#F59E0B" strokeWidth={2} fill="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text weight="bold" style={styles.rankText}>
                {stats.hostRank ? `#${stats.hostRank}` : '—'}
              </Text>
              <Text style={styles.rankSub}>
                ترتيبك بين {stats.totalFemaleHosts} مضيفة في الوكالة
              </Text>
            </View>
          </View>

          {/* أبرز الشاحنين */}
          {stats.topChargers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                <Gift size={15} color={lu.colors.pink} strokeWidth={2} /> أبرز الشاحنين (7 أيام)
              </Text>
              <View style={styles.card}>
                {stats.topChargers.map((c, i) => (
                  <View
                    key={c.uid}
                    style={[styles.chargerRow, i > 0 && styles.chargerBorder]}
                  >
                    <Text style={styles.chargerRank}>{i + 1}</Text>
                    {c.avatar ? (
                      <Image source={{ uri: c.avatar }} style={styles.chargerAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.chargerAvatar, styles.chargerAvatarEmpty]}>
                        <Users size={14} color={lu.colors.muted} />
                      </View>
                    )}
                    <Text style={styles.chargerName} numberOfLines={1}>{c.name}</Text>
                    <View style={styles.chargerGems}>
                      <Gem size={12} color={lu.colors.purple} strokeWidth={2} />
                      <Text weight="bold" style={styles.chargerTotal}>{fmt(c.total)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: lu.colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headBtnPlaceholder: { width: 38 },
  headTitle: { fontSize: 17, color: '#fff' },

  agencyBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 99,
    marginBottom: 4,
  },
  agencyBadgeText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  scroll: { paddingHorizontal: 14, paddingTop: 14, width: '100%', maxWidth: 680, alignSelf: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.base,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    ...lu.shadows.card,
  },
  statValue: {
    fontSize: 24,
    color: lu.colors.ink,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  statLabel: { fontSize: 11, color: lu.colors.ink2 },

  card: {
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.base,
    borderWidth: 1,
    borderColor: lu.colors.line,
    padding: 16,
    marginBottom: 12,
    ...lu.shadows.card,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderColor: '#F59E0B33',
  },
  rankText: { fontSize: 30, color: lu.colors.ink, fontFamily: lu.fonts.displayHeavy, includeFontPadding: false },
  rankSub: { fontSize: 12, color: lu.colors.ink2, marginTop: 2 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: lu.colors.ink,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  chargerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  chargerBorder: {
    borderTopWidth: 1,
    borderTopColor: lu.colors.line,
  },
  chargerRank: { fontSize: 12, fontWeight: '700', color: lu.colors.muted, width: 18, textAlign: 'center' },
  chargerAvatar: { width: 36, height: 36, borderRadius: 12 },
  chargerAvatarEmpty: { backgroundColor: lu.colors.bg2, alignItems: 'center', justifyContent: 'center' },
  chargerName: { flex: 1, fontSize: 13, color: lu.colors.ink },
  chargerGems: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chargerTotal: { fontSize: 13, color: lu.colors.purple },
});
