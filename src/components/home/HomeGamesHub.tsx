import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { lu } from '@/theme/lu-brand';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { ChevronRight } from '@/components/ui/RtlIcons';
import { useGamePresenceCounts } from '@/hooks/useGamePresence';
import { useConfig } from '@/contexts/ConfigContext';
import { isSectionVisible, type GameSectionId } from '@/utils/gamesVisibility';
import type { GameCategory } from '@/services/firebase/gamePresence';
import { getWeekTicketStats, getCurrentLotteryWeekId } from '@/services/firebase/weeklyLotterySystem';

type GameCardDef = {
  id: string;
  image: number;
  titleKey: string;
  subKey: string;
  route: string;
  glow: string;
  tagKey?: string;
};

const GAME_CARDS: GameCardDef[] = [
  {
    id: 'challenges',
    image: require('../../../assets/images/hub_challenges.png'),
    titleKey: 'home.gameChallenges',
    subKey: 'home.gameChallengesSub',
    route: '/games/challenges',
    glow: '#FF4A2E',
  },
  {
    id: 'intelligence',
    image: require('../../../assets/images/hub_brain.png'),
    titleKey: 'home.gameBrain',
    subKey: 'home.gameBrainSub',
    route: '/games/intelligence',
    glow: '#FF2E6B',
    tagKey: 'home.gameTag20x',
  },
  {
    id: 'casino',
    image: require('../../../assets/images/hub_casino.png'),
    titleKey: 'home.gameCasino',
    subKey: 'home.gameCasinoSub',
    route: '/games/casino',
    glow: '#FF2E4C',
  },
  {
    id: 'lottery',
    image: require('../../../assets/images/hub_lottery.png'),
    titleKey: 'home.gameLottery',
    subKey: 'home.gameLotterySub',
    route: '/lottery',
    glow: '#FF9A2E',
  },
];

type Props = {
  pad: number;
  onNavigate: (route: string) => void;
  dark?: boolean;
};

export function HomeGamesHub({ pad, onNavigate, dark = true }: Props) {
  const { t, isRTL: isRtl } = useAppLanguage();
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const ROW = 'row';
  const presence = useGamePresenceCounts();
  const [ticketsSold, setTicketsSold] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getWeekTicketStats(getCurrentLotteryWeekId())
      .then(({ totalTickets }) => { if (!cancelled) setTicketsSold(totalTickets); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visibleCards = useMemo(
    () =>
      GAME_CARDS.filter((c) =>
        isSectionVisible(gamesConfig, gamesGlobal, c.id as GameSectionId),
      ),
    [gamesConfig, gamesGlobal],
  );

  if (visibleCards.length === 0) return null;

  const fmt = (n: number) => n.toLocaleString(isRtl ? 'ar-EG' : 'en-US');

  return (
    <View style={{ paddingHorizontal: pad, marginTop: 22 }}>
      <View style={[styles.sectionHead, { flexDirection: ROW }]}>
        <Text style={[styles.sectionTitle, !dark && { color: '#15151A' }]}>{t('home.gamesSection')}</Text>
        <Pressable onPress={() => onNavigate('/games')} hitSlop={8}>
          <Text style={[styles.viewAll, !dark && { color: '#E11414' }]}>{t('home.viewAll')}</Text>
        </Pressable>
      </View>

      <View style={[styles.cardGrid, { flexDirection: ROW }]}>
          {visibleCards.map((g) => {
            const playing = presence[g.id as GameCategory] ?? 0;
            return (
              <Pressable
                key={g.id}
                onPress={() => onNavigate(g.route)}
                style={({ pressed }) => [
                  styles.gameCard,
                  !dark && styles.gameCardLight,
                  { transform: [{ scale: pressed ? 0.96 : 1 }] },
                ]}
              >
                <LinearGradient
                  colors={dark ? ['#2A1216', '#170B0E'] : ['#FFFFFF', '#FBF1F1']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View>
                  <View style={[styles.coin, { shadowColor: g.glow }]}>
                    <Image source={g.image} style={styles.coinImg} contentFit="cover" />
                  </View>
                  {g.tagKey ? (
                    <LinearGradient
                      colors={['#FFC53D', '#FF7A2E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.coinTag}
                    >
                      <Text style={styles.coinTagText}>{t(g.tagKey)}</Text>
                    </LinearGradient>
                  ) : null}
                </View>
                <Text
                  style={[styles.cardTitle, !dark && { color: '#15151A' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {t(g.titleKey)}
                </Text>
                {(g.id === 'lottery' ? ticketsSold : playing) > 0 ? (
                  <View style={[styles.cardLiveRow, { flexDirection: ROW }]}>
                    <View style={[styles.liveDot, g.id === 'lottery' && styles.liveDotGold]} />
                    <Text
                      style={[
                        styles.cardLiveText,
                        g.id === 'lottery' && styles.cardLiveTextGold,
                        !dark && { color: g.id === 'lottery' ? '#B8860B' : '#0E9F55' },
                      ]}
                      numberOfLines={1}
                    >
                      {g.id === 'lottery'
                        ? t('home.gameTicketsSold', { n: fmt(ticketsSold) })
                        : t('home.gamePlayingNow', { n: fmt(playing) })}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.cardSub, !dark && { color: '#6B7280' }]} numberOfLines={1}>{t(g.subKey)}</Text>
                )}
                <View style={[styles.playBtn, !dark && styles.playBtnLight, { flexDirection: ROW }]}>
                  <Text style={[styles.playText, !dark && { color: '#B00E0E' }]}>{t(g.id === 'lottery' ? 'home.gameJoin' : 'home.gameOpen')}</Text>
                  <ChevronRight size={11} color={dark ? '#FF8090' : '#B00E0E'} />
                </View>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: lu.colors.nightInk,
    fontFamily: lu.fonts.bodyHeavy,
  },
  viewAll: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FF5C5C',
    fontFamily: lu.fonts.bodyBold,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22E06B',
  },
  cardGrid: {
    gap: 8,
    alignItems: 'stretch',
  },
  gameCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,70,80,0.22)',
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  gameCardLight: {
    borderColor: 'rgba(225,20,20,0.14)',
    shadowColor: '#9A1414',
    shadowOpacity: 0.12,
  },
  coin: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  coinImg: {
    width: 74,
    height: 74,
  },
  coinTag: {
    position: 'absolute',
    top: -5,
    end: -9,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 99,
    borderWidth: 1.2,
    borderColor: '#170B0E',
    shadowColor: '#FF9A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  coinTagText: {
    color: '#3A1600',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  cardTitle: {
    marginTop: 9,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
    textAlign: 'center',
  },
  cardSub: {
    marginTop: 2,
    minHeight: 16,
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  cardLiveRow: {
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    minHeight: 16,
  },
  cardLiveText: {
    color: '#7CF2AB',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  cardLiveTextGold: {
    color: '#FFD86F',
  },
  liveDotGold: {
    backgroundColor: '#FFC53D',
  },
  playBtn: {
    marginTop: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: 'rgba(160,20,40,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,100,0.3)',
  },
  playBtnLight: {
    backgroundColor: '#FDECEC',
    borderColor: 'rgba(225,20,20,0.25)',
  },
  playText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
});
