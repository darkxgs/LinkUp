/**
 * تبويب اللايف — بث مباشر للرهانات والأرباح (× المضاعف + قيمة الربح)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useColorScheme,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Dices, LogIn, Radio, TrendingUp, Wallet } from 'lucide-react-native';

import { Text, Card, CoinIcon } from '@/components/ui';
import { useCasinoLiveActivity } from '@/hooks/useCasinoLiveActivity';
import type { CasinoActivityItem } from '@/services/firebase/casinoLiveActivity';
import { useAuth } from '@/hooks/useAuth';
import { getCasinoGameImage } from '@/constants/casinoGames';
import { getCasinoGameLabel } from '@/utils/casinoI18n';
import { colors, radius, spacing, shadows } from '@/theme';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

function formatMultiplier(m: number): string {
  if (m >= 10) return String(Math.round(m));
  if (Math.abs(m - Math.round(m)) < 0.05) return String(Math.round(m));
  return m.toFixed(1);
}

function LivePulse() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

function ActivityRow({
  item,
  isMe,
  isFresh,
  onPress,
}: {
  item: CasinoActivityItem;
  isMe?: boolean;
  isFresh?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isWin = item.type === 'win';
  const isRecharge = item.type === 'recharge';
  const isBet = item.type === 'bet';
  const gameImg = item.gameId ? getCasinoGameImage(item.gameId) : null;
  const mult = item.multiplier ?? 0;
  const isBigWin = isWin && mult >= 5;

  const flash = useRef(new Animated.Value(isFresh ? 0.35 : 1)).current;
  const scale = useRef(new Animated.Value(isFresh ? 0.96 : 1)).current;

  useEffect(() => {
    if (!isFresh) return;
    Animated.parallel([
      Animated.spring(flash, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [isFresh, flash, scale]);

  return (
    <Animated.View style={{ opacity: flash, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        style={[
          styles.row,
          isMe && styles.rowMe,
          isWin && styles.rowWin,
          isBigWin && styles.rowBigWin,
        ]}
      >
        <View style={styles.leading}>
          {isRecharge ? (
            <View style={[styles.typeBadge, styles.typeBadgeRecharge]}>
              <Wallet size={14} color="#059669" strokeWidth={2.5} />
            </View>
          ) : isWin ? (
            <View style={[styles.typeBadge, styles.typeBadgeWin]}>
              <TrendingUp size={14} color="#059669" strokeWidth={2.5} />
            </View>
          ) : (
            <View style={[styles.typeBadge, styles.typeBadgeBet]}>
              <LogIn size={14} color="#E11414" strokeWidth={2.5} />
            </View>
          )}
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: item.avatar }}
              style={styles.avatar}
              contentFit="cover"
              recyclingKey={item.uid}
            />
            {isBet ? <View style={styles.playingDot} /> : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text variant="bodySmall" weight="semibold" numberOfLines={1} color="#301010">
              {item.displayName}
              {isMe ? (
                <Text variant="caption" color="#E11414" weight="bold">
                  {' '}
                  {t('casino.topWinners.you')}
                </Text>
              ) : null}
            </Text>
            {isWin ? (
              <View style={[styles.winPill, isBigWin && styles.winPillBig]}>
                <Text style={styles.winPillText}>{t('casino.livePlayers.won')}</Text>
              </View>
            ) : isBet ? (
              <View style={styles.playingPill}>
                <Dices size={9} color="#E11414" strokeWidth={2.5} />
                <Text style={styles.playingPillText}>{t('casino.livePlayers.playing')}</Text>
              </View>
            ) : null}
          </View>

          {isRecharge ? (
            <Text variant="caption" color="#059669" weight="semibold">
              {t('casino.liveFeed.recharge', { amount: formatAmount(item.stake) })}
            </Text>
          ) : item.gameId ? (
            <View style={styles.gameRow}>
              {gameImg ? (
                <Image source={gameImg} style={styles.gameThumb} contentFit="cover" />
              ) : null}
              <Text variant="caption" color="#6B7280" numberOfLines={1}>
                {isWin
                  ? t('casino.liveFeed.win', {
                      game: getCasinoGameLabel(item.gameId),
                      mult: formatMultiplier(mult),
                    })
                  : t('casino.liveFeed.bet', {
                      game: getCasinoGameLabel(item.gameId),
                      amount: formatAmount(item.stake),
                    })}
              </Text>
            </View>
          ) : null}

          {isWin && item.stake > 0 ? (
            <View style={styles.stakeChip}>
              <Text style={styles.stakeChipLabel}>{t('casino.livePlayers.lastBet')}</Text>
              <CoinIcon size={12} />
              <Text style={styles.stakeChipAmount}>{formatAmount(item.stake)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.endCol}>
          {isWin && mult > 0 ? (
            <View style={[styles.multBadge, isBigWin && styles.multBadgeBig]}>
              <Text style={[styles.multText, isBigWin && styles.multTextBig]}>
                ×{formatMultiplier(mult)}
              </Text>
            </View>
          ) : null}
          <View style={styles.amountRow}>
            <CoinIcon size={isWin ? 18 : 16} />
            <Text
              variant={isWin ? 'body' : 'bodySmall'}
              weight="bold"
              color={isWin ? '#059669' : isRecharge ? '#059669' : '#D97706'}
            >
              {isWin
                ? `+${formatAmount(item.winAmount ?? 0)}`
                : isRecharge
                  ? `+${formatAmount(item.stake)}`
                  : formatAmount(item.stake)}
            </Text>
          </View>
          {isWin ? (
            <Text variant="caption" color="#9CA3AF" style={styles.winLabel}>
              {t('casino.livePlayers.winAmount')}
            </Text>
          ) : isBet ? (
            <Text variant="caption" color="#9CA3AF" style={styles.winLabel}>
              {t('casino.livePlayers.lastBet')}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function CasinoLivePlayersTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const { items, loading } = useCasinoLiveActivity();
  const seenRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (loading) return;

    if (!readyRef.current) {
      items.forEach((i) => seenRef.current.add(i.id));
      readyRef.current = true;
      return;
    }

    const fresh = new Set<string>();
    items.forEach((i) => {
      if (!seenRef.current.has(i.id)) {
        seenRef.current.add(i.id);
        fresh.add(i.id);
      }
    });
    if (fresh.size > 0) setFreshIds(fresh);
  }, [items, loading]);

  const goProfile = useCallback(
    (uid: string) => router.push(`/profile/${uid}` as any),
    [router],
  );

  const cardBg = isDark ? '#1A0A0C' : colors.white;
  const divider = isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6';
  const feedItems = items.slice(0, 60);

  return (
    <View style={styles.wrap}>
      <View style={styles.liveHeader}>
        <View style={styles.liveTitleRow}>
          <LivePulse />
          <Text variant="caption" weight="bold" style={styles.liveLabel}>
            {t('casino.livePlayers.liveNow')}
          </Text>
          <Radio size={14} color="#E11414" strokeWidth={2.5} />
          <Text variant="bodySmall" weight="bold" color={isDark ? colors.white : '#301010'}>
            {t('casino.livePlayers.title')}
          </Text>
        </View>
        <Text variant="caption" color="#9CA3AF">
          {t('casino.livePlayers.subtitle')}
        </Text>
        {feedItems.length > 0 ? (
          <Text variant="caption" color="#E11414" weight="semibold">
            {t('casino.livePlayers.eventCount', { count: feedItems.length })}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#E11414" />
        </View>
      ) : feedItems.length === 0 ? (
        <Card variant="elevated" style={[styles.emptyCard, { backgroundColor: cardBg }]}>
          <Radio size={28} color="#E5E7EB" strokeWidth={2} />
          <Text variant="bodySmall" weight="semibold" align="center" color={isDark ? colors.white : '#374151'}>
            {t('casino.livePlayers.emptyTitle')}
          </Text>
          <Text variant="caption" align="center" color="#9CA3AF">
            {t('casino.livePlayers.emptyDesc')}
          </Text>
        </Card>
      ) : (
        <Card variant="elevated" style={[styles.listCard, { backgroundColor: cardBg }]}>
          {feedItems.map((item, idx) => (
            <View key={item.id}>
              <ActivityRow
                item={item}
                isMe={user?.uid === item.uid}
                isFresh={freshIds.has(item.id)}
                onPress={() => goProfile(item.uid)}
              />
              {idx < feedItems.length - 1 ? (
                <View style={[styles.divider, { backgroundColor: divider }]} />
              ) : null}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  liveHeader: { gap: 4, paddingHorizontal: 2 },
  liveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveLabel: {
    color: '#EF4444',
    fontSize: 10,
    letterSpacing: 0.8,
  },
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
    paddingVertical: 12,
  },
  rowMe: { backgroundColor: 'rgba(225, 20, 20,0.04)' },
  rowWin: { backgroundColor: 'rgba(16,185,129,0.04)' },
  rowBigWin: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderStartWidth: 3,
    borderStartColor: '#34D399',
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeBet: { backgroundColor: '#FEE2E2' },
  typeBadgeWin: { backgroundColor: '#D1FAE5' },
  typeBadgeRecharge: { backgroundColor: '#D1FAE5' },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  playingDot: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#E11414',
    borderWidth: 2,
    borderColor: '#fff',
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  playingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  playingPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#E11414',
  },
  winPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  winPillBig: { backgroundColor: '#6EE7B7' },
  winPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gameThumb: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  stakeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  stakeChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  stakeChipAmount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  endCol: {
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 72,
  },
  multBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  multBadgeBig: {
    backgroundColor: '#047857',
    paddingHorizontal: 10,
  },
  multText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  multTextBig: { fontSize: 15 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  winLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.md },
});
