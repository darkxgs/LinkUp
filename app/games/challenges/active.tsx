/**
 * ActiveChallengeScreen — شاشة المواجهة النشطة 1v1 أونلاين
 *
 * تنسق حركات اللاعبين، وتزامنها لحظياً مع Firestore، وتمررها لـ WebView.
 * تدير العملة، ركلات الجزاء، والبلياردو.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Alert, BackHandler, Animated } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Swords } from 'lucide-react-native';
import { colors } from '@/theme';
import { Text } from '@/components/ui';
import { auth, firestore } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getGamesGlobalOnce } from '@/services/firebase/gamesConfig';
import {
  completeChallenge,
  updateChallengeState,
  acceptChallenge,
  type ChallengeSession,
} from '@/services/firebase/challenges';
import { ChallengeVoiceBar } from '@/components/games/ChallengeVoiceBar';
import { getChallengeLocale } from '@/utils/challengeI18n';
import { useMarkGamePresence } from '@/hooks/useGamePresence';

export default function ActiveChallengeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const webViewRef = useRef<WebView>(null);
  const webViewReadyRef = useRef(false);
  // تنبيه النتيجة: مرة واحدة فقط + يُلغى مؤقّته عند مغادرة الشاشة
  const completionNotifiedRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initDataSentRef = useRef(false);
  useMarkGamePresence('challenges');
  const turnPulse = useRef(new Animated.Value(0)).current;
  const challengeRef = useRef<ChallengeSession | null>(null);
  const sessionEndedRef = useRef(false);

  const challengeId = typeof params.challengeId === 'string' ? params.challengeId : '';
  const [challenge, setChallenge] = useState<ChallengeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const gamesGlobalRef = useRef<Awaited<ReturnType<typeof getGamesGlobalOnce>> | null>(null);

  useEffect(() => {
    getGamesGlobalOnce().then((g) => { gamesGlobalRef.current = g; });
  }, []);

  const currentUser = auth.currentUser;
  const myRole = useMemo(() => {
    if (!challenge || !currentUser?.uid) return '';
    return challenge.challengerId === currentUser.uid ? 'challenger' : 'opponent';
  }, [challenge, currentUser?.uid]);

  const postToWebView = useCallback((data: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  const sendInitDataToWebView = useCallback(async () => {
    if (!challenge || challenge.status !== 'active' || !myRole) return;
    if (!webViewReadyRef.current) return;

    const global = gamesGlobalRef.current ?? (await getGamesGlobalOnce());
    gamesGlobalRef.current = global;

    const payload = {
      type: 'INIT_DATA',
      challenge: { ...challenge, id: challenge.id || challengeId },
      myRole,
      role: myRole,
      global,
      locale: getChallengeLocale(),
    };

    postToWebView(payload);
    initDataSentRef.current = true;
  }, [challenge, challengeId, myRole, postToWebView]);

  useEffect(() => {
    webViewReadyRef.current = false;
    initDataSentRef.current = false;
    sessionEndedRef.current = false;
  }, [challengeId]);

  useEffect(() => {
    challengeRef.current = challenge;
    if (challenge?.status === 'completed') {
      sessionEndedRef.current = true;
    }
  }, [challenge]);

  // 1. الاستماع للتحدي في Firestore
  useEffect(() => {
    if (!challengeId) return;

    const unsub = onSnapshot(doc(firestore, 'gameChallenges', challengeId), (snap) => {
      if (!snap.exists()) {
        Alert.alert(t('common.error'), t('challenges.active.notFound'));
        router.back();
        return;
      }

      const data = snap.data() as ChallengeSession;
      setChallenge(data);
      setIsLoading(false);

      // تمرير التحديثات الفورية للـ WebView
      if (data.status === 'active') {
        postToWebView({
          type: 'STATE_UPDATE',
          challenge: data,
          myRole:
            data.challengerId === currentUser?.uid ? 'challenger' : 'opponent',
          role:
            data.challengerId === currentUser?.uid ? 'challenger' : 'opponent',
          global: gamesGlobalRef.current,
          locale: getChallengeLocale(),
        });
      }

      // إذا اكتمل التحدي، نقوم بالإغلاق وإرجاع المستخدم بعد تنبيهه
      if (data.status === 'completed') {
        if (completionNotifiedRef.current) return; // اللقطات المتكررة كانت تكدّس التنبيهات
        completionNotifiedRef.current = true;
        const isWinner = data.winnerId === currentUser?.uid;
        const isDraw = data.winnerId === null;

        completionTimerRef.current = setTimeout(() => {
          if (isDraw) {
            Alert.alert(t('challenges.active.drawTitle'), t('challenges.active.drawBody'), [
              { text: t('challenges.active.ok'), onPress: () => router.back() },
            ]);
          } else if (isWinner) {
            Alert.alert(t('challenges.active.winTitle'), t('challenges.active.winBody'), [
              { text: t('challenges.active.ok'), onPress: () => router.back() },
            ]);
          } else {
            Alert.alert(t('challenges.active.loseTitle'), t('challenges.active.loseBody'), [
              { text: t('challenges.active.ok'), onPress: () => router.back() },
            ]);
          }
        }, 1200);
      }
    });

    return () => {
      unsub();
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, [challengeId, currentUser?.uid, postToWebView, router]);

  const requestChallengeBridge = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      (function () {
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'INIT_GAME' }));
          }
        } catch (e) {}
      })();
      true;
    `);
  }, []);

  const handleWebViewLoadEnd = useCallback(() => {
    setIsLoading(false);
    webViewReadyRef.current = true;
    initDataSentRef.current = false;
    requestChallengeBridge();
    void sendInitDataToWebView();
    setTimeout(() => void sendInitDataToWebView(), 300);
    setTimeout(() => void sendInitDataToWebView(), 900);
  }, [requestChallengeBridge, sendInitDataToWebView]);

  useEffect(() => {
    void sendInitDataToWebView();
  }, [sendInitDataToWebView]);

  const gameUrl = useMemo(() => {
    if (!challenge || challenge.status !== 'active' || !myRole) return '';
    const base = 'https://linkup-dc45f.web.app/games';
    const cb = `&cb=${challenge.createdAt ?? 1}`;
    const lang = `&lang=${getChallengeLocale()}&lu_v=20260622`;
    if (challenge.gameId === 'coin-flip') {
      return `${base}/coin-challenge/?challengeId=${challengeId}&role=${myRole}&uid=${currentUser?.uid}${cb}${lang}`;
    }
    if (challenge.gameId === 'penalty') {
      return `${base}/penalty-challenge/?challengeId=${challengeId}&role=${myRole}&uid=${currentUser?.uid}${cb}${lang}`;
    }
    if (challenge.gameId === 'billiards') {
      return `${base}/billiards-challenge/?challengeId=${challengeId}&role=${myRole}&uid=${currentUser?.uid}${cb}${lang}`;
    }
    return '';
  }, [challengeId, myRole, currentUser?.uid, challenge]);

  const isChallenger = challenge?.challengerId === currentUser?.uid;

  const opponentUid = useMemo(() => {
    if (!challenge || !currentUser?.uid) return '';
    return isChallenger ? challenge.challengedId : challenge.challengerId;
  }, [challenge, currentUser?.uid, isChallenger]);

  const opponentName = useMemo(() => {
    if (!challenge) return t('challenges.active.opponent');
    return isChallenger ? challenge.challengedName : challenge.challengerName;
  }, [challenge, isChallenger, t]);

  const voiceEnabled = challenge?.status === 'active' && !!opponentUid;

  // دور مَن الآن — يقرأ turn من وثيقة التحدي (ويتراجع لـ gameState.turn)
  const isMyTurn = useMemo(() => {
    if (!challenge || !currentUser?.uid) return false;
    const turn = challenge.turn ?? (challenge.gameState as { turn?: string } | undefined)?.turn;
    if (!turn) return false;
    return turn === currentUser.uid;
  }, [challenge, currentUser?.uid]);

  const hasTurnInfo = useMemo(() => {
    if (!challenge) return false;
    return Boolean(
      challenge.turn ?? (challenge.gameState as { turn?: string } | undefined)?.turn,
    );
  }, [challenge]);

  const turnBarTop = useMemo(() => {
    // داخل SafeAreaView — لا نضيف insets.top مرة أخرى
    if (challenge?.gameId === 'billiards') return 78;
    return 50;
  }, [challenge?.gameId]);

  // نبض خفيف على شريط الدور عندما يكون دورك (تذكير دائم)
  useEffect(() => {
    if (challenge?.status !== 'active' || !isMyTurn) {
      turnPulse.stopAnimation();
      turnPulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(turnPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(turnPulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isMyTurn, challenge?.status, turnPulse]);

  const handleForfeit = useCallback(async () => {
    if (sessionEndedRef.current) {
      router.back();
      return;
    }
    if (challenge && challenge.status === 'active') {
      sessionEndedRef.current = true;
      const opponentId = isChallenger ? challenge.challengedId : challenge.challengerId;
      try {
        await completeChallenge(challengeId, opponentId, { forfeited: true });
      } catch (e) {
        sessionEndedRef.current = false;
        throw e;
      }
    }
    router.back();
  }, [challenge, challengeId, isChallenger, router]);

  // مغادرة الشاشة = انسحاب فوري — لا خروج مؤقت ولا عودة للمباراة
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (sessionEndedRef.current) return;
        const ch = challengeRef.current;
        const uid = auth.currentUser?.uid;
        if (!ch || ch.status !== 'active' || !uid) return;
        if (ch.challengerId !== uid && ch.challengedId !== uid) return;
        const opponentId = ch.challengerId === uid ? ch.challengedId : ch.challengerId;
        sessionEndedRef.current = true;
        void completeChallenge(challengeId, opponentId, { forfeited: true }).catch(() => {});
      };
    }, [challengeId]),
  );

  // الخروج = انسحاب وخسارة فورية، لا يمكن العودة للمباراة
  const handleExit = useCallback(() => {
    Alert.alert(
      t('challenges.active.exitTitle'),
      t('challenges.active.exitBody'),
      [
        { text: t('challenges.active.continuePlay'), style: 'cancel' },
        {
          text: t('challenges.active.exitForfeit'),
          style: 'destructive',
          onPress: () => {
            void handleForfeit().catch((e: Error) => {
              Alert.alert(t('challenges.active.error'), e?.message ?? t('challenges.active.forfeitFailed'));
            });
          },
        },
      ],
    );
  }, [handleForfeit, t]);

  useEffect(() => {
    if (!challenge || challenge.status !== 'active') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    return () => sub.remove();
  }, [challenge?.status, handleExit]);

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'INIT_GAME') {
        webViewReadyRef.current = true;
        initDataSentRef.current = false;
        await sendInitDataToWebView();
        return;
      }

      if (!challenge) return;

      if (data.type === 'MAKE_MOVE') {
        const nextState = data.gameState;
        const nextTurn = data.nextTurn;
        await updateChallengeState(challengeId, nextState, nextTurn);
      } else if (data.type === 'GAME_OVER') {
        sessionEndedRef.current = true;
        const winnerId = data.winnerId;
        const log = data.log || {};
        await completeChallenge(challengeId, winnerId, log);
      }
    } catch (e: any) {
      console.warn('ActiveChallengeScreen onMessage error:', e);
    }
  };

  if (!challengeId) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text variant="body">{t('challenges.active.invalid')}</Text>
      </View>
    );
  }

  if (challenge && challenge.status === 'pending') {
    const isInvited = challenge.challengedId === currentUser?.uid;
    return (
      <SafeAreaView style={[styles.container, styles.center, { padding: 24 }]} edges={['top', 'left', 'right']}>
        <Text variant="h3" weight="bold" color={colors.white} style={{ marginBottom: 8 }}>
          {isInvited ? t('challenges.active.inviteTitle') : t('challenges.active.waitingAccept')}
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.75)" align="center" style={{ marginBottom: 20 }}>
          {isInvited
            ? t('challenges.active.inviteBody')
            : t('challenges.active.waitingBody')}
        </Text>
        {isInvited ? (
          <Pressable
            onPress={async () => {
              try {
                await acceptChallenge(challengeId);
              } catch (e: any) {
                Alert.alert(t('challenges.active.error'), e?.message ?? t('challenges.active.acceptFailed'));
              }
            }}
            style={styles.pendingAcceptBtn}
          >
            <Text variant="button" weight="bold" color="#fff">
              {t('challenges.active.acceptJoin')}
            </Text>
          </Pressable>
        ) : (
          <ActivityIndicator size="large" color="#F59E0B" />
        )}
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text variant="caption" color="rgba(255,255,255,0.6)">{t('challenges.active.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {gameUrl ? (
        <WebView
          ref={webViewRef}
          source={{ uri: gameUrl }}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          incognito={false}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          androidLayerType="hardware"
          contentInsetAdjustmentBehavior="never"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={handleWebViewLoadEnd}
          onError={() => {
            // فشل تحميل صريح — بدون هذا كان مؤشر التحميل يدور للأبد
            setIsLoading(false);
            Alert.alert(t('common.error'), t('challenges.active.notFound'), [
              { text: t('challenges.active.ok'), onPress: () => router.back() },
            ]);
          }}
          onMessage={handleMessage}
          style={styles.webview}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      )}

      {/* شريط الدور الدائم — يذكّر اللاعب بدوره طوال المباراة */}
      {challenge?.status === 'active' ? (
        <View
          pointerEvents="none"
          style={[styles.turnBarWrap, { top: turnBarTop }]}
        >
          <Animated.View
            style={[
              styles.turnPill,
              isMyTurn ? styles.turnPillMine : styles.turnPillOther,
              isMyTurn
                ? {
                    opacity: turnPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }),
                    transform: [
                      {
                        scale: turnPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.04],
                        }),
                      },
                    ],
                  }
                : null,
            ]}
          >
            <Swords size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text variant="caption" weight="bold" color="#FFFFFF" style={styles.turnText}>
              {!hasTurnInfo
                ? t('challenges.active.turnOngoing')
                : isMyTurn
                ? t('challenges.active.turnMine')
                : t('challenges.active.turnOpponent', { name: opponentName })}
            </Text>
          </Animated.View>
        </View>
      ) : null}

      {/* زر الخروج / الانسحاب المخصص */}
      <Pressable
        onPress={handleExit}
        style={[styles.exitButton, { top: 10, right: 12 }]}
      >
        <X size={18} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      <ChallengeVoiceBar
        challengeId={challengeId}
        opponentUid={opponentUid}
        opponentName={opponentName}
        enabled={voiceEnabled}
        bottomInset={insets.bottom}
      />

      {isLoading && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 12, fontWeight: '600' }}>
              {t('challenges.active.syncing')}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100406',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingAcceptBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  turnBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9,
  },
  turnPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  turnPillMine: {
    backgroundColor: '#10B981',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  turnPillOther: {
    backgroundColor: 'rgba(20, 10, 12,0.92)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  turnText: {
    fontSize: 13,
  },
  exitButton: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A0A0C',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
