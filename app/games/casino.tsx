/**
 * ألعاب الكازينو — الست ألعاب المميزة عبر WebView
 */
import React, { useMemo, useState, useEffect } from 'react';
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
import { Dices, Trophy, Radio } from 'lucide-react-native';

import { Text, BackButton, CoinIcon } from '@/components/ui';
import { CasinoGameCard } from '@/components/games/CasinoGameCard';
import { CasinoTopWinnersTab } from '@/components/games/CasinoTopWinnersTab';
import { CasinoLivePlayersTab } from '@/components/games/CasinoLivePlayersTab';
import { CasinoLiveStackFeed } from '@/components/games/CasinoLiveStackFeed';
import { getCasinoGames } from '@/constants/casinoGames';
import { useConfig } from '@/contexts/ConfigContext';
import { isGameEnabled, isSectionVisible } from '@/utils/gamesVisibility';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoGameHighlights } from '@/hooks/useCasinoGameHighlights';
import { useMarkGamePresence } from '@/hooks/useGamePresence';
import { formatCasinoCoins } from '@/utils/casinoCoins';
import { colors, radius, spacing } from '@/theme';

type CasinoTab = 'games' | 'live' | 'topWinners';

export default function CasinoGamesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const { user } = useAuth();
  const { highlights } = useCasinoGameHighlights(gamesConfig);
  const [activeTab, setActiveTab] = useState<CasinoTab>('games');
  useMarkGamePresence('casino');

  useEffect(() => {
    if (!isSectionVisible(gamesConfig, gamesGlobal, 'casino')) {
      router.replace('/games' as any);
    }
  }, [gamesConfig, gamesGlobal, router]);

  const coins = user?.stats?.coins ?? 0;
  const casinoCoins = user?.stats?.casinoCoins ?? 0;
  const numColumns = width > 600 ? 3 : 2;
  const gap = spacing.sm;
  const cardW = (width - spacing.base * 2 - gap * (numColumns - 1)) / numColumns;

  const games = useMemo(() => {
    const all = getCasinoGames();
    return all.filter((g) => isGameEnabled(gamesConfig, gamesGlobal, g.id));
  }, [gamesConfig, gamesGlobal, i18n.language]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0405' : '#F7F7F9' }]}>
      <LinearGradient
        colors={isDark ? ['#2A0A10', '#100406'] : ['#FFE6E9', '#F7F7F9']}
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
            <Dices size={22} color="#E11414" strokeWidth={2.2} />
            <Text variant="h3" weight="bold" numberOfLines={1}>
              {t('games.text72931') || 'ألعاب الكازينو'}
            </Text>
          </View>
          <View style={styles.balanceCol}>
            <View style={styles.coinsChip}>
              <CoinIcon size={15} />
              <Text variant="caption" weight="bold" color="#F59E0B" numberOfLines={1}>
                {coins.toLocaleString()}
              </Text>
            </View>
            {casinoCoins > 0 ? (
              <Text variant="caption" color="rgba(225, 20, 20,0.85)" style={styles.casinoBal}>
                {t('casino.casinoBalance', { amount: formatCasinoCoins(casinoCoins) })}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.tabsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(225, 20, 20,0.08)' }]}>
          <Pressable
            onPress={() => setActiveTab('games')}
            style={[styles.tab, activeTab === 'games' && styles.tabActive]}
          >
            <Dices size={15} color={activeTab === 'games' ? colors.white : '#E11414'} strokeWidth={2.2} />
            <Text
              variant="caption"
              weight={activeTab === 'games' ? 'bold' : 'medium'}
              color={activeTab === 'games' ? colors.white : isDark ? 'rgba(255,255,255,0.65)' : '#8A0E0E'}
            >
              {t('casino.tabs.games')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('live')}
            style={[styles.tab, activeTab === 'live' && styles.tabActive]}
          >
            <Radio size={14} color={activeTab === 'live' ? colors.white : '#EF4444'} strokeWidth={2.5} />
            <Text
              variant="caption"
              weight={activeTab === 'live' ? 'bold' : 'medium'}
              color={activeTab === 'live' ? colors.white : isDark ? 'rgba(255,255,255,0.65)' : '#8A0E0E'}
              numberOfLines={1}
            >
              {t('casino.tabs.live')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('topWinners')}
            style={[styles.tab, activeTab === 'topWinners' && styles.tabActive]}
          >
            <Trophy size={15} color={activeTab === 'topWinners' ? colors.white : '#F59E0B'} strokeWidth={2.2} />
            <Text
              variant="caption"
              weight={activeTab === 'topWinners' ? 'bold' : 'medium'}
              color={activeTab === 'topWinners' ? colors.white : isDark ? 'rgba(255,255,255,0.65)' : '#8A0E0E'}
            >
              {t('casino.tabs.topWinners')}
            </Text>
          </Pressable>
        </View>

        {activeTab === 'games' ? (
          games.length > 0 ? (
            <View style={[styles.grid, { gap }]}>
              {games.map((game) => (
                <CasinoGameCard
                  key={game.id}
                  game={game}
                  cardW={cardW}
                  highlights={highlights[game.id]}
                  onPress={() => router.push(game.route as any)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text variant="body" color="rgba(26, 10, 12,0.55)" align="center">
                {t('casino.empty')}
              </Text>
            </View>
          )
        ) : activeTab === 'live' ? (
          <CasinoLivePlayersTab />
        ) : (
          <CasinoTopWinnersTab />
        )}
      </ScrollView>
      {activeTab !== 'live' ? (
        <CasinoLiveStackFeed topOffset={insets.top + 152} />
      ) : null}
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
    marginBottom: spacing.md,
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  balanceCol: {
    alignItems: 'flex-end',
    maxWidth: 130,
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  casinoBal: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    minWidth: 0,
  },
  tabActive: {
    backgroundColor: '#E11414',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  empty: {
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
});
