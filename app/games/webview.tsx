import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { X, Plus, ArrowRightLeft } from 'lucide-react-native';
import { colors } from '@/theme';
import { Text } from '@/components/ui';
import { CASINO_GAME_IMAGES, CASINO_FEATURED_GAME_IDS } from '@/constants/casinoGames';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore, auth } from '@/services/firebase';
import {
  placeBet,
  placeIntelligenceBet,
  refundBet,
  recordWin,
  recordIntelligenceWin,
  recordLoss,
  getIntelligenceDailyStatus,
  isIntelligenceGame,
  type GameId,
} from '@/services/firebase/gameTransactions';
import { getGamesConfigOnce, getGamesGlobalOnce, getIntelligenceWinMultiplier } from '@/services/firebase/gamesConfig';
import {
  assertStakeAllowed,
  getIntelligenceBetLimits,
  getIntelligenceStakeOptions,
} from '@/services/games/stakeChips';
import { isGameEnabled } from '@/utils/gamesVisibility';
import { getChallengeLocale } from '@/utils/challengeI18n';
import { useMarkGamePresence } from '@/hooks/useGamePresence';
import type { GameCategory } from '@/services/firebase/gamePresence';

/** نسخة تخطيط WebView — تُحدَّث مع كل نشر للكازينو */
const CASINO_EMBED_VERSION = '20260706a';

import { formatCasinoCoins } from '@/utils/casinoCoins';
import { COIN_CURRENCY_ICON, CASINO_CURRENCY_ICON } from '@/constants/brandAssets';

const IMG_COIN = COIN_CURRENCY_ICON;
const IMG_CASINO = CASINO_CURRENCY_ICON;

/** تنسيق مختصر للأرصدة الكبيرة حتى يبقى رصيدا الكوينز والكازينو ظاهرين معاً */
function formatBalance(n: number): string {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (abs >= 1e12) return trim((v / 1e12).toFixed(abs >= 1e13 ? 0 : 1)) + 'T';
  if (abs >= 1e9) return trim((v / 1e9).toFixed(abs >= 1e10 ? 0 : 1)) + 'B';
  if (abs >= 1e6) return trim((v / 1e6).toFixed(abs >= 1e7 ? 0 : 1)) + 'M';
  if (abs >= 1e3) return Math.floor(v).toLocaleString('en-US');
  return String(Math.floor(v));
}

