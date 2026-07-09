/**
 * LinkUp App — لوحات المتصدرين
 * تستخدم البيانات الحقيقية من Firestore
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Trophy,
  Crown,
  Coins,
  Gift,
  Heart,
  TrendingUp,
  Award,
} from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { Text, Card, BackButton, RealCountryFlag } from '@/components/ui';
import { useLeaderboard } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { UserDoc } from '@/services/firebase/users';
import { colors, radius, spacing, shadows } from '@/theme';

type Category = 'coins' | 'gifts' | 'followers' | 'level';
type Period = 'daily' | 'weekly' | 'monthly' | 'all';

const CATEGORIES: { id: Category; label: string; Icon: any; color: string }[] = [
  { id: 'coins', label: i18n.t('leaderboards.text76089'), Icon: Coins, color: '#F59E0B' },
  { id: 'gifts', label: i18n.t('leaderboards.text83013'), Icon: Gift, color: '#E11414' },
  { id: 'followers', label: i18n.t('leaderboards.text19611'), Icon: Heart, color: '#EF4444' },
  { id: 'level', label: i18n.t('relationships.level'), Icon: TrendingUp, color: '#E11414' },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: i18n.t('leaderboards.text96538') },
  { id: 'weekly', label: i18n.t('leaderboards.text80524') },
  { id: 'monthly', label: i18n.t('vip.text11848') },
  { id: 'all', label: i18n.t('leaderboards.text13948') },
];

const RANK_COLORS: Record<number, [string, string]> = {
  1: ['#FCD34D', '#F59E0B'],
  2: ['#94A3B8', '#64748B'],
  3: ['#CD7F32', '#92400E'],
};

const RANK_LABELS = ['الأول', i18n.t('leaderboards.text16631'), i18n.t('leaderboards.text58558')];

export default function LeaderboardsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeCategory, setActiveCategory] = useState<Category>('coins');
  const [activePeriod, setActivePeriod] = useState<Period>('weekly');

  const { users, loading } = useLeaderboard(activeCategory, activePeriod);

  const getValue = (u: UserDoc) => {
    switch (activeCategory) {
      case 'coins': return u.coins;
      case 'gifts': return u.pearls;
      case 'followers': return u.followers;
      case 'level': return u.level;
    }
  };

  const formatValue = (value: number) => {
    if (activeCategory === 'level') return `LV${value}`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}م`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}ك`;
    return String(value);
  };

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  // رتبة المستخدم الحالي — تُحسب مرة واحدة بدل findIndex داخل JSX في كل render
  const myRank = useMemo(() => {
    if (!user) return 0;
    return users.findIndex((u) => u.uid === user.uid) + 1;
  }, [users, user]);

  const goToProfile = useCallback(
    (uid: string) => router.push(`/profile/${uid}` as any),
    [router],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F59E0B', '#D97706', '#92400E']}
        style={styles.headerBg}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton color={colors.white} bg="rgba(0,0,0,0.25)" />
          <View style={styles.titleRow}>
            <Trophy size={20} color="#FCD34D" fill="#FCD34D" strokeWidth={0} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('profile.leaderboard')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Period selector */}
        <View style={styles.periodsRow}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setActivePeriod(p.id)}
              style={[styles.periodChip, activePeriod === p.id && styles.periodChipActive]}
            >
              <Text
                variant="caption"
                weight={activePeriod === p.id ? 'bold' : 'medium'}
                color={activePeriod === p.id ? '#92400E' : colors.white}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Loading or content */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        ) : top3.length >= 3 ? (
          <View style={styles.podium}>
            <PodiumCard
              leader={top3[1]!}
              rank={2}
              height={120}
              value={formatValue(getValue(top3[1]!))}
            />
            <PodiumCard
              leader={top3[0]!}
              rank={1}
              height={150}
              hasCrown
              value={formatValue(getValue(top3[0]!))}
            />
            <PodiumCard
              leader={top3[2]!}
              rank={3}
              height={100}
              value={formatValue(getValue(top3[2]!))}
            />
          </View>
        ) : (
          <View style={styles.loading}>
            <Text variant="caption" color={colors.white}>{t('leaderboards.text15615')}</Text>
          </View>
        )}

        {/* White section */}
        <View style={styles.whiteSection}>
          {/* Categories - RTL */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.id)}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                >
                  <cat.Icon
                    size={14}
                    color={isActive ? colors.white : cat.color}
                    strokeWidth={2.5}
                  />
                  <Text
                    variant="bodySmall"
                    weight={isActive ? 'bold' : 'medium'}
                    color={isActive ? colors.white : '#5C5C64'}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <Card variant="elevated" style={styles.leaderboardCard}>
              {rest.map((leader, idx) => (
                <Pressable
                  key={leader.uid}
                  onPress={() => goToProfile(leader.uid)}
                  style={[styles.leaderRow, idx < rest.length - 1 && styles.leaderRowBorder]}
                >
                  <View style={styles.rankNumber}>
                    <Text variant="bodySmall" weight="bold" color={colors.text.tertiary}>
                      {idx + 4}
                    </Text>
                  </View>
                  <Image
                    source={{ uri: leader.avatar }}
                    style={styles.leaderAvatar}
                    contentFit="cover"
                    recyclingKey={leader.uid}
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.leaderNameRow}>
                      {/* flexShrink: الاسم الطويل كان يدفع العلم وشارة VIP خارج الشاشة */}
                      <Text
                        variant="bodySmall"
                        weight="semibold"
                        numberOfLines={1}
                        style={{ flexShrink: 1 }}
                      >
                        {leader.displayName}
                      </Text>
                      <RealCountryFlag countryCode={leader.country} size={14} />
                      {leader.isVIP && (
                        <View style={styles.vipBadgeSmall}>
                          <Crown size={8} color={colors.white} fill={colors.white} strokeWidth={0} />
                        </View>
                      )}
                    </View>
                    <View style={styles.leaderLevelRow}>
                      <Award size={10} color="#E11414" />
                      <Text variant="caption" color={colors.text.tertiary}>
                        المستوى {leader.level}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.leaderValue}>
                    <Coins size={12} color="#F59E0B" strokeWidth={2.5} />
                    <Text variant="bodySmall" weight="bold" color="#F59E0B">
                      {formatValue(getValue(leader))}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          )}

          {/* Your rank */}
          {user && (
            <Card variant="elevated" style={styles.yourRankCard}>
              <LinearGradient
                colors={['#FCA5A5', '#E11414']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.yourRankContent}>
                <View style={styles.yourRankBadge}>
                  <Text variant="h3" weight="bold" color={colors.white}>
                    #{myRank || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginStart: spacing.sm }}>
                  <Text variant="caption" color="rgba(255,255,255,0.85)">
                    {t('leaderboards.text40235')}
                  </Text>
                  <Text variant="body" weight="bold" color={colors.white}>
                    {user.profile.displayName}
                  </Text>
                </View>
                <View>
                  <Text variant="caption" color="rgba(255,255,255,0.85)" align="left">
                    {t('store.yourBalance')}
                  </Text>
                  <View style={styles.yourValueRow}>
                    <Coins size={14} color="#FCD34D" strokeWidth={2.5} />
                    <Text variant="body" weight="bold" color="#FCD34D">
                      {user.stats.coins.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const PodiumCard: React.FC<{
  leader: UserDoc;
  rank: number;
  height: number;
  hasCrown?: boolean;
  value: string;
}> = ({ leader, rank, height, hasCrown, value }) => {
  const colors_ = RANK_COLORS[rank]!;
  return (
    <View style={[styles.podiumItem, { flex: 1 }]}>
      {hasCrown && (
        <View style={styles.crownIcon}>
          <Crown size={28} color="#FCD34D" fill="#FCD34D" strokeWidth={0} />
        </View>
      )}
      <View style={styles.podiumAvatarWrapper}>
        <LinearGradient colors={colors_} style={styles.podiumAvatarBorder}>
          <Image
            source={{ uri: leader.avatar }}
            style={styles.podiumAvatar}
            contentFit="cover"
            recyclingKey={leader.uid}
            cachePolicy="memory-disk"
            transition={150}
          />
        </LinearGradient>
        <View style={[styles.podiumRankBadge, { backgroundColor: colors_[1] }]}>
          <Text variant="caption" color={colors.white} weight="bold">
            {rank}
          </Text>
        </View>
      </View>
      <Text variant="bodySmall" weight="bold" color={colors.white} align="center" numberOfLines={1}>
        {leader.displayName}
      </Text>
      <View style={styles.podiumValue}>
        <Coins size={10} color="#FCD34D" strokeWidth={2.5} />
        <Text variant="caption" color="#FCD34D" weight="bold" style={{ fontSize: 10 }}>
          {value}
        </Text>
      </View>
      <LinearGradient
        colors={colors_}
        style={[styles.podiumBase, { height: height * 0.4 }]}
      >
        <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 10 }}>
          {RANK_LABELS[rank - 1]}
        </Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  scrollContent: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Periods
  periodsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
    justifyContent: 'center',
  },
  periodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.full,
  },
  periodChipActive: {
    backgroundColor: '#FCD34D',
  },

  loading: {
    paddingVertical: spacing['4xl'],
    alignItems: 'center',
  },

  // Podium
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  podiumItem: {
    alignItems: 'center',
    gap: 4,
  },
  crownIcon: {
    marginBottom: -4,
  },
  podiumAvatarWrapper: {
    position: 'relative',
  },
  podiumAvatarBorder: {
    padding: 3,
    borderRadius: 35,
  },
  podiumAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FBEAEA',
  },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  podiumValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.full,
  },
  podiumBase: {
    width: '100%',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },

  // White section
  whiteSection: {
    backgroundColor: '#FCFAFA',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.base,
    marginTop: spacing.lg,
  },

  // Categories
  categoriesScroll: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    ...shadows.sm,
  },
  categoryChipActive: {
    backgroundColor: '#E11414',
    ...shadows.purpleGlow,
  },

  leaderboardCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  leaderRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#FBEAEA',
  },
  rankNumber: {
    width: 28,
    alignItems: 'center',
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FBEAEA',
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  vipBadgeSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
  },

  yourRankCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.purpleGlow,
  },
  yourRankContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
  },
  yourRankBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
