/**
 * شاشة الزوار - من شاف بروفايلك
 * - قائمة آخر 50 زائر
 * - يتطلب VIP لرؤية كل التفاصيل
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { Eye, Crown, Lock, Clock, Users, EyeOff } from 'lucide-react-native';
import { ArrowLeft } from '@/components/ui/RtlIcons';

import { Text, RealCountryFlag } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing, shadows } from '@/theme';
import {
  getProfileVisitors,
  subscribeProfileVisitors,
  subscribeToProfileVisitorCount,
  fetchProfileVisitorStats,
  reconcileVisitorCount,
  type ProfileVisit,
  type ProfileVisitorStats,
} from '@/services/firebase/profileVisitors';
import { useConfig } from '@/contexts/ConfigContext';
import { userHasVipFeature } from '@/services/firebase/vipSystem';
// وقت نسبي موحّد ومتوافق مع لغة التطبيق (كان عربيّاً ثابتاً هنا)
import { formatTimeAgo as formatTime } from '@/utils/timeAgo';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

/** عدد الزوار المعروض لغير المؤهّلين لامتياز «سجل الزوار» */
const VISITORS_FREE_LIMIT = 5;

interface Visitor {
  uid: string;
  displayName: string;
  avatar: string;
  country: string;
  level: number;
  isVIP?: boolean;
  visitedAt: number;
}

function mapVisit(v: ProfileVisit): Visitor {
  return {
    uid: v.visitorUid,
    displayName: v.displayName,
    avatar: v.avatar,
    country: v.country,
    level: v.level,
    isVIP: v.isVIP,
    visitedAt: v.visitedAt,
  };
}

