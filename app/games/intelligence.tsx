/**
 * ألعاب الذكاء — شاشة مخصصة سريعة ومستجيبة
 */
import React, { memo, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Brain, Grid3x3, Flag, Sparkles, ChevronLeft } from 'lucide-react-native';

import { Text, BackButton } from '@/components/ui';
import { CoinAmount } from '@/components/wallet/CoinAmount';
import { CoinBalanceBar } from '@/components/wallet/CoinBalanceBar';
import { getIntelligenceStakeOptions } from '@/services/games/stakeChips';
import { getIntelligenceWinMultiplier } from '@/services/firebase/gamesConfig';
import { isGameEnabled, isSectionVisible } from '@/utils/gamesVisibility';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/hooks/useAuth';
import { useMarkGamePresence } from '@/hooks/useGamePresence';
import { radius, spacing, shadows } from '@/theme';

const HOST = 'https://linkup-dc45f.web.app/games';

type IntelGame = {
  id: string;
  nameKey: string;
  nameFallback: string;
  descKey: string;
  descFallback: string;
  Icon: typeof Brain;
  colors: [string, string];
  image: number;
  route: string;
  isNew?: boolean;
};

const INTEL_GAMES_CONFIG: IntelGame[] = [
  {
    id: 'flag-guess',
    nameKey: 'games.text64093',
    nameFallback: 'خمّن المعلم',
    descKey: 'games.text78847',
    descFallback: 'معالم حقيقية — اختر الدولة الصحيحة',
    Icon: Flag,
    colors: ['#B02121', '#ED6D6D'],
    image: require('../../assets/images/game_flag.png'),
    route: `/games/webview?url=${HOST}/flag-guess/&name=Flag%20Guess`,
    isNew: true,
  },
  {
    id: 'memory-match',
    nameKey: 'games.text38712',
    nameFallback: 'مطابقة الذاكرة',
    descKey: 'games.text21770',
    descFallback: 'اعثر على الأزواج المتطابقة',
    Icon: Grid3x3,
    colors: ['#C40E1E', '#ff6a00'],
    image: require('../../assets/images/game_memory.png'),
    route: `/games/webview?url=${HOST}/memory-match/&name=Memory%20Match`,
  },
  {
    id: 'sequence-memory',
    nameKey: 'games.text19497',
    nameFallback: 'تذكر التسلسل',
    descKey: 'games.text34319',
    descFallback: 'احفظ الترتيب وكرّره',
    Icon: Brain,
    colors: ['#FF3340', '#B00E0E'],
    image: require('../../assets/images/game_sequence.png'),
    route: `/games/webview?url=${HOST}/sequence-memory/&name=Sequence%20Memory`,
  },
];

const IntelligenceGameCard = memo(function IntelligenceGameCard({
  game,
  name,
  desc,
  cardW,
  onPress,
}: {
  game: IntelGame;
  name: string;
  desc: string;
  cardW: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const GameIcon = game.Icon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width: cardW, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <LinearGradient
        colors={game.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardGlow} pointerEvents="none" />

      {game.isNew ? (
        <View style={styles.newBadge}>
          <Sparkles size={10} color="#fff" />
          <Text style={styles.newText}>{t('store.new')}</Text>
        </View>
      ) : null}

      <Image
        source={game.image}
        style={styles.gameImage}
        contentFit="contain"
        cachePolicy="memory-disk"
      />

      <View style={styles.iconFallback} pointerEvents="none">
        <GameIcon size={22} color="rgba(255,255,255,0.35)" strokeWidth={2} />
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
        style={styles.textScrim}
        pointerEvents="none"
      />

      <View style={styles.cardFooter}>
        <View style={styles.cardTextBlock}>
          <Text variant="body" weight="bold" color="#fff" numberOfLines={1} style={styles.gameTitle}>
            {name}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.92)" numberOfLines={2} style={styles.gameDesc}>
            {desc}
          </Text>
        </View>
        <View style={styles.playCircle}>
          <ChevronLeft size={14} color="#fff" strokeWidth={3} />
        </View>
      </View>
    </Pressable>
  );
});

