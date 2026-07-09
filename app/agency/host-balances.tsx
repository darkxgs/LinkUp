/**
 * أرصدة المضيفات — للوكيل
 * يعرض ماسة كل مضيفة (المكتسب، المحوَّل، المتاح)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Gem, Crown, Users } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import {
  getAgencyMemberBalances,
  type AgencyMemberBalance,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';

function fmt(n: number) {
  return Number(n).toLocaleString('en-US');
}

export default function HostBalancesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<AgencyMemberBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getAgencyMemberBalances();
      setMembers(data);
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

  const totalAvailable = members.reduce((s, m) => s + m.availablePearls, 0);
  const totalEarned = members.reduce((s, m) => s + m.pearlsEarned, 0);

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
          <Text weight="bold" style={styles.headTitle}>أرصدة المضيفات</Text>
          <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
            <BackChevron color="#fff" size={22} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Gem size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.summaryValue}>{fmt(totalAvailable)}</Text>
            <Text style={styles.summaryLabel}>متاح للسحب</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Crown size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.summaryValue}>{fmt(totalEarned)}</Text>
            <Text style={styles.summaryLabel}>إجمالي المكتسب</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Users size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.summaryValue}>{members.length}</Text>
            <Text style={styles.summaryLabel}>مضيفة</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={lu.colors.purple} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text color={lu.colors.ink2}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Users size={40} color={lu.colors.muted} strokeWidth={1.5} />
              <Text color={lu.colors.muted} style={{ marginTop: 12 }}>لا توجد مضيفات بعد</Text>
            </View>
          }
          renderItem={({ item, index }) => <BalanceRow item={item} rank={index + 1} />}
        />
      )}
    </View>
  );
}

const BalanceRow = React.memo(function BalanceRow({
  item,
  rank,
}: {
  item: AgencyMemberBalance;
  rank: number;
}) {
  return (
    <View style={[styles.row, rank > 1 && styles.rowBorder]}>
      <Text style={styles.rank}>{rank}</Text>
      {item.avatar ? (
        <Image
          source={{ uri: item.avatar }}
          style={styles.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Crown size={18} color={lu.colors.purple} strokeWidth={2} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="bold" style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.role}>
          {item.isFemaleHost ? 'مضيفة موثّقة' : item.role === 'member' ? 'عضو' : item.role}
        </Text>
      </View>
      <View style={styles.pearls}>
        <View style={styles.pearlRow}>
          <Text style={styles.pearlLabel}>متاح</Text>
          <Text weight="bold" style={[styles.pearlValue, { color: lu.colors.purple }]}>
            {fmt(item.availablePearls)}
          </Text>
        </View>
        <View style={styles.pearlRow}>
          <Text style={styles.pearlLabel}>محوَّل</Text>
          <Text style={[styles.pearlValue, { color: lu.colors.ink2 }]}>
            {fmt(item.pearlsTransferredToAgent)}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: lu.colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

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

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },
  summaryValue: { fontSize: 19, color: '#fff', fontFamily: lu.fonts.displayHeavy, includeFontPadding: false },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  list: { paddingTop: 8, paddingHorizontal: 14, width: '100%', maxWidth: 680, alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.base,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
    shadowOpacity: 0.1,
  },
  rowBorder: {},
  rank: { fontSize: 13, fontWeight: '700', color: lu.colors.muted, width: 20, textAlign: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 14 },
  avatarPlaceholder: {
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, color: lu.colors.ink },
  role: { fontSize: 11, color: lu.colors.ink2, marginTop: 2 },
  pearls: { alignItems: 'flex-end', gap: 2 },
  pearlRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pearlLabel: { fontSize: 10, color: lu.colors.muted },
  pearlValue: { fontSize: 13, fontWeight: '700' },
});