export default function VisitorsScreen() {
  // شريط العنوان داكن — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorStats, setVisitorStats] = useState<ProfileVisitorStats>({
    total: 0,
    thisWeek: 0,
    vipThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isVIP = user?.isVIP ?? false;
  const { vipSystem } = useConfig();
  // امتياز SVIP «سجل الزوار»: عرض القائمة كاملة، وإلا عدد محدود
  const canSeeAllVisitors = userHasVipFeature(
    user as unknown as Record<string, unknown>,
    'visitorsLog',
    vipSystem,
  );
  const shownVisitors = canSeeAllVisitors ? visitors : visitors.slice(0, VISITORS_FREE_LIMIT);

  const refreshStats = useCallback(async (uid: string) => {
    const stats = await fetchProfileVisitorStats(uid);
    setVisitorStats(stats);
  }, []);

  // بيانات حقيقية من Firestore
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void reconcileVisitorCount(user.uid).then(() => refreshStats(user.uid));
    const unsubCount = subscribeToProfileVisitorCount(user.uid, (total) => {
      setVisitorStats((prev) => ({ ...prev, total }));
    });
    const unsub = subscribeProfileVisitors(user.uid, (rows) => {
      setVisitors(rows.map(mapVisit));
      setLoading(false);
      void refreshStats(user.uid);
    });
    return () => {
      unsub();
      unsubCount();
    };
  }, [user?.uid, refreshStats]);

  const loadVisitors = async () => {
    if (!user?.uid) return;
    await reconcileVisitorCount(user.uid);
    const rows = await getProfileVisitors(user.uid);
    setVisitors(rows.map(mapVisit));
    await refreshStats(user.uid);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadVisitors();
    } catch (e) {
      console.warn('visitors refresh:', e);
    } finally {
      // بدون finally كان أي خطأ يترك مؤشر التحديث يدور للأبد
      setRefreshing(false);
    }
  };

  const renderItem = useCallback(
    ({ item: v }: { item: Visitor }) => (
      <VisitorRow
        v={v}
        isVIP={isVIP}
        onPress={() => isVIP && router.push(`/profile/${v.uid}` as any)}
      />
    ),
    [isVIP, router],
  );

  const ListHeader = (
    <>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Users size={20} color="#E11414" strokeWidth={2.5} />
          <Text variant="h3" weight="bold" color="#1F2937">
            {visitorStats.total}
          </Text>
          <Text variant="caption" color="#6B7280">
            {t('visitors.totalVisitors')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Eye size={20} color="#E11414" strokeWidth={2.5} />
          <Text variant="h3" weight="bold" color="#1F2937">
            {visitorStats.thisWeek}
          </Text>
          <Text variant="caption" color="#6B7280">
            {t('visitors.text53548')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Crown size={20} color="#E11414" strokeWidth={2.5} />
          <Text variant="h3" weight="bold" color="#1F2937">
            {visitorStats.vipThisWeek}
          </Text>
          <Text variant="caption" color="#6B7280">
            {t('visitors.vipThisWeek')}
          </Text>
        </View>
      </View>

      {!isVIP && (
        <View style={styles.vipPromo}>
          <LinearGradient
            colors={['#FCD34D', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Crown size={24} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" weight="bold" color="#FFFFFF">
              {t('visitors.text21246')}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.85)">
              {t('visitors.text35051')}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/vip' as any)} style={styles.vipBtn}>
            <Text variant="caption" weight="bold" color="#F59E0B">
              {t('relationships.upgrade')}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#26090C', '#3A0A0A', '#26090C']}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text variant="h3" weight="bold" color={colors.white}>
          {t('visitors.text56171')}
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading ? (
        <>
          {ListHeader}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E11414" />
          </View>
        </>
      ) : (
        <FlatList
          data={shownVisitors}
          keyExtractor={(v) => v.uid}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ padding: spacing.base }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          ListFooterComponent={
            !canSeeAllVisitors && visitors.length > VISITORS_FREE_LIMIT ? (
              <Pressable
                onPress={() => router.push('/vip' as any)}
                style={styles.moreVisitorsHint}
              >
                <Lock size={14} color="#9CA3AF" strokeWidth={2} />
                <Text variant="caption" color="#6B7280">
                  {t('visitors.moreLocked', {
                    count: visitors.length - VISITORS_FREE_LIMIT,
                    defaultValue: `+${visitors.length - VISITORS_FREE_LIMIT} زائر إضافي — فعّل امتياز «سجل الزوار» لعرض القائمة كاملة`,
                  })}
                </Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <EyeOff size={64} color="#D1D5DB" strokeWidth={1.5} />
              <Text variant="h4" color="#9CA3AF" align="center" style={{ marginTop: 16 }}>
                {t('visitors.text83508')}
              </Text>
              <Text variant="bodySmall" color="#9CA3AF" align="center">
                {t('visitors.text93797')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}


const VisitorRow = React.memo(function VisitorRow({
  v,
  isVIP,
  onPress,
}: {
  v: Visitor;
  isVIP: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.visitorCard} disabled={!isVIP}>
      <View style={styles.avatarWrap}>
        <Image
          source={{ uri: v.avatar }}
          style={[styles.avatar, !isVIP && { opacity: 0.3 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={v.uid}
          transition={150}
          blurRadius={isVIP ? 0 : 20}
        />
        {v.isVIP && (
          <View style={styles.vipBadge}>
            <Crown size={10} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <View style={[styles.lvBadge, { backgroundColor: '#FEE2E2' }]}>
            <Text variant="caption" weight="bold" color="#E11414" style={{ fontSize: 10 }}>
              LV{v.level}
            </Text>
          </View>
          <Text
            variant="body"
            weight="bold"
            color={isVIP ? '#1F2937' : '#9CA3AF'}
            numberOfLines={1}
          >
            {isVIP ? v.displayName : '••••••••'}
          </Text>
          {isVIP && <RealCountryFlag countryCode={v.country} size={16} />}
        </View>
        <View style={styles.timeRow}>
          <Clock size={12} color="#9CA3AF" strokeWidth={2} />
          <Text variant="caption" color="#9CA3AF">
            {formatTime(v.visitedAt)}
          </Text>
        </View>
      </View>

      {!isVIP && <Lock size={16} color="#D1D5DB" strokeWidth={2} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    gap: 4,
    ...shadows.sm,
  },

  vipPromo: {
    marginHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.base,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  vipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', padding: spacing.xl * 2, gap: 8 },
  moreVisitorsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  visitorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.base,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: 8,
    ...shadows.sm,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F3F4F6',
  },
  vipBadge: {
    position: 'absolute',
    top: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  lvBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
