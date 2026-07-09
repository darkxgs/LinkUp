/**
 * LinkUp App — مركز الألعاب
 * تصنيفات بنفس تصميم الشاشة الرئيسية + ألعاب كازينو مميزة
 */

import React, { useMemo } from 'react';
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
import {
  Ticket,
  Dices,
  Coins,
  Trophy,
  Zap,
  Crown,
  Flame,
  Gamepad2,
} from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text, Card, BackButton } from '@/components/ui';
import { GamePromoCards } from '@/components/discover/GamePromoCards';
import { CasinoGameCard } from '@/components/games/CasinoGameCard';
import { getCasinoGames } from '@/constants/casinoGames';
import { useConfig } from '@/contexts/ConfigContext';
import { isGameEnabled, isSectionVisible } from '@/utils/gamesVisibility';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoGameHighlights } from '@/hooks/useCasinoGameHighlights';
import { colors, radius, spacing, shadows } from '@/theme';

export default function GamesHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: windowWidth } = useWindowDimensions();
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const { user } = useAuth();
  const { highlights } = useCasinoGameHighlights(gamesConfig);
  const coins = user?.stats?.coins ?? 0;

  const showLottery = isSectionVisible(gamesConfig, gamesGlobal, 'lottery');
  const showCasino = isSectionVisible(gamesConfig, gamesGlobal, 'casino');

  const promoGap = spacing.sm;
  const promoCardW = (windowWidth - spacing.base * 2 - promoGap) / 2;

  const isTablet = windowWidth > 600;
  const numColumns = isTablet ? 3 : 2;
  const gridGap = spacing.sm;
  const cardWidth = (windowWidth - spacing.base * 2 - gridGap * (numColumns - 1)) / numColumns;

  const featuredCasino = useMemo(() => {
    const all = getCasinoGames().filter((g) => isGameEnabled(gamesConfig, gamesGlobal, g.id));
    const hot = all.filter((g) => g.isHot || g.isNew);
    return (hot.length > 0 ? hot : all).slice(0, 6);
  }, [gamesConfig, gamesGlobal]);

  const themeContainerBg = isDark ? '#0A0405' : '#F7F7F9';
  const themeText = isDark ? '#FFFFFF' : '#1A0A0C';
  const themeSubText = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26, 10, 12,0.6)';
  const themeHeaderGrad: readonly [string, string, ...string[]] = isDark
    ? ['#1A0A0C', '#100406', '#0A0405']
    : ['#FEE2E2', '#FCD5D5', '#F7F7F9'];
  const themeCardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)';
  const themeCardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.container, { backgroundColor: themeContainerBg }]}>
      <LinearGradient colors={themeHeaderGrad} style={styles.headerBg} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <View style={styles.titleRow}>
            <Gamepad2 size={24} color="#E11414" strokeWidth={2} />
            <Text variant="h2" weight="bold" color={themeText}>
              {t('games.text86330')}
            </Text>
          </View>
          <Pressable
            style={[styles.coinsButton, isDark && styles.coinsButtonDark]}
            onPress={() => router.push('/wallet/recharge' as any)}
          >
            <Coins size={16} color="#F59E0B" strokeWidth={2.5} />
            <Text variant="caption" weight="bold" color="#F59E0B">
              {coins.toLocaleString()}
            </Text>
          </Pressable>
        </View>

        {/* بanner اليانصيب */}
        {showLottery ? (
          <Pressable
            onPress={() => router.push('/lottery' as any)}
            style={styles.featuredBanner}
          >
            <LinearGradient
              colors={['#E11414', '#FF3340', '#FF2E3E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.featuredGlow1} />
            <View style={styles.featuredGlow2} />
            <View style={styles.featuredContent}>
              <View style={styles.featuredIconWrapper}>
                <Ticket size={36} color={colors.white} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, marginStart: spacing.md, alignItems: 'flex-start' }}>
                <View style={styles.hotBadge}>
                  <Flame size={12} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                  <Text variant="caption" color="#FFFFFF" weight="bold" style={{ fontSize: 10 }}>
                    {t('games.text2459')}
                  </Text>
                </View>
                <Text variant="h3" weight="bold" color={colors.white}>
                  {t('games.text42766')}
                </Text>
                <Text variant="bodySmall" color="rgba(255,255,255,0.9)">
                  {/* الجائزة من الإعدادات — كانت مثبّتة 1,000,000 بينما شاشة اليانصيب تعرض قيمة الإعدادات */}
                  {t('games.text43386', {
                    prize: gamesGlobal.lotteryGrandPrize.toLocaleString('en-US'),
                  })}
                </Text>
              </View>
              <View style={styles.featuredArrow}>
                <ChevronLeft size={20} color={colors.white} strokeWidth={3} />
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* تصنيفات — نفس كروت الشاشة الرئيسية */}
        <View style={styles.categoriesSection}>
          <Text variant="h4" weight="bold" color={themeText} style={styles.categoriesTitle}>
            {t('home.gamesSection')}
          </Text>
          <Text variant="caption" color={themeSubText} style={styles.categoriesSub}>
            {t('home.gamesHubSubtitle')}
          </Text>
          <GamePromoCards
            pad={0}
            cardW={promoCardW}
            gap={promoGap}
            exclude={showLottery ? ['lottery'] : []}
          />
        </View>

        {/* ألعاب كازينو مميزة */}
        {showCasino && featuredCasino.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: 'rgba(225, 20, 20, 0.12)' }]}>
                <Dices size={18} color="#E11414" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text variant="h4" weight="bold" color={themeText}>
                  {t('games.text72931')}
                </Text>
                <Text variant="caption" color={themeSubText}>
                  {t('games.text50770')}
                </Text>
              </View>
            </View>
            <View style={[styles.gamesGrid, { gap: gridGap }]}>
              {featuredCasino.map((game) => (
                <CasinoGameCard
                  key={game.id}
                  game={game}
                  cardW={cardWidth}
                  highlights={highlights[game.id]}
                  onPress={() => router.push(game.route as any)}
                />
              ))}
            </View>
            <Pressable
              onPress={() => router.push('/games/casino' as any)}
              style={[
                styles.casinoViewAll,
                {
                  backgroundColor: isDark ? 'rgba(225, 20, 20,0.15)' : 'rgba(225, 20, 20,0.08)',
                  borderColor: isDark ? 'rgba(225, 20, 20,0.35)' : 'rgba(225, 20, 20,0.2)',
                },
              ]}
            >
              <Dices size={18} color="#E11414" strokeWidth={2.2} />
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text variant="body" weight="bold" color={isDark ? '#FCA5A5' : '#8A0E0E'}>
                  {t('home.viewAll')} — {t('games.text72931')} (
                  {getCasinoGames().filter((g) => isGameEnabled(gamesConfig, gamesGlobal, g.id)).length})
                </Text>
                <Text
                  variant="caption"
                  color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26, 10, 12,0.55)'}
                >
                  {t('casino.viewAllHint')}
                </Text>
              </View>
              <ChevronLeft size={18} color="#E11414" strokeWidth={2.5} />
            </Pressable>
          </>
        ) : null}

        {/* إحصائيات */}
        <Card
          variant="elevated"
          style={[
            styles.statsCard,
            {
              backgroundColor: themeCardBg,
              borderColor: themeCardBorder,
              borderWidth: 1,
            },
          ]}
        >
          <Text
            variant="bodySmall"
            weight="semibold"
            color={themeSubText}
            style={{ marginBottom: spacing.sm }}
          >
            {t('games.text45108')}
          </Text>
          <View style={styles.statsRow}>
            <StatItem Icon={Trophy} color="#F59E0B" value="42" label={t('games.text10128')} isDark={isDark} />
            <View style={[styles.statDivider, { backgroundColor: themeCardBorder }]} />
            <StatItem Icon={Zap} color="#E11414" value="156" label={t('rooms.categories.games')} isDark={isDark} />
            <View style={[styles.statDivider, { backgroundColor: themeCardBorder }]} />
            <StatItem Icon={Crown} color="#ED4444" value="2,840" label={t('games.text10704')} isDark={isDark} />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const StatItem: React.FC<{ Icon: React.ComponentType<any>; color: string; value: string; label: string; isDark: boolean }> = ({
  Icon,
  color,
  value,
  label,
  isDark,
}) => (
  <View style={styles.statItem}>
    <Icon size={20} color={color} strokeWidth={2.5} />
    <Text variant="h4" weight="bold" color={isDark ? '#FFFFFF' : '#1A0A0C'}>
      {value}
    </Text>
    <Text variant="caption" color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26, 10, 12,0.5)'}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
  },
  scrollContent: { paddingHorizontal: spacing.base },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coinsButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  coinsButtonDark: {
    backgroundColor: '#1A0A0C',
    borderColor: 'rgba(255,255,255,0.1)',
  },

  featuredBanner: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
    minHeight: 120,
    elevation: 4,
  },
  featuredGlow1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  featuredGlow2: {
    position: 'absolute',
    bottom: -50,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(225, 20, 20, 0.4)',
  },
  featuredContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: spacing.lg,
  },
  featuredIconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  featuredArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoriesSection: {
    marginBottom: spacing.lg,
  },
  categoriesTitle: {
    textAlign: 'right',
    marginBottom: 4,
  },
  categoriesSub: {
    textAlign: 'right',
    marginBottom: spacing.sm,
  },

  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  gamesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  casinoViewAll: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },

  statsCard: {
    padding: spacing.base,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
});