export default function IntelligenceGamesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const { user } = useAuth();
  useMarkGamePresence('intelligence');

  useEffect(() => {
    if (!isSectionVisible(gamesConfig, gamesGlobal, 'intelligence')) {
      router.replace('/games' as any);
    }
  }, [gamesConfig, gamesGlobal, router]);

  const coins = user?.stats?.coins ?? 0;
  const numColumns = width > 600 ? 3 : 2;
  const gap = spacing.sm;
  const cardW = (width - spacing.base * 2 - gap * (numColumns - 1)) / numColumns;

  const games = useMemo(
    () =>
      INTEL_GAMES_CONFIG.filter((g) => isGameEnabled(gamesConfig, gamesGlobal, g.id)).map((g) => {
        const winMult = getIntelligenceWinMultiplier(gamesConfig, g.id);
        return {
          ...g,
          winMult,
          name: (() => {
            const translated = t(g.nameKey);
            return translated && translated !== g.nameKey ? translated : g.nameFallback;
          })(),
          desc: (() => {
            const translated = t(g.descKey);
            return translated && translated !== g.descKey ? translated : g.descFallback;
          })(),
        };
      }),
    [gamesConfig, gamesGlobal, t, i18n.language],
  );

  const defaultWinMult = games.length > 0
    ? Math.max(...games.map((g) => g.winMult))
    : getIntelligenceWinMultiplier(gamesConfig, 'flag-guess');
  const stakeChips = getIntelligenceStakeOptions(
    gamesGlobal,
    gamesConfig.find((g) => g.id === 'flag-guess') ?? gamesConfig[0]!,
  );
  const exampleStake = stakeChips[0] ?? 5000;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0405' : '#F7F7F9' }]}>
      <LinearGradient
        colors={isDark ? ['#1A0A0C', '#100406'] : ['#FECACA', '#F7F7F9']}
        style={styles.headerBg}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.base,
          paddingBottom: insets.bottom + spacing['3xl'],
          paddingHorizontal: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackButton />
          <View style={styles.titleRow}>
            <Brain size={22} color="#E11414" strokeWidth={2.2} />
            <Text variant="h3" weight="bold" numberOfLines={1}>
              {t('games.text90916') || 'ألعاب الذكاء'}
            </Text>
          </View>
          <View style={styles.coinsChip}>
            <CoinAmount amount={coins} size="sm" />
          </View>
        </View>

        <CoinBalanceBar
          label={t('games.text76838') || 'رصيدك الحالي'}
          amount={coins}
          dark={isDark}
        />

        <View style={styles.subtitleBlock}>
          <Text variant="bodySmall" color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(26, 10, 12,0.65)'}>
            {t('games.intelDailyHint')}
          </Text>
          <View style={styles.stakeRow}>
            {stakeChips.map((chip, index) => (
              <React.Fragment key={chip}>
                {index > 0 ? (
                  <Text variant="caption" color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26, 10, 12,0.45)'}>
                    ·
                  </Text>
                ) : null}
                <CoinAmount amount={chip} size="xs" />
              </React.Fragment>
            ))}
          </View>
          <Text variant="bodySmall" color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(26, 10, 12,0.65)'} style={styles.subtitleTail}>
            {t('games.intelProfitIntro')}
          </Text>
          <View style={styles.exampleRow}>
            <CoinAmount amount={exampleStake} size="xs" />
            <Text variant="bodySmall" color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(26, 10, 12,0.65)'}>
              {' '}× {defaultWinMult} ={' '}
            </Text>
            <CoinAmount amount={exampleStake * defaultWinMult} size="xs" />
          </View>
        </View>

        <View style={[styles.grid, { gap }]}>
          {games.map((game) => (
            <IntelligenceGameCard
              key={game.id}
              game={game}
              name={game.name}
              desc={game.desc}
              cardW={cardW}
              onPress={() => router.push(game.route as any)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 150,
  },
  subtitleBlock: {
    marginBottom: spacing.md,
    gap: 6,
  },
  stakeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  subtitleTail: {
    lineHeight: 20,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    height: 172,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.md,
    elevation: 4,
  },
  cardGlow: {
    position: 'absolute',
    top: -24,
    end: -24,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    start: 10,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  newText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  gameImage: {
    position: 'absolute',
    top: 14,
    end: 10,
    width: 78,
    height: 78,
    zIndex: 2,
  },
  iconFallback: {
    position: 'absolute',
    top: 52,
    start: 14,
    zIndex: 1,
  },
  textScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    zIndex: 2,
  },
  cardFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
  },
  cardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  gameTitle: {
    fontSize: 15,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gameDesc: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 2,
  },
});
