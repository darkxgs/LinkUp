import React, { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Flame, Gamepad2, Percent, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import { radius, shadows } from '@/theme';
import type { CasinoGameItem } from '@/constants/casinoGames';
import type { CasinoHighlightKind } from '@/hooks/useCasinoGameHighlights';

type Props = {
  game: CasinoGameItem;
  cardW: number;
  highlights?: CasinoHighlightKind[];
  onPress: () => void;
};

const HIGHLIGHT_META: Record<
  CasinoHighlightKind,
  { Icon: typeof Flame; colors: [string, string]; i18nKey: string }
> = {
  trending: {
    Icon: TrendingUp,
    colors: ['#FF6B35', '#EF4444'],
    i18nKey: 'casino.highlights.trending',
  },
  mostPlayed: {
    Icon: Gamepad2,
    colors: ['#E11414', '#B00E0E'],
    i18nKey: 'casino.highlights.mostPlayed',
  },
  highestRtp: {
    Icon: Percent,
    colors: ['#059669', '#D97706'],
    i18nKey: 'casino.highlights.highestRtp',
  },
};

export const CasinoGameCard = memo(function CasinoGameCard({
  game,
  cardW,
  highlights = [],
  onPress,
}: Props) {
  const { t } = useTranslation();
  const GameIcon = game.Icon;
  const cardH = Math.round(Math.max(156, Math.min(196, cardW * 0.92)));
  const imageSize = Math.round(Math.min(88, Math.max(64, cardW * 0.38)));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width: cardW, height: cardH, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <LinearGradient colors={game.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Image
        source={game.image}
        style={[styles.gameImage, { width: imageSize, height: imageSize }]}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={game.id}
      />
      <View style={styles.iconFallback} pointerEvents="none">
        <GameIcon size={22} color="rgba(255,255,255,0.3)" strokeWidth={2} />
      </View>
      {highlights.length > 0 ? (
        <View style={styles.badges}>
          {highlights.map((kind) => {
            const meta = HIGHLIGHT_META[kind];
            const BadgeIcon = meta.Icon;
            return (
              <LinearGradient
                key={kind}
                colors={meta.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <BadgeIcon size={9} color="#fff" strokeWidth={2.5} />
                <Text style={styles.badgeText}>{t(meta.i18nKey)}</Text>
              </LinearGradient>
            );
          })}
        </View>
      ) : null}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={styles.footer}>
        <View style={styles.textBlock}>
          <Text variant="body" weight="bold" color="#fff" numberOfLines={1}>
            {game.name}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.9)" numberOfLines={2} style={styles.desc}>
            {game.desc}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {game.minBet != null ? (
            <View style={styles.minBet}>
              <CoinIcon size={11} />
              <Text variant="caption" color="#FDE68A" weight="bold" style={styles.minBetText}>
                من {game.minBet.toLocaleString()}
              </Text>
            </View>
          ) : null}
          <View style={styles.playCircle}>
            <ChevronLeft size={12} color="#fff" strokeWidth={3} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: 8,
    ...shadows.md,
    elevation: 4,
  },
  gameImage: {
    position: 'absolute',
    top: 12,
    end: 8,
    zIndex: 2,
  },
  iconFallback: {
    position: 'absolute',
    top: 48,
    start: 14,
    zIndex: 1,
  },
  badges: {
    position: 'absolute',
    top: 10,
    start: 10,
    zIndex: 3,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: '72%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    zIndex: 2,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  textBlock: {
    marginBottom: 6,
  },
  desc: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minBet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minBetText: {
    fontSize: 10,
  },
  playCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
