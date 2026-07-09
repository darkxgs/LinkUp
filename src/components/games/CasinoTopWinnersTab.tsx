/**
 * تبويب Top Winners — أعلى 100 رابح (يومي / أسبوعي / كل الأوقات)
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Trophy, Crown, Medal } from 'lucide-react-native';

import { Text, Card, CasinoCoinIcon } from '@/components/ui';
import { useCasinoTopWinners } from '@/hooks/useCasinoTopWinners';
import { useAuth } from '@/hooks/useAuth';
import { TOP_CASINO_WINNERS_LIMIT } from '@/services/firebase/casinoLeaderboard';
import type { CasinoTopWinner, CasinoWinnerPeriod } from '@/services/firebase/casinoLeaderboard';
import { getCasinoGameImage } from '@/constants/casinoGames';
import { getCasinoGameLabel } from '@/utils/casinoI18n';
import { colors, radius, spacing, shadows } from '@/theme';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

function formatMultiplier(mult: number): string {
  if (!mult || mult <= 0) return '—';
  const rounded = mult >= 10 ? mult.toFixed(0) : mult.toFixed(1);
  return `×${rounded.replace(/\.0$/, '')}`;
}

function WinnerRow({
  winner,
  rank,
  isMe,
  onPress,
}: {
  winner: CasinoTopWinner;
  rank: number;
  isMe?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const gameId = winner.bestWinGameId || winner.topGameId;
  const gameImg = gameId ? getCasinoGameImage(gameId) : null;
  const casinoProfit = winner.totalGrossWin;

  return (
    <Pressable onPress={onPress} style={[styles.row, isMe && styles.rowMe]}>
      <View style={[styles.rank, rank === 1 && styles.rankGold]}>
        {rank === 1 ? (
          <Crown size={14} color="#D97706" fill="#FCD34D" strokeWidth={1.5} />
        ) : rank <= 3 ? (
          <Medal size={14} color={rank === 2 ? '#64748B' : '#C2410C'} strokeWidth={2.5} />
        ) : (
          <Text variant="caption" weight="bold" color="#9CA3AF">
            {rank}
          </Text>
        )}
      </View>
      <Image source={{ uri: winner.avatar }} style={styles.avatar} contentFit="cover" recyclingKey={winner.uid} />
      <View style={styles.body}>
        <Text variant="bodySmall" weight="semibold" numberOfLines={1} color="#301010">
          {winner.displayName}
          {isMe ? (
            <Text variant="caption" color="#E11414" weight="bold">
              {' '}
              {t('casino.topWinners.you')}
            </Text>
          ) : null}
        </Text>
        <View style={styles.gameMetaRow}>
          {gameImg ? (
            <Image source={gameImg} style={styles.gameThumb} contentFit="cover" recyclingKey={gameId} />
          ) : null}
          <Text variant="caption" color="#6B7280" numberOfLines={1} style={styles.gameName}>
            {gameId ? getCasinoGameLabel(gameId) : '—'}
          </Text>
          {winner.bestMultiplier > 0 ? (
            <View style={styles.multPill}>
              <Text style={styles.multText}>{formatMultiplier(winner.bestMultiplier)}</Text>
            </View>
          ) : null}
        </View>
        {winner.winsCount > 1 ? (
          <Text variant="caption" color="#9CA3AF" style={styles.winsCount}>
            {t('casino.topWinners.wins', { count: winner.winsCount })}
          </Text>
        ) : null}
      </View>
      <View style={styles.profitCol}>
        <Text variant="caption" color="#9CA3AF" style={styles.profitLabel}>
          {t('casino.topWinners.casinoProfit')}
        </Text>
        <View style={styles.profitRow}>
          <CasinoCoinIcon size={15} />
          <Text variant="bodySmall" weight="bold" color="#059669">
            +{formatAmount(casinoProfit)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function CasinoTopWinnersTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const [period, setPeriod] = useState<CasinoWinnerPeriod>('daily');
  const { winners, loading } = useCasinoTopWinners(period);

  const periods: { id: CasinoWinnerPeriod; label: string }[] = useMemo(
    () => [
      { id: 'daily', label: t('casino.topWinners.periodDaily') },
      { id: 'weekly', label: t('casino.topWinners.periodWeekly') },
      { id: 'all', label: t('casino.topWinners.periodAll') },
    ],
    [t],
  );

  const myRank = useMemo(() => {
    if (!user) return 0;
    return winners.findIndex((w) => w.uid === user.uid) + 1;
  }, [winners, user]);

  const goProfile = useCallback(
    (uid: string) => router.push(`/profile/${uid}` as any),
    [router],
  );

  const cardBg = isDark ? '#1A0A0C' : colors.white;
  const divider = isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6';

  return (
    <View style={styles.wrap}>
      <View style={[styles.periodsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(225, 20, 20,0.08)' }]}>
        {periods.map((p) => {
          const active = period === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPeriod(p.id)}
              style={[styles.periodChip, active && styles.periodChipActive]}
            >
              <Text
                variant="caption"
                weight={active ? 'bold' : 'medium'}
                color={active ? colors.white : isDark ? 'rgba(255,255,255,0.7)' : '#8A0E0E'}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.headerRow}>
        <Trophy size={16} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
        <Text variant="bodySmall" weight="bold" color={isDark ? colors.white : '#301010'}>
          {t('casino.topWinners.leaderboard')}
        </Text>
        <Text variant="caption" color="#9CA3AF" style={styles.countLabel}>
          {t('casino.topWinners.topCount', { count: TOP_CASINO_WINNERS_LIMIT })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#E11414" />
        </View>
      ) : winners.length === 0 ? (
        <Card variant="elevated" style={[styles.emptyCard, { backgroundColor: cardBg }]}>
          <Trophy size={28} color="#E5E7EB" strokeWidth={2} />
          <Text variant="bodySmall" weight="semibold" align="center" color={isDark ? colors.white : '#374151'}>
            {t('casino.topWinners.emptyTitle')}
          </Text>
          <Text variant="caption" align="center" color="#9CA3AF">
            {t('casino.topWinners.emptyDesc')}
          </Text>
        </Card>
      ) : (
        <Card variant="elevated" style={[styles.listCard, { backgroundColor: cardBg }]}>
          {winners.map((w, idx) => (
            <View key={w.uid}>
              <WinnerRow
                winner={w}
                rank={idx + 1}
                isMe={user?.uid === w.uid}
                onPress={() => goProfile(w.uid)}
              />
              {idx < winners.length - 1 ? (
                <View style={[styles.divider, { backgroundColor: divider }]} />
              ) : null}
            </View>
          ))}
        </Card>
      )}

      {user && myRank > 0 ? (
        <View style={styles.myRankBar}>
          <Text variant="caption" color="#6B7280">
            {t('casino.topWinners.yourRank')}
          </Text>
          <Text variant="body" weight="bold" color="#E11414">
            #{myRank}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  periodsRow: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  periodChipActive: { backgroundColor: '#E11414' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  countLabel: { marginLeft: 'auto', fontSize: 11 },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    ...shadows.sm,
  },
  listCard: { paddingVertical: spacing.xs, ...shadows.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  rowMe: { backgroundColor: 'rgba(225, 20, 20,0.04)' },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  rankGold: { backgroundColor: '#FFFBEB' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  gameMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  gameThumb: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  gameName: {
    flexShrink: 1,
    fontWeight: '600',
  },
  multPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  multText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E11414',
  },
  winsCount: { fontSize: 10 },
  profitCol: { alignItems: 'flex-end', gap: 2, minWidth: 72 },
  profitLabel: { fontSize: 9, fontWeight: '600' },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.md },
  myRankBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FCFAFA',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
});
