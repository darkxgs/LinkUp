/**
 * بث الكازينو المباشر — تبويب الإشعارات
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Dices, Coins, TrendingUp, LogIn } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { useCasinoLiveActivity } from '@/hooks/useCasinoLiveActivity';
import type { CasinoActivityItem } from '@/services/firebase/casinoLiveActivity';
import { getCasinoGameImage } from '@/constants/casinoGames';
import { getCasinoGameLabel } from '@/utils/casinoI18n';
import { formatRelativeTime } from '@/utils/relativeTime';
import { colors, radius, spacing } from '@/theme';
import type { GameId } from '@/services/firebase/gameTransactions';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

function LiveDot() {
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

function GameIcon({ gameId }: { gameId: GameId }) {
  const src = getCasinoGameImage(gameId);
  if (!src) {
    return (
      <View style={styles.gameIconFallback}>
        <Dices size={16} color="#9CA3AF" strokeWidth={2} />
      </View>
    );
  }
  return <Image source={src} style={styles.gameIcon} contentFit="cover" recyclingKey={gameId} />;
}

function ActivityRow({
  item,
  onPress,
}: {
  item: CasinoActivityItem;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isWin = item.type === 'win';
  const isBigWin = isWin && (item.multiplier ?? 0) >= 5;

  return (
    <Pressable onPress={onPress} style={[styles.card, isBigWin && styles.cardWin]}>
      <View style={styles.iconCol}>
        {isWin ? (
          <View style={[styles.typeIcon, styles.typeIconWin]}>
            <TrendingUp size={18} color="#059669" strokeWidth={2.5} />
          </View>
        ) : (
          <View style={[styles.typeIcon, styles.typeIconBet]}>
            <LogIn size={18} color="#E11414" strokeWidth={2.5} />
          </View>
        )}
      </View>

      <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" recyclingKey={item.uid} />

      <View style={styles.body}>
        <Text variant="bodySmall" weight="bold" numberOfLines={1} color={colors.text.primary}>
          {item.displayName}
        </Text>
        <View style={styles.metaRow}>
          <GameIcon gameId={item.gameId!} />
          <Text variant="caption" color={colors.text.secondary} numberOfLines={1} style={styles.metaText}>
            {isWin
              ? t('notifications.casinoWinLine', {
                  game: getCasinoGameLabel(item.gameId!),
                  mult: (item.multiplier ?? 0).toFixed(1),
                })
              : t('notifications.casinoBetLine', {
                  game: getCasinoGameLabel(item.gameId!),
                  amount: formatAmount(item.stake),
                })}
          </Text>
        </View>
      </View>

      <View style={styles.end}>
        {isWin ? (
          <View style={styles.amountRow}>
            <Coins size={12} color="#F59E0B" strokeWidth={2.5} />
            <Text variant="caption" weight="bold" color="#059669">
              +{formatAmount((item.winAmount ?? 0) - item.stake)}
            </Text>
          </View>
        ) : (
          <View style={styles.amountRow}>
            <Coins size={12} color="#9CA3AF" strokeWidth={2.5} />
            <Text variant="caption" weight="semibold" color={colors.text.secondary}>
              {formatAmount(item.stake)}
            </Text>
          </View>
        )}
        <Text variant="caption" color={colors.text.tertiary} style={styles.time}>
          {formatRelativeTime(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

export function CasinoNotificationsFeed() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, loading } = useCasinoLiveActivity();

  const goProfile = useCallback(
    (uid: string) => router.push(`/profile/${uid}` as any),
    [router],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text variant="caption" color={colors.text.secondary} style={{ marginTop: spacing.sm }}>
          {t('notifications.casinoLoading')}
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Dices size={40} color="#E11414" strokeWidth={2} />
        </View>
        <Text variant="h4" weight="semibold" align="center">
          {t('notifications.emptyCasino')}
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} align="center">
          {t('notifications.emptyCasinoDesc')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.liveBar}>
        <LiveDot />
        <Text variant="caption" weight="bold" color="#EF4444">
          LIVE
        </Text>
        <Text variant="caption" color={colors.text.secondary} style={{ flex: 1 }}>
          {t('notifications.casinoLiveHint')}
        </Text>
      </View>
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} onPress={() => goProfile(item.uid)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  loading: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFE6E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2E9E9',
  },
  cardWin: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  iconCol: { flexShrink: 0 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBet: { backgroundColor: '#FEE2E2' },
  typeIconWin: { backgroundColor: '#D1FAE5' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  body: { flex: 1, minWidth: 0, gap: 6 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: { flex: 1 },
  gameIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  gameIconFallback: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  end: { alignItems: 'flex-end', gap: 4 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: { fontSize: 10 },
});