export default function WebViewGameScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const webViewRef = useRef<WebView>(null);
  // لغة اللعبة تتبع لغة التطبيق (عربي/إنجليزي) — تُمرَّر للويب فيو في الرابط وفي INIT_DATA
  const locale: 'ar' | 'en' = i18n.language?.startsWith('en') ? 'en' : getChallengeLocale();
  
  const gameUrl = typeof params.url === 'string' ? params.url : '';
  const gameName = typeof params.name === 'string' ? params.name : 'اللعبة';

  const [isLoading, setIsLoading] = useState(true);
  const [coins, setCoins] = useState(0);
  const [casinoCoins, setCasinoCoins] = useState(0);
  const [avatar, setAvatar] = useState('');

  // استخراج معرّف اللعبة من الرابط
  const getGameId = (url: string): string => {
    const cleanUrl = url.toLowerCase();
    if (cleanUrl.includes('flag-guess')) return 'flag-guess';
    if (cleanUrl.includes('memory-match')) return 'memory-match';
    if (cleanUrl.includes('sequence-memory')) return 'sequence-memory';
    if (cleanUrl.includes('dragon-tower')) return 'dragon-tower';
    if (cleanUrl.includes('dice')) return 'dice';
    if (cleanUrl.includes('coin')) return 'coin-flip';
    if (cleanUrl.includes('slot') || cleanUrl.includes('lucky-777')) return 'lucky-777';
    if (cleanUrl.includes('wheel')) return 'wheel';
    if (cleanUrl.includes('treasure')) return 'treasure-box';
    if (cleanUrl.includes('plinko')) return 'plinko';
    if (cleanUrl.includes('/dino')) return 'dino';
    if (cleanUrl.includes('spin-win')) return 'spin-win';
    if (cleanUrl.includes('/mines')) return 'mines';
    if (cleanUrl.includes('crash')) return 'crash-rocket';
    if (cleanUrl.includes('blackjack')) return 'blackjack';
    if (cleanUrl.includes('roulette')) return 'roulette';
    if (cleanUrl.includes('duck')) return 'duck-race';
    if (cleanUrl.includes('chicken')) return 'chicken-cross';
    if (cleanUrl.includes('golden-tree') || cleanUrl.includes('goldentree')) return 'golden-tree';
    if (cleanUrl.includes('rock-paper-scissors')) return 'rock-paper-scissors';
    if (cleanUrl.includes('penalty-kick-casino')) return 'penalty-kick-casino';
    if (cleanUrl.includes('/hilo')) return 'hilo';
    if (cleanUrl.includes('/limbo')) return 'limbo';
    if (cleanUrl.includes('penalty')) return 'penalty-kicks';
    if (cleanUrl.includes('lottery')) return 'lottery';
    return '';
  };

  const gameId = getGameId(gameUrl) as GameId | '';
  const intelligenceGame = gameId ? isIntelligenceGame(gameId) : false;
  const gameImg = gameId
    ? (CASINO_GAME_IMAGES as Record<string, number | undefined>)[gameId]
    : undefined;

  const cleanUrl = React.useMemo(() => {
    if (!gameUrl) return '';
    const sep = gameUrl.includes('?') ? '&' : '?';
    return `${gameUrl}${sep}embed=1&lu_v=${CASINO_EMBED_VERSION}&lang=${locale}`;
  }, [gameUrl, locale]);

  const isCasinoReact = /\/games\/casino\//i.test(gameUrl);
  /** HTML casino فقط — React casino يستخدم سكرول داخلي */
  const isCasinoHtml = /\/games\/(slot|wheel|coin|dice|lucky-777|treasure|duck-race|rock-paper-scissors|hilo|limbo|roulette|blackjack|chicken-cross|dragon-tower)/i.test(gameUrl);
  const allowWebViewScroll = isCasinoHtml;
  /** هيدر العملات يظهر فقط لألعاب الكازينو (ربح = عملات كازينو) */
  const showCasinoHeader = isCasinoReact || isCasinoHtml;

  // تسجيل الحضور المباشر حسب فئة اللعبة (لعرض عدد المتصلين على الكروت)
  const presenceCategory: GameCategory | null = React.useMemo(() => {
    if (gameId === 'lottery') return 'lottery';
    if (intelligenceGame) return 'intelligence';
    if (showCasinoHeader || (gameId && (CASINO_FEATURED_GAME_IDS as readonly string[]).includes(gameId))) {
      return 'casino';
    }
    return null;
  }, [gameId, intelligenceGame, showCasinoHeader]);
  useMarkGamePresence(presenceCategory);
  const gameConfigRef = useRef<{ enabled: boolean; minBet: number; maxBet: number; rtp: number; multipliers: number[] } | null>(null);
  const gamesGlobalRef = useRef<Awaited<ReturnType<typeof getGamesGlobalOnce>> | null>(null);
  const intelligenceWinMultRef = useRef(20);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      const [configs, global] = await Promise.all([getGamesConfigOnce(), getGamesGlobalOnce()]);
      if (!isGameEnabled(configs, global, gameId)) {
        Alert.alert('غير متاح', 'هذه اللعبة غير متاحة حالياً', [
          { text: 'رجوع', onPress: () => router.back() },
        ]);
      }
    })();
  }, [gameId, router]);

  const postToWebView = (data: any) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  };

  const sendInitDataToWebView = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      postToWebView({ type: 'ERROR', message: 'يجب تسجيل الدخول أولاً للعب' });
      return;
    }

    const userRef = doc(firestore, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      postToWebView({ type: 'ERROR', message: 'المستخدم غير موجود' });
      return;
    }

    const userData = userSnap.data();
    const coins = userData?.stats?.coins ?? userData?.coins ?? 0;
    const casinoCoins = userData?.stats?.casinoCoins ?? userData?.casinoCoins ?? 0;
    setCoins(coins);
    setCasinoCoins(casinoCoins);
    setAvatar(userData?.avatar ?? '');

    let hasPlayedToday = false;
    let serverNowMs: number | undefined;
    let msUntilNextDailyReset: number | undefined;
    if (gameId && intelligenceGame) {
      const daily = await getIntelligenceDailyStatus(user.uid, gameId);
      hasPlayedToday = daily.hasPlayedToday;
      serverNowMs = daily.serverNow;
      msUntilNextDailyReset = daily.msUntilNextDailyReset;
    }

    let gameConfig = null;
    let gamesGlobal = null;
    try {
      const [configs, global] = await Promise.all([getGamesConfigOnce(), getGamesGlobalOnce()]);
      gamesGlobal = global;
      gamesGlobalRef.current = global;
      gameConfig = configs.find((c) => c.id === gameId) || null;
      if (gameId && intelligenceGame) {
        intelligenceWinMultRef.current = getIntelligenceWinMultiplier(configs, gameId);
      }
    } catch (err) {
      console.warn('Error fetching games config:', err);
    }

    const intelLimits = intelligenceGame && gameConfig ? getIntelligenceBetLimits(gameConfig) : null;
    const winMult = intelligenceGame ? intelligenceWinMultRef.current : undefined;
    const initConfig = gameConfig && intelligenceGame
      ? { ...gameConfig, ...intelLimits, multipliers: [winMult ?? gameConfig.multipliers[0] ?? 20] }
      : gameConfig;
    const initGlobal = gamesGlobal;
    const stakeChips = intelligenceGame && gameConfig && gamesGlobal
      ? getIntelligenceStakeOptions(gamesGlobal, gameConfig as any)
      : undefined;

    if (initConfig) {
      gameConfigRef.current = {
        enabled: initConfig.enabled !== false,
        minBet: initConfig.minBet,
        maxBet: initConfig.maxBet,
        rtp: initConfig.rtp,
        multipliers: intelligenceGame
          ? [winMult ?? initConfig.multipliers[0] ?? 20]
          : (initConfig.multipliers ?? []),
      };
    }

    postToWebView({
      type: 'INIT_DATA',
      balance: coins,
      casinoCoins,
      avatar: userData?.avatar ?? '',
      hasPlayedToday,
      serverNow: serverNowMs,
      msUntilNextDailyReset,
      config: initConfig,
      global: initGlobal,
      locale,
      lang: locale,
      stakeChips,
    });
  }, [gameId, intelligenceGame, locale]);

  const requestGameBridge = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      (function () {
        try {
          var U = window.GamesConfigUtils || (window.LinkUpGameBoot && window.LinkUpGameBoot.getUtils());
          if (U && typeof U.initGameBridge === 'function') U.initGameBridge();
        } catch (e) {}
      })();
      true;
    `);
  }, []);

  const injectEmbedMode = useCallback(() => {
    const casinoReact = isCasinoReact ? 'true' : 'false';
    // ألعاب HTML القابلة للتمرير يجب ألا تُقفل بارتفاع ثابت أو overflow:hidden
    const lockViewport = allowWebViewScroll ? 'false' : 'true';
    webViewRef.current?.injectJavaScript(`
      (function () {
        document.documentElement.classList.add('linkup-embed');
        if (${casinoReact}) document.documentElement.classList.add('linkup-embed-casino');
        var meta = document.querySelector('meta[name=viewport]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'viewport';
          document.head.appendChild(meta);
        }
        meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
        if (${lockViewport}) {
          var h = Math.round(window.visualViewport ? window.visualViewport.height : window.innerHeight);
          document.documentElement.style.setProperty('--lu-app-h', h + 'px');
          document.documentElement.style.height = h + 'px';
          document.documentElement.style.maxHeight = h + 'px';
          document.body.style.height = h + 'px';
          document.body.style.maxHeight = h + 'px';
          var root = document.getElementById('root');
          if (root) {
            root.style.height = h + 'px';
            root.style.maxHeight = h + 'px';
            var antApp = root.querySelector('.ant-app');
            if (antApp) {
              antApp.style.height = h + 'px';
              antApp.style.maxHeight = h + 'px';
            }
          }
          document.documentElement.style.overflow = 'hidden';
          document.body.style.overflow = 'hidden';
          document.body.style.overscrollBehavior = 'none';
        } else {
          document.documentElement.style.height = 'auto';
          document.documentElement.style.maxHeight = 'none';
          document.documentElement.style.overflow = 'auto';
          document.body.style.height = 'auto';
          document.body.style.maxHeight = 'none';
          document.body.style.minHeight = '100%';
          document.body.style.overflow = 'auto';
          document.body.style.webkitOverflowScrolling = 'touch';
        }
        window.dispatchEvent(new Event('resize'));
        true;
      })();
    `);
  }, [isCasinoReact, allowWebViewScroll]);

  const injectedBeforeLoad = React.useMemo(
    () => `
      (function () {
        document.documentElement.classList.add('linkup-embed');
        ${isCasinoReact ? "document.documentElement.classList.add('linkup-embed-casino');" : ''}
      })();
      true;
    `,
    [isCasinoReact],
  );

  // الاستماع اللحظي لتحديثات رصيد كوينز المستخدم ومزامنتها مع المتصفح فوراً
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const coins = data?.stats?.coins ?? data?.coins ?? 0;
          const casinoCoins = data?.stats?.casinoCoins ?? data?.casinoCoins ?? 0;
          setCoins(coins);
          setCasinoCoins(casinoCoins);
          setAvatar(data?.avatar ?? '');
          postToWebView({
            type: 'UPDATE_BALANCE',
            balance: coins,
            casinoCoins,
            avatar: data?.avatar ?? '',
          });
        }
      },
      (err) => {
        console.error('Listen to balance updates error:', err);
      }
    );

    return () => unsubscribe();
  }, [gameUrl]);

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const user = auth.currentUser;
      if (!user) {
        throw new Error('يجب تسجيل الدخول أولاً للعب');
      }

      if (data.type === 'INIT_GAME') {
        await sendInitDataToWebView();
      } else if (data.type === 'PLACE_BET') {
        const stake = Number(data.stake);
        if (isNaN(stake) || stake <= 0) throw new Error('قيمة الدخولية غير صالحة');

        const cfg = gameConfigRef.current;
        if (cfg && cfg.enabled === false) {
          throw new Error('هذه اللعبة غير متاحة حالياً');
        }

        if (gameId && intelligenceGame) {
          const daily = await getIntelligenceDailyStatus(user.uid, gameId);
          if (daily.hasPlayedToday) {
            throw new Error('لقد لعبت هذه اللعبة اليوم. جرّب لعبة ذكاء أخرى أو عد غداً!');
          }
        }

        const globalCfg = gamesGlobalRef.current;
        if (cfg) {
          if (intelligenceGame && globalCfg) {
            const chips = getIntelligenceStakeOptions(globalCfg, cfg as any);
            const stakeCheck = assertStakeAllowed(stake, cfg as any, chips);
            if (!stakeCheck.valid) throw new Error(stakeCheck.reason ?? 'قيمة الدخولية غير مسموحة');
          } else {
            const amount = Math.floor(stake);
            if (amount < cfg.minBet) {
              throw new Error(`أقل رهان مسموح: ${cfg.minBet.toLocaleString()} كوين`);
            }
            if (amount > cfg.maxBet) {
              throw new Error(`أقصى رهان مسموح: ${cfg.maxBet.toLocaleString()} كوين`);
            }
          }
        }

        let dailyMeta: { serverNow?: number; msUntilNextDailyReset?: number } = {};
        if (gameId && intelligenceGame) {
          const placed = await placeIntelligenceBet(gameId, stake);
          dailyMeta = {
            serverNow: placed.serverNow,
            msUntilNextDailyReset: placed.msUntilNextDailyReset,
          };
        } else {
          await placeBet(stake);
        }

        if (
          gameId &&
          (CASINO_FEATURED_GAME_IDS as readonly string[]).includes(gameId)
        ) {
          void import('@/services/firebase/casinoLiveActivity')
            .then(({ logCasinoBetActivity }) => logCasinoBetActivity(gameId, stake))
            .catch(() => {});
        }

        postToWebView({
          type: 'BET_CONFIRMED',
          status: 'success',
          hasPlayedToday: intelligenceGame ? true : undefined,
          serverNow: dailyMeta.serverNow,
          msUntilNextDailyReset: dailyMeta.msUntilNextDailyReset,
        });
      } else if (data.type === 'CANCEL_BET') {
        const stake = Number(data.stake);
        if (isNaN(stake) || stake <= 0) throw new Error('قيمة الرهان غير صالحة');
        await refundBet(stake);
        postToWebView({
          type: 'BET_CANCELLED',
          status: 'success',
        });
      } else if (data.type === 'GAME_RESULT') {
        const stake = Number(data.stake);
        const winAmount = Number(data.winAmount);
        const isWin = Boolean(data.isWin);
        const multiplier = intelligenceGame
          ? intelligenceWinMultRef.current
          : (Number(data.multiplier) || (isWin && stake > 0 ? winAmount / stake : 0));

        if (gameId) {
          if (isWin && winAmount > 0) {
            if (intelligenceGame) {
              await recordIntelligenceWin(gameId, stake, winAmount, multiplier, data.result || {});
            } else {
              await recordWin(gameId, stake, winAmount, multiplier, data.result || {});
            }
          } else {
            await recordLoss(gameId, stake, data.result || {});
          }
        }

        postToWebView({
          type: 'RESULT_RECORDED',
          status: 'success',
        });
      }
    } catch (e: any) {
      console.warn('WebViewGameScreen handleMessage Error:', e);
      Alert.alert('خطأ في اللعبة', e?.message || 'حدث خطأ غير متوقع');
      postToWebView({
        type: 'ERROR',
        message: e?.message || 'حدث خطأ في النظام السحابي للتطبيق',
      });
    }
  };

  if (!gameUrl) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text variant="body" weight="bold" color={colors.text.secondary}>رابط اللعبة غير صالح</Text>
        <Pressable onPress={() => router.back()} style={styles.errorBtn}>
          <Text variant="button" color={colors.white}>رجوع</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View 
        style={[
          styles.headerContainer, 
          { 
            height: (insets.top > 0 ? insets.top : 24) + 52,
            paddingTop: insets.top > 0 ? insets.top : 24,
          }
        ]}
      >
        {showCasinoHeader ? (
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.push('/profile/me' as any)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.gameThumb} contentFit="cover" />
              ) : (
                <Image source={gameImg ?? IMG_COIN} style={styles.gameThumb} contentFit="cover" />
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push('/wallet/recharge')}
              style={styles.balancePill}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Image source={IMG_COIN} style={styles.balanceIcon} contentFit="contain" />
              <Text style={styles.balanceText} numberOfLines={1}>{formatBalance(coins)}</Text>
              <View style={styles.actionDot}>
                <Plus size={11} color="#0A0A0A" strokeWidth={3} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push('/wallet/exchange')}
              style={styles.balancePill}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Image source={IMG_CASINO} style={styles.balanceIcon} contentFit="contain" />
              <Text style={styles.balanceText} numberOfLines={1}>{formatCasinoCoins(casinoCoins)}</Text>
              <View style={[styles.actionDot, styles.actionDotExchange]}>
                <ArrowRightLeft size={10} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerLeft} />
        )}
        <Pressable 
          onPress={() => {
            console.log('Close button pressed, routing back.');
            router.back();
          }}
          style={styles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <X size={20} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </View>

      <View style={{ flex: 1, overflow: 'hidden', marginBottom: insets.bottom }}>
        <WebView
          ref={webViewRef}
          source={{ uri: cleanUrl }}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          cacheEnabled={!isCasinoReact}
          cacheMode={isCasinoReact ? 'LOAD_NO_CACHE' : 'LOAD_DEFAULT'}
          incognito={false}
          scrollEnabled={allowWebViewScroll}
          bounces={allowWebViewScroll}
          overScrollMode={allowWebViewScroll ? 'always' : 'never'}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          textZoom={100}
          contentInsetAdjustmentBehavior="never"
          decelerationRate="normal"
          allowsBackForwardNavigationGestures={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={allowWebViewScroll}
          androidLayerType="hardware"
          onLoadStart={() => setIsLoading(true)}
          onError={() => {
            // فشل تحميل صريح — بدون هذا كان مؤشر التحميل يدور للأبد
            setIsLoading(false);
            Alert.alert('خطأ في اللعبة', 'تعذّر تحميل اللعبة — تحقق من الاتصال وحاول مجدداً', [
              { text: 'رجوع', onPress: () => router.back() },
            ]);
          }}
          injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
          onLoadEnd={() => {
            setIsLoading(false);
            injectEmbedMode();
            requestGameBridge();
            const delay = isCasinoReact ? 1200 : 400;
            setTimeout(() => {
              void sendInitDataToWebView();
            }, delay);
            if (isCasinoReact) {
              setTimeout(() => {
                injectEmbedMode();
                void sendInitDataToWebView();
              }, 2800);
            }
          }}
          onMessage={handleMessage}
          style={styles.webview}
        />
      </View>

      {isLoading && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={styles.loadingContainer}>
            <View style={styles.loadingGlow} />
            <ActivityIndicator size="large" color="#E11414" />
            <Text variant="body" weight="bold" color="#FFFFFF" style={{ marginTop: 16 }}>
              {gameName}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.55)" style={{ marginTop: 6, fontWeight: '600' }}>
              جاري التحميل...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FCFAFA',
  },
  errorBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#E11414',
    borderRadius: 12,
  },
  headerContainer: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
  },
  gameThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  balanceIcon: {
    width: 18,
    height: 18,
  },
  balanceText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 90,
  },
  actionDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#FFD24A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDotExchange: {
    backgroundColor: '#22C55E',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0405',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(225, 20, 20, 0.12)',
  },
});
