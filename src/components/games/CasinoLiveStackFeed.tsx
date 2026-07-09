/**
 * بث الكازينو المباشر — إشعارات متكدسة فوق شاشة الكازينو
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Dices, LogIn, TrendingUp, Wallet } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useCasinoLiveActivity } from '@/hooks/useCasinoLiveActivity';
import type { CasinoActivityItem } from '@/services/firebase/casinoLiveActivity';
import { getCasinoGameImage } from '@/constants/casinoGames';
import { getCasinoGameLabel } from '@/utils/casinoI18n';
import type { GameId } from '@/services/firebase/gameTransactions';
import { radius, shadows, spacing } from '@/theme';

const MAX_TOASTS = 5;
const TOAST_TTL_MS = 5_500;

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
        Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

function GameThumb({ gameId }: { gameId: GameId }) {
  const src = getCasinoGameImage(gameId);
  if (!src) {
    return (
      <View style={styles.gameThumbFallback}>
        <Dices size={12} color="#fff" strokeWidth={2} />
      </View>
    );
  }
  return <Image source={src} style={styles.gameThumb} contentFit="cover" recyclingKey={gameId} />;
}

function LiveToast({
  item,
  onPress,
  index,
}: {
  item: CasinoActivityItem;
  onPress: () => void;
  index: number;
}) {
  const { t } = useTranslation();
  const slide = useRef(new Animated.Value(-24)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const isWin = item.type === 'win';
  const isRecharge = item.type === 'recharge';
  const isBigWin = isWin && (item.multiplier ?? 0) >= 5;

  const formatMult = (m: number) =>
    m >= 10 || Math.abs(m - Math.round(m)) < 0.05 ? String(Math.round(m)) : m.toFixed(1);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8, tension: 90 }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  return (
    <Animated.View
      style={[
        styles.toastWrap,
        {
          opacity: fade,
          transform: [{ translateY: slide }],
          marginTop: index === 0 ? 0 : 6,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={[styles.toast, isBigWin && styles.toastBigWin]}
      >
        <View style={styles.toastLeading}>
          {isRecharge ? (
            <View style={[styles.typeBadge, styles.typeBadgeRecharge]}>
              <Wallet size={13} color="#059669" strokeWidth={2.5} />
            </View>
          ) : isWin ? (
            <View style={[styles.typeBadge, styles.typeBadgeWin]}>
              <TrendingUp size={13} color="#059669" strokeWidth={2.5} />
            </View>
          ) : (
            <View style={[styles.typeBadge, styles.typeBadgeBet]}>
              <LogIn size={13} color="#E11414" strokeWidth={2.5} />
            </View>
          )}
          <Image
            source={{ uri: item.avatar }}
            style={styles.avatar}
            contentFit="cover"
            recyclingKey={item.uid}
          />
        </View>

        <View style={styles.toastBody}>
          <Text variant="caption" weight="bold" numberOfLines={1} color="#fff">
            {item.displayName}
          </Text>
          <View style={styles.metaRow}>
            {!isRecharge && item.gameId ? <GameThumb gameId={item.gameId} /> : null}
            <Text variant="caption" numberOfLines={1} style={styles.metaText}>
              {isRecharge
                ? t('casino.liveFeed.recharge', { amount: formatAmount(item.stake) })
                : isWin
                  ? t('casino.liveFeed.win', {
                      game: getCasinoGameLabel(item.gameId!),
                      mult: formatMult(item.multiplier ?? 0),
                    })
                  : t('casino.liveFeed.bet', {
                      game: getCasinoGameLabel(item.gameId!),
                      amount: formatAmount(item.stake),
                    })}
            </Text>
          </View>
        </View>

        <View style={styles.toastEnd}>
          {isWin && (item.multiplier ?? 0) > 0 ? (
            <View style={[styles.multPill, isBigWin && styles.multPillBig]}>
              <Text style={styles.multPillText}>×{formatMult(item.multiplier ?? 0)}</Text>
            </View>
          ) : null}
          <View style={styles.amountEndRow}>
            <CoinIcon size={13} />
            <Text variant="caption" weight="bold" style={isWin || isRecharge ? styles.winAmount : styles.betAmount}>
              {isWin
                ? `+${formatAmount(item.winAmount ?? 0)}`
                : isRecharge
                  ? `+${formatAmount(item.stake)}`
                  : formatAmount(item.stake)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

type QueuedToast = { id: string; item: CasinoActivityItem };

type Props = {
  topOffset?: number;
};

export function CasinoLiveStackFeed({ topOffset = 168 }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, loading } = useCasinoLiveActivity();
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const enqueue = useCallback(
    (item: CasinoActivityItem) => {
      setToasts((prev) => [{ id: item.id, item }, ...prev].slice(0, MAX_TOASTS));
      const timer = setTimeout(() => removeToast(item.id), TOAST_TTL_MS);
      timersRef.current.set(item.id, timer);
    },
    [removeToast],
  );

  useEffect(() => {
    if (loading) return;

    if (!readyRef.current) {
      items.forEach((i) => seenRef.current.add(i.id));
      readyRef.current = true;
      return;
    }

    const fresh = items.filter((i) => !seenRef.current.has(i.id));
    if (fresh.length === 0) return;

    fresh
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((item) => {
        seenRef.current.add(item.id);
        enqueue(item);
      });
  }, [items, loading, enqueue]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const goProfile = useCallback(
    (uid: string) => router.push(`/profile/${uid}` as any),
    [router],
  );

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.overlay, { paddingTop: topOffset }]} pointerEvents="box-none">
      <View style={styles.stack} pointerEvents="box-none">
        <View style={styles.livePill}>
          <LiveDot />
          <Text variant="caption" weight="bold" style={styles.liveLabel}>
            LIVE
          </Text>
          <Text variant="caption" style={styles.liveHint} numberOfLines={1}>
            {t('casino.liveFeed.hint')}
          </Text>
        </View>
        {toasts.map((toast, index) => (
          <LiveToast
            key={toast.id}
            item={toast.item}
            index={index}
            onPress={() => goProfile(toast.item.uid)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: spacing.base,
  },
  stack: {
    gap: 0,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginBottom: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveLabel: {
    color: '#FCA5A5',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  liveHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    maxWidth: 220,
  },
  toastWrap: {
    width: '100%',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(32, 10, 10, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...shadows.md,
  },
  toastBigWin: {
    borderColor: 'rgba(52,211,153,0.55)',
    backgroundColor: 'rgba(6,47,35,0.92)',
  },
  toastLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeBet: { backgroundColor: 'rgba(225, 20, 20,0.35)' },
  typeBadgeWin: { backgroundColor: 'rgba(16,185,129,0.35)' },
  typeBadgeRecharge: { backgroundColor: 'rgba(5,150,105,0.35)' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toastBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
  },
  gameThumb: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  gameThumbFallback: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastEnd: {
    alignItems: 'flex-end',
    gap: 4,
  },
  multPill: {
    backgroundColor: 'rgba(16,185,129,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  multPillBig: { backgroundColor: 'rgba(52,211,153,0.55)' },
  multPillText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '900',
  },
  amountEndRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  betAmount: {
    color: '#E5E7EB',
    fontSize: 11,
  },
  winAmount: {
    color: '#6EE7B7',
    fontSize: 11,
  },
});
