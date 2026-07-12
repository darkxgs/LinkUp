/**
 * كروت ألعاب التحدي والذكاء والكازينو واليانصيب — الشاشة الرئيسية
 */
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Swords, Brain, Sparkles, Dices, Ticket } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { lu } from '@/theme/lu-brand';
import { getCasinoGames } from '@/constants/casinoGames';
import { useConfig } from '@/contexts/ConfigContext';
import { isGameEnabled, isSectionVisible, type GameSectionId } from '@/utils/gamesVisibility';

type PromoCard = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  route: string;
  Icon: typeof Swords;
  image: number;
  gradient: readonly [string, string];
  accent: string;
};

type Props = {
  pad: number;
  cardW: number;
  gap?: number;
  /** إخفاء تصنيفات (مثلاً اليانصيب عند وجود بanner مميز) */
  exclude?: GameSectionId[];
};

function GamePromoCardsInner({ pad, cardW, gap = 12, exclude = [] }: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const isAr = i18n.language?.startsWith('ar');
  const cardH = 108;
  const casinoCount = getCasinoGames().filter((g) =>
    isGameEnabled(gamesConfig, gamesGlobal, g.id),
  ).length;

  const topRow: PromoCard[] = useMemo(() => {
    const cards: PromoCard[] = [
      {
        id: 'challenges',
        title: t('challenges.promoTitle'),
        subtitle: t('challenges.promoSubtitle'),
        cta: t('challenges.promoCta'),
        route: '/games/challenges',
        Icon: Swords,
        image: require('../../../assets/images/game_challenges.webp'),
        gradient: ['rgba(239, 68, 68, 0.88)', 'rgba(153, 27, 27, 0.92)'],
        accent: '#FCA5A5',
      },
      {
        id: 'intelligence',
        title: isAr ? 'ألعاب الذكاء' : 'Brain Games',
        subtitle: isAr ? 'أعلام • ذاكرة • تسلسل' : 'Flags • Memory • Sequence',
        cta: isAr ? 'ابدأ اللعب' : 'Start',
        route: '/games/intelligence',
        Icon: Brain,
        image: require('../../../assets/images/game_flag.webp'),
        gradient: ['rgba(225, 20, 20, 0.88)', 'rgba(149, 29, 29, 0.92)'],
        accent: '#FCA5A5',
      },
    ];
    return cards.filter(
      (c) =>
        !exclude.includes(c.id as GameSectionId)
        && isSectionVisible(gamesConfig, gamesGlobal, c.id as GameSectionId),
    );
  }, [gamesConfig, gamesGlobal, t, isAr, exclude]);

  const bottomRow: PromoCard[] = useMemo(() => {
    const cards: PromoCard[] = [
      {
        id: 'casino',
        title: isAr ? 'ألعاب الكازينو' : 'Casino Games',
        subtitle: isAr
          ? `${casinoCount} لعبة • بلينكو • كراش`
          : `${casinoCount} games • Plinko • Crash`,
        cta: isAr ? 'عرض الكل' : 'View all',
        route: '/games/casino',
        Icon: Dices,
        image: require('../../../assets/images/game_slot.webp'),
        gradient: ['rgba(225, 20, 20, 0.9)', 'rgba(225, 20, 20, 0.92)'],
        accent: '#FBD5D5',
      },
      {
        id: 'lottery',
        title: t('games.weeklyLottery.title'),
        subtitle: isAr ? 'جائزة أسبوعية • اشترِ تذكرة' : 'Weekly prize • Buy a ticket',
        cta: isAr ? 'شارك الآن' : 'Join now',
        route: '/lottery',
        Icon: Ticket,
        image: require('../../../assets/images/game_coin.webp'),
        gradient: ['rgba(245, 158, 11, 0.9)', 'rgba(234, 88, 12, 0.94)'],
        accent: '#FDE68A',
      },
    ];
    return cards.filter(
      (c) =>
        !exclude.includes(c.id as GameSectionId)
        && isSectionVisible(gamesConfig, gamesGlobal, c.id as GameSectionId),
    );
  }, [gamesConfig, gamesGlobal, t, isAr, casinoCount, exclude]);

  if (topRow.length === 0 && bottomRow.length === 0) return null;

  const renderCard = (card: PromoCard) => {
    const CardIcon = card.Icon;
    return (
      <Pressable
        key={card.id}
        onPress={() => router.push(card.route as any)}
        style={({ pressed }) => [
          styles.card,
          { width: cardW, height: cardH, opacity: pressed ? 0.94 : 1 },
        ]}
      >
        <Image source={card.image} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={[...card.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.decorIcon} pointerEvents="none">
          <CardIcon size={72} color="rgba(255,255,255,0.12)" strokeWidth={1.5} />
        </View>
        <View style={styles.spark} pointerEvents="none">
          <Sparkles size={11} color="#fff" fill="#fff" strokeWidth={0} />
        </View>
        <View style={styles.topRow}>
          <View style={styles.iconBadge}>
            <CardIcon size={16} color="#fff" strokeWidth={2.2} />
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {card.subtitle}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text style={[styles.ctaText, { color: card.accent }]}>{card.cta}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ marginHorizontal: pad, marginBottom: 10 }}>
      {topRow.length > 0 ? (
        <View style={[styles.row, { gap, marginBottom: gap }]}>
          {topRow.map(renderCard)}
        </View>
      ) : null}
      {bottomRow.length > 0 ? (
        <View style={[styles.row, { gap }]}>
          {bottomRow.map(renderCard)}
        </View>
      ) : null}
    </View>
  );
}

export const GamePromoCards = memo(GamePromoCardsInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginTop: 6,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 11,
    justifyContent: 'space-between',
    ...lu.shadows.card,
  },
  decorIcon: {
    position: 'absolute',
    top: -8,
    end: -10,
  },
  spark: {
    position: 'absolute',
    top: 38,
    start: 14,
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ctaText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
