import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain, Dices, Ticket, Zap, ChevronDown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { lu } from '@/theme/lu-brand';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { ChevronRight } from '@/components/ui/RtlIcons';
import { useGamePresenceCounts } from '@/hooks/useGamePresence';
import { useConfig } from '@/contexts/ConfigContext';
import { isSectionVisible, type GameSectionId } from '@/utils/gamesVisibility';
import type { GameCategory } from '@/services/firebase/gamePresence';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type GameCardDef = {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  subKey: string;
  grad: readonly [string, string];
  route: string;
};

const GAME_CARDS: GameCardDef[] = [
  {
    id: 'challenges',
    icon: Zap,
    titleKey: 'home.gameChallenges',
    subKey: 'home.gameChallengesSub',
    grad: ['#FF2D2D', '#B00E0E'],
    route: '/games/challenges',
  },
  {
    id: 'intelligence',
    icon: Brain,
    titleKey: 'home.gameBrain',
    subKey: 'home.gameBrainSub',
    grad: ['#FF5C5C', '#C40E1E'],
    route: '/games/intelligence',
  },
  {
    id: 'casino',
    icon: Dices,
    titleKey: 'home.gameCasino',
    subKey: 'home.gameCasinoSub',
    grad: ['#B00E0E', '#3A0A0A'],
    route: '/games/casino',
  },
  {
    id: 'lottery',
    icon: Ticket,
    titleKey: 'home.gameLottery',
    subKey: 'home.gameLotterySub',
    grad: ['#FBBF24', '#EA580C'],
    route: '/lottery',
  },
];

type Props = {
  pad: number;
  onNavigate: (route: string) => void;
};

export function HomeGamesHub({ pad, onNavigate }: Props) {
  const { t, isRTL: isRtl } = useAppLanguage();
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const ROW = 'row';
  const [expanded, setExpanded] = useState(false);
  const presence = useGamePresenceCounts();

  const visibleCards = useMemo(
    () =>
      GAME_CARDS.filter((c) =>
        isSectionVisible(gamesConfig, gamesGlobal, c.id as GameSectionId),
      ),
    [gamesConfig, gamesGlobal],
  );

  if (visibleCards.length === 0) return null;

  const totalOnline = visibleCards.reduce(
    (sum, c) => sum + (presence[c.id as GameCategory] ?? 0),
    0,
  );
  const fmt = (n: number) => n.toLocaleString(isRtl ? 'ar-EG' : 'en-US');

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={{ paddingHorizontal: pad, marginTop: 4 }}>
      <View style={[styles.sectionHead, { flexDirection: ROW }]}>
        <Text style={styles.sectionTitle}>{t('home.gamesSection')}</Text>
        <Pressable onPress={toggle} hitSlop={8}>
          <Text style={styles.viewAll}>{expanded ? t('home.gamesCollapse') : t('home.gamesExpand')}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.hubBanner, { opacity: pressed ? 0.94 : 1 }]}
      >
        <LinearGradient
          colors={['#FF2D2D', '#B00E0E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.hubRow, { flexDirection: ROW }]}>
          <View style={styles.hubIconBox}>
            <Dices size={26} color="#FFD700" strokeWidth={2} />
          </View>
          <View style={styles.hubBody}>
            <Text style={styles.hubTitle}>{t('home.gamesHubTitle')}</Text>
            {totalOnline > 0 ? (
              <View style={[styles.hubLivePill, { flexDirection: ROW }]}>
                <View style={styles.liveDot} />
                <Text style={styles.hubLiveText} numberOfLines={1}>
                  {t('home.gamesOnlineNow', { n: fmt(totalOnline) })}
                </Text>
              </View>
            ) : (
              <Text style={styles.hubSub} numberOfLines={2}>
                {t('home.gamesHubSubtitle')}
              </Text>
            )}
          </View>
          <View style={[styles.hubRight, { flexDirection: ROW }]}>
            <View style={styles.hubCountBadge}>
              <Text style={styles.hubCountText}>{visibleCards.length}</Text>
            </View>
            <ChevronDown
              size={18}
              color="#fff"
              strokeWidth={2.5}
              style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
            />
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.gameList}>
          {visibleCards.map((g) => {
            const GIcon = g.icon;
            const playing = presence[g.id as GameCategory] ?? 0;
            return (
              <Pressable
                key={g.id}
                onPress={() => onNavigate(g.route)}
                style={({ pressed }) => [styles.gameRow, { opacity: pressed ? 0.92 : 1 }]}
              >
                <LinearGradient
                  colors={[...g.grad]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={[styles.gameRowInner, { flexDirection: ROW }]}>
                  <View style={styles.gameIconBox}>
                    <GIcon size={22} color="#fff" strokeWidth={2} />
                  </View>
                  <View style={styles.gameBody}>
                    <Text style={styles.gameTitle}>{t(g.titleKey)}</Text>
                    {playing > 0 ? (
                      <View style={[styles.gameLiveRow, { flexDirection: ROW }]}>
                        <View style={styles.liveDot} />
                        <Text style={styles.gameLiveText} numberOfLines={1}>
                          {t('home.gamePlayingNow', { n: fmt(playing) })}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.gameSub} numberOfLines={1}>{t(g.subKey)}</Text>
                    )}
                  </View>
                  <View style={[styles.gameCta, { flexDirection: ROW }]}>
                    <Text style={styles.gameCtaText}>{t('home.gameOpen')}</Text>
                    <ChevronRight size={12} color="#15151A" />
                  </View>
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={() => onNavigate('/games')} style={styles.allGamesLink}>
            <Text style={styles.allGamesText}>{t('home.viewAll')}</Text>
            <ChevronRight size={14} color="#E11414" />
          </Pressable>
        </View>
      ) : null}
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
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
  },
  viewAll: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#E11414',
    fontFamily: lu.fonts.bodyBold,
  },
  hubBanner: {
    borderRadius: lu.radius.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  hubRow: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  hubIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  hubBody: { flex: 1, minWidth: 0 },
  hubTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
  },
  hubSub: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    lineHeight: 15,
    fontFamily: lu.fonts.body,
  },
  hubLivePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  hubLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22E06B',
  },
  hubRight: { alignItems: 'center', gap: 8 },
  hubCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  hubCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gameList: { marginTop: 10, gap: 8 },
  gameRow: {
    borderRadius: lu.radius.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  gameRowInner: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  gameIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  gameBody: { flex: 1, minWidth: 0 },
  gameTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gameSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    fontFamily: lu.fonts.body,
  },
  gameLiveRow: {
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  gameLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gameCta: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  gameCtaText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
  },
  allGamesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  allGamesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11414',
    fontFamily: lu.fonts.bodyBold,
  },
});
