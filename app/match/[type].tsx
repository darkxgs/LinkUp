/**
 * Match Screen — هوية LinkUp (خلفية فاتحة + بطاقات)
 * منطق المطابقة: createMatch / cancelMatch / checkMyMatch
 */

import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Animated, Alert,
  useWindowDimensions, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, Calendar, Power, Video, Mic, Users, Wallet, Coins } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { lu } from '@/theme/lu-brand';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import {
  getMatchMinCoins,
  getMyMatchGender,
  subscribeToQueueCount,
  subscribeToQueuePreview,
  subscribeToMyMatchStatus,
  cleanupFakeQueueEntries,
  type QueuePreviewUser,
} from '@/services/firebase/matching';
import { canUserMakeCalls } from '@/utils/genderAccess';
import { Image } from 'expo-image';
import { createMatch, cancelMatch, startCall } from '@/services/firebase/rtc';
import { requestCallPermissions } from '@/services/permissions';
import { ScheduleMatchSheet } from '@/components/match/ScheduleMatchSheet';
import {
  subscribeToMySchedules, isDue, markScheduleDone, type MatchSchedule,
} from '@/services/firebase/matchSchedule';
import { CalendarClock } from 'lucide-react-native';

const FALLBACK_GRADS: ReadonlyArray<readonly [string, string]> = [
  ['#F0A0A0', '#FBD5D5'], ['#FFB199', '#FF7A8A'], ['#E11414', '#FF5C5C'],
  ['#FF5C7A', '#C40E1E'], ['#FFD86F', '#FF9A2E'], ['#FF7A8A', '#E11414'],
];
const DEFAULT_GRAD = ['#F0A0A0', '#FBD5D5'] as const satisfies readonly [string, string];

function pickGrad(index: number): readonly [string, string] {
  return FALLBACK_GRADS[index % FALLBACK_GRADS.length] ?? DEFAULT_GRAD;
}

/** هوية ألوان المطابقة — غامرة حديثة: فيديو بنفسجي / صوت أزرق */
const MATCH_THEME = {
  video: {
    accent: '#E11414',
    accentLight: '#FCA5A5',
    cta: ['#E11414', '#B00E0E', '#8A0E0E'] as const,
    preview: ['#FCA5A5', '#B00E0E'] as const,
    ring: 'rgba(225, 20, 20, 0.5)',
    bg: ['#1A0A0C', '#3A0A0A', '#26090C'] as const,
    glow: 'rgba(225, 20, 20,0.5)',
    soft: lu.colors.pinkSoft,
  },
  voice: {
    accent: '#FF6670',
    accentLight: '#FCA5A5',
    cta: ['#FF8080', '#FF5C5C', '#C40E1E'] as const,
    preview: ['#FCA5A5', '#FF5C5C'] as const,
    ring: 'rgba(255, 102, 112, 0.5)',
    bg: ['#0A0405', '#8A0E0E', '#1A0A0C'] as const,
    glow: 'rgba(255, 102, 112,0.45)',
    soft: lu.colors.blueSoft,
  },
} as const;

export default function MatchScreen() {
  const { t } = useTranslation();
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { callPricing } = useConfig();
  const matchRates = callPricing.match;
  const { width: W, height: H } = useWindowDimensions();
  const isVideo = type === 'video';
  const matchType = isVideo ? 'video' : 'voice';
  const isSmall = W < 360;

  const [searching, setSearching] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [queuePreview, setQueuePreview] = useState<QueuePreviewUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFemaleHost, setIsFemaleHost] = useState(false);
  const [myMatchGender, setMyMatchGender] = useState<'male' | 'female'>('male');
  const [showSchedule, setShowSchedule] = useState(false);
  const [dueSchedule, setDueSchedule] = useState<MatchSchedule | null>(null);
  // بطاقة تأكيد المطابقة — لا نرنّ الطرف الآخر إلا بعد قبول المبادِر
  const [pendingMatch, setPendingMatch] = useState<{
    partnerUid: string;
    channelName: string;
    asInitiator: boolean;
    displayName?: string;
    avatar?: string;
  } | null>(null);

  // Video preferences
  const [ageRanges, setAgeRanges] = useState({
    '18-25': false,
    '26-35': true,
    '36+': true,
  });

  const pollMatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchListenerRef = useRef<(() => void) | null>(null);
  // حارس ضد القبول المزدوج + مرآة حديثة لمعاينة الطابور (لبطاقة التأكيد)
  const acceptingRef = useRef(false);
  const queuePreviewRef = useRef<QueuePreviewUser[]>([]);
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;
  const ringAnim3 = useRef(new Animated.Value(0)).current;
  // Float animation للأفاتارات المدارية (lu-float effect)
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Radar rings animation
  useEffect(() => {
    if (!searching) return;
    const loop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            useNativeDriver: true,
          }),
        ]),
      );
    const a1 = loop(ringAnim1, 0);
    const a2 = loop(ringAnim2, 800);
    const a3 = loop(ringAnim3, 1600);

    // float animation للأفاتارات (yoyo بين 0 و 1)
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1, duration: 1500, useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0, duration: 1500, useNativeDriver: true,
        }),
      ]),
    );

    a1.start();
    a2.start();
    a3.start();
    float.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      float.stop();
      ringAnim1.setValue(0);
      ringAnim2.setValue(0);
      ringAnim3.setValue(0);
      floatAnim.setValue(0);
    };
  }, [searching]);

  // تحقق من دور المضيفة عند التحميل
  useEffect(() => {
    getMyMatchGender()
      .then((g) => {
        setMyMatchGender(g);
        setIsFemaleHost(g === 'female');
      })
      .catch(() => {});
  }, []);

  // رصد مطابقة مجدولة حان وقتها (لعرض بانر "جاهزة الآن")
  useEffect(() => {
    const unsub = subscribeToMySchedules((items) => {
      const due = items.find((s) => s.type === matchType && isDue(s));
      setDueSchedule(due ?? null);
    });
    return unsub;
  }, [matchType]);

  // عدد ومعاينة المنتظرين المتوافقين مع دوري
  useEffect(() => {
    const matchType = isVideo ? 'video' : 'voice';
    let mounted = true;
    void cleanupFakeQueueEntries();
    const unsubCount = subscribeToQueueCount(matchType, myMatchGender, (n) => {
      if (mounted) setQueueCount(n);
    });
    const unsubPreview = subscribeToQueuePreview(matchType, myMatchGender, (users) => {
      if (mounted) {
        setQueuePreview(users);
        queuePreviewRef.current = users;
      }
    });
    if (mounted) setLoading(false);
    return () => {
      mounted = false;
      unsubCount();
      unsubPreview();
    };
  }, [isVideo, myMatchGender]);

  // Cleanup on unmount — إلغاء انتظار نفس النوع فقط (صوت ≠ فيديو)
  useEffect(() => {
    return () => {
      if (pollMatchRef.current) clearInterval(pollMatchRef.current);
      if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
      if (matchListenerRef.current) matchListenerRef.current();
      cancelMatch(matchType).catch(() => {});
    };
  }, [matchType]);

  // ============ Match handlers ============
  const navigateToMatchedCall = async (
    partnerUid: string,
    channelName: string,
    asInitiator: boolean,
  ) => {
    const ch = encodeURIComponent(channelName);
    let sessionQuery = '';
    const shouldRing = asInitiator || (!isFemaleHost && !asInitiator);
    const ringPromise = shouldRing
      ? import('@/services/incomingCalls').then(({ ringUser }) =>
          ringUser(partnerUid, matchType, channelName),
        )
      : Promise.resolve();

    if (!isFemaleHost) {
      try {
        const [session] = await Promise.all([
          startCall(partnerUid, matchType, channelName, 'match'),
          ringPromise,
        ]);
        sessionQuery = `&session=${encodeURIComponent(session.sessionId)}`;
      } catch (e: any) {
        setSearching(false);
        await cancelMatch(matchType).catch(() => {});
        Alert.alert(t('common.error'), e?.message ?? t('match.matchFailed'));
        return;
      }
    } else if (shouldRing) {
      await ringPromise.catch(() => {});
    }
    router.push(
      isVideo
        ? (`/call/video/${partnerUid}?channel=${ch}&source=match${sessionQuery}` as any)
        : (`/call/${partnerUid}?channel=${ch}&source=match${sessionQuery}` as any),
    );
  };

  // يعرض بطاقة التأكيد بدل الاتصال الفوري — الطرف الآخر لا يُرنّ إلا بعد القبول
  const presentMatchConfirm = (
    partnerUid: string,
    channelName: string,
    asInitiator: boolean,
  ) => {
    const preview = queuePreviewRef.current.find((p) => p.uid === partnerUid);
    setPendingMatch({
      partnerUid,
      channelName,
      asInitiator,
      displayName: preview?.displayName,
      avatar: preview?.avatar,
    });
  };

  // قبول → نُكمل التدفّق الأصلي (ringUser + startCall + تنقّل) كما كان
  const handleAcceptMatch = async () => {
    const m = pendingMatch;
    if (!m || acceptingRef.current) return; // حارس ضد الضغط المزدوج
    acceptingRef.current = true;
    setPendingMatch(null);
    try {
      await navigateToMatchedCall(m.partnerUid, m.channelName, m.asInitiator);
    } finally {
      acceptingRef.current = false;
    }
  };

  // رفض → لا رنين ولا بدء مكالمة؛ ننظّف وثيقة الطابور/المطابقة ونعود لوضع البحث
  const handleRejectMatch = () => {
    if (!pendingMatch) return;
    setPendingMatch(null);
    acceptingRef.current = false;
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    if (matchListenerRef.current) {
      matchListenerRef.current();
      matchListenerRef.current = null;
    }
    setSearching(false);
    // cancelMatch يحذف كل وثائق الطابور الخاصة بي لهذا النوع (matched/waiting)
    // فلا تبقى مطابقة معلّقة من جهتي؛ والرنين لم يُرسل أصلاً (يُرسل عند القبول فقط)
    cancelMatch(matchType).catch(() => {});
  };

  const handleStartMatching = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('match.loginRequired'));
      return;
    }

    if (!canUserMakeCalls(user)) {
      Alert.alert(t('common.error'), t('genderAccess.callsNeedVerification'), [
        { text: t('common.ok'), onPress: () => router.push('/wallet/kyc' as any) },
      ]);
      return;
    }

    if (!isFemaleHost) {
      const requiredCoins = getMatchMinCoins(matchType, matchRates);

      const userCoins = user.stats?.coins ?? 0;
      if (userCoins < requiredCoins) {
        Alert.alert(
          t('match.insufficientBalance'),
          t('match.needCoins', { count: requiredCoins }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('match.recharge'), onPress: () => router.push('/wallet/recharge' as any) },
          ],
        );
        return;
      }
    }

    if (isVideo) {
      const selected = Object.entries(ageRanges).filter(([, v]) => v);
      if (selected.length === 0) {
        Alert.alert(t('common.info'), t('match.selectAgeRange'));
        return;
      }
      const perms = await requestCallPermissions('both');
      if (!perms) return;
    } else {
      const perms = await requestCallPermissions('audio');
      if (!perms) return;
    }

    setSearching(true);
    try {
      await cancelMatch(matchType).catch(() => {});
      const selectedAges = isVideo
        ? Object.entries(ageRanges)
            .filter(([, v]) => v)
            .map(([k]) => k)
        : undefined;
      const result = await createMatch(matchType, selectedAges);

      if (result.matched && result.channelName && result.partnerUid) {
        const partnerUid = result.partnerUid;
        if (partnerUid === user.uid) {
          await cancelMatch(matchType);
          setSearching(false);
          Alert.alert(t('common.error'), t('profile.cannotCallSelf'));
          return;
        }
        setSearching(false);
        // بدل الاتصال الفوري: اعرض بطاقة تأكيد للمبادِر أولاً
        presentMatchConfirm(partnerUid, result.channelName, true);
        return;
      }

      // استمع مباشرة لأي تطابق عبر onSnapshot بدل polling
      matchListenerRef.current = subscribeToMyMatchStatus(matchType, (result) => {
        if (!result) return;
        if (matchListenerRef.current) {
          matchListenerRef.current();
          matchListenerRef.current = null;
        }
        if (matchTimeoutRef.current) {
          clearTimeout(matchTimeoutRef.current);
          matchTimeoutRef.current = null;
        }
        setSearching(false);
        if (result.partnerUid === user.uid) {
          cancelMatch(matchType).catch(() => {});
          Alert.alert(t('common.error'), t('profile.cannotCallSelf'));
          return;
        }
        // بدل الاتصال الفوري: اعرض بطاقة تأكيد أولاً
        presentMatchConfirm(result.partnerUid, result.channelName, false);
      });

      // مهلة 60 ثانية — إن لم يُوجد شريك
      matchTimeoutRef.current = setTimeout(async () => {
        if (matchListenerRef.current) {
          matchListenerRef.current();
          matchListenerRef.current = null;
        }
        await cancelMatch(matchType);
        setSearching(false);
        Alert.alert(t('match.noMatchNow'), t('match.tryAgainShortly'));
      }, 60000);
    } catch (e: any) {
      setSearching(false);
      Alert.alert(t('common.error'), e.message ?? t('match.matchFailed'));
    }
  };

  const handleCancelSearch = () => {
    if (pollMatchRef.current) clearInterval(pollMatchRef.current);
    if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
    if (matchListenerRef.current) {
      matchListenerRef.current();
      matchListenerRef.current = null;
    }
    setSearching(false);
    cancelMatch(matchType).catch(() => {});
  };

  // ============ UI ============
  const theme = isVideo ? MATCH_THEME.video : MATCH_THEME.voice;
  const myInitial = (user?.profile?.displayName ?? '?').charAt(0);
  const myAvatar = user?.profile?.avatar;
  const myGrad: readonly [string, string] = pickGrad(0);
  const coinCost = getMatchMinCoins(matchType, matchRates);
  const matchPriceLabel = isFemaleHost
    ? 'مجاني'
    : isVideo
      ? `${matchRates.videoFirstMinute.toLocaleString('en-US')} + ${matchRates.videoAfterMinute.toLocaleString('en-US')}/د`
      : t('home.matchPrice', { count: matchRates.voicePerMinute });

  const queueHint =
    queueCount <= 0 && !searching
      ? isFemaleHost
        ? 'ابدأ البحث — يظهر الدافعون هنا بعد ضغطهم «ابدأ المطابقة»'
        : 'ابدأ البحث — يجب أن تضغط أنثى موثّقة «ابدأ المطابقة» أولاً لتظهر هنا'
      : null;

  const formatQueueLabel = () => {
    if (loading) return t('common.loading');
    if (queueCount <= 0) return t('match.noOneWaiting');
    return searching
      ? t('match.availableNow', { count: queueCount })
      : t('match.peopleWaiting', { count: queueCount });
  };

  // دوائر المنتظرين الحقيقيين (أو حروف احتياطية إن القائمة فارغة)
  const orbitSlots = 5;
  const orbitUsers = Array.from({ length: orbitSlots }, (_, i) => {
    const angle = (i / orbitSlots) * Math.PI * 2 - Math.PI / 2;
    const preview = queuePreview[i];
    return {
      idx: i,
      x: Math.cos(angle) * (isSmall ? 100 : 128),
      y: Math.sin(angle) * (isSmall ? 100 : 128),
      grad: pickGrad(i + 1),
      letter: (preview?.displayName ?? '?').charAt(0),
      avatar: preview?.avatar,
    };
  });

  const radarSize = isSmall ? 180 : 200;
  const centerSize = isSmall ? 100 : 118;
  const myAvatarSize = isSmall ? 88 : 104;

  const renderCenterAvatar = (size: number, borderW = 3) => (
    myAvatar ? (
      <Image
        source={{ uri: myAvatar }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: borderW,
          borderColor: lu.colors.card,
        }}
        contentFit="cover"
      />
    ) : (
      <LinearGradient
        colors={myGrad}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: borderW,
          borderColor: lu.colors.card,
        }}
      >
        <Text style={{
          color: '#fff',
          fontSize: size * 0.4,
          fontFamily: lu.fonts.displayHeavy,
          includeFontPadding: false,
        }}>
          {myInitial}
        </Text>
      </LinearGradient>
    )
  );

  const heroSize = isSmall ? 116 : 138;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg[0] }}>
      <LinearGradient
        colors={[...theme.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* توهّج لوني خلف المركز */}
      <View style={[styles.glowOrb, { backgroundColor: theme.glow }]} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* شريط علوي زجاجي */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: isSmall ? 14 : 18 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.glassBtn, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerPill}>
          {isVideo ? (
            <Video size={15} color="#fff" strokeWidth={2.4} />
          ) : (
            <Mic size={15} color="#fff" strokeWidth={2.4} />
          )}
          <Text style={styles.headerPillText}>
            {isVideo ? t('match.video') : t('match.voice')}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* بانر مطابقة مجدولة جاهزة */}
      {dueSchedule && !searching && (
        <Pressable
          onPress={async () => {
            const s = dueSchedule;
            setDueSchedule(null);
            if (s) markScheduleDone(s).catch(() => {});
            handleStartMatching();
          }}
          style={({ pressed }) => [styles.dueBanner, { marginHorizontal: isSmall ? 14 : 18 }, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient colors={lu.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <CalendarClock size={20} color="#fff" strokeWidth={2.3} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dueBannerTitle}>مطابقتك المجدولة جاهزة الآن</Text>
            <Text style={styles.dueBannerSub}>اضغط لبدء المطابقة فوراً</Text>
          </View>
          <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
      )}

      {/* ===== المحتوى ===== */}
      <View style={styles.center}>
        {searching ? (
          <>
            <View style={{ width: radarSize, height: radarSize, alignItems: 'center', justifyContent: 'center' }}>
              {[ringAnim1, ringAnim2, ringAnim3].map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.ring,
                    {
                      borderColor: theme.ring,
                      width: radarSize,
                      height: radarSize,
                      borderRadius: radarSize / 2,
                      opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.35, 0] }),
                      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.18] }) }],
                    },
                  ]}
                />
              ))}
              <View style={[styles.selfHalo, { width: centerSize, height: centerSize, borderRadius: centerSize / 2, borderColor: theme.ring }]}>
                {renderCenterAvatar(myAvatarSize, 3)}
              </View>
              {orbitUsers.map((u, idx) => (
                <Animated.View
                  key={u.idx}
                  style={{
                    position: 'absolute',
                    transform: [
                      { translateX: u.x },
                      {
                        translateY: floatAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: idx % 2 === 0 ? [u.y - 6, u.y + 6] : [u.y + 6, u.y - 6],
                        }),
                      },
                    ],
                  }}
                >
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={styles.orbitAvatar} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={u.grad} style={styles.orbitAvatar}>
                      <Text style={styles.orbitLetter}>{u.letter}</Text>
                    </LinearGradient>
                  )}
                </Animated.View>
              ))}
            </View>

            <Text style={styles.title}>{t('match.searching')}</Text>
            <View style={styles.glassPill}>
              <Users size={14} color="#fff" strokeWidth={2.2} />
              <Text style={styles.glassPillText}>{formatQueueLabel()}</Text>
            </View>
          </>
        ) : (
          <>
            {/* الأفاتار البطل بحلقة لونية */}
            <View style={styles.heroWrap}>
              <LinearGradient
                colors={[...theme.preview]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroRing, { width: heroSize + 16, height: heroSize + 16, borderRadius: (heroSize + 16) / 2 }]}
              >
                <View style={[styles.heroRingInner, { width: heroSize + 6, height: heroSize + 6, borderRadius: (heroSize + 6) / 2, backgroundColor: theme.bg[2] }]}>
                  {renderCenterAvatar(heroSize, 0)}
                </View>
              </LinearGradient>
              <View style={[styles.heroBadge, { backgroundColor: theme.accent }]}>
                {isVideo ? (
                  <Video size={18} color="#fff" strokeWidth={2.4} />
                ) : (
                  <Mic size={18} color="#fff" strokeWidth={2.4} />
                )}
              </View>
            </View>

            <Text style={styles.title}>{isVideo ? t('match.video') : t('match.voice')}</Text>
            <Text style={styles.subtitle}>
              {isVideo ? t('match.setPreferences') : t('match.readyToChat')}
            </Text>

            {/* صف الانتظار — دليل اجتماعي */}
            {queuePreview.length > 0 ? (
              <View style={styles.waitRow}>
                <View style={styles.waitStack}>
                  {queuePreview.slice(0, 4).map((p, k) =>
                    p.avatar ? (
                      <Image
                        key={k}
                        source={{ uri: p.avatar }}
                        style={[styles.waitAvatar, { marginStart: k > 0 ? -12 : 0, zIndex: 4 - k }]}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient
                        key={k}
                        colors={pickGrad(k + 1)}
                        style={[styles.waitAvatar, { marginStart: k > 0 ? -12 : 0, zIndex: 4 - k }]}
                      >
                        <Text style={styles.waitAvatarLetter}>{(p.displayName ?? '?').charAt(0)}</Text>
                      </LinearGradient>
                    ),
                  )}
                </View>
                <Text style={styles.waitText}>{formatQueueLabel()}</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <View style={styles.glassPill}>
                  <Users size={14} color="#fff" strokeWidth={2.2} />
                  <Text style={styles.glassPillText}>{formatQueueLabel()}</Text>
                </View>
                {queueHint ? (
                  <Text style={styles.queueHint}>{queueHint}</Text>
                ) : null}
              </View>
            )}

            {/* فئات العمر (فيديو) */}
            {isVideo && (
              <View style={styles.ageRow}>
                {(Object.keys(ageRanges) as Array<keyof typeof ageRanges>).map((r) => {
                  const active = ageRanges[r];
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setAgeRanges((p) => ({ ...p, [r]: !p[r] }))}
                      style={({ pressed }) => [
                        styles.ageChip,
                        active && { backgroundColor: theme.accent, borderColor: theme.accent },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.ageChipText, active && { color: '#fff' }]}>{r}</Text>
                      {active && (
                        <View style={styles.ageCheck}>
                          <Check size={10} color={theme.accent} strokeWidth={3.2} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {/* ===== شريط سفلي زجاجي ===== */}
      <View style={[styles.footerSheet, { paddingBottom: insets.bottom + 16 }]}>
        {!searching && (
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Wallet size={15} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
              <Text style={styles.metaValue}>{(user?.stats?.coins ?? 0).toLocaleString('en-US')}</Text>
              <Text style={styles.metaCaption}>{t('wallet.balance')}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Coins size={15} color={lu.colors.gold} strokeWidth={2.2} />
              <Text style={[styles.metaValue, { color: theme.accentLight }]}>
                {matchPriceLabel}
              </Text>
              <Text style={styles.metaCaption}>{isVideo ? t('match.video') : t('match.voice')}</Text>
            </View>
          </View>
        )}

        {searching ? (
          <Pressable
            onPress={handleCancelSearch}
            style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <Power size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.stopBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleStartMatching}
              disabled={loading}
              style={({ pressed }) => [{ flex: 1, opacity: pressed || loading ? 0.92 : 1 }]}
            >
              <LinearGradient
                colors={[...theme.cta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.startBtn, { shadowColor: theme.accent }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {isVideo ? (
                      <Video size={18} color="#fff" strokeWidth={2.4} />
                    ) : (
                      <Mic size={18} color="#fff" strokeWidth={2.4} />
                    )}
                    <Text style={styles.startBtnText}>{t('match.start')}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => setShowSchedule(true)}
              style={({ pressed }) => [styles.sideBtn, pressed && { opacity: 0.7 }]}
            >
              <Calendar size={20} color="#fff" strokeWidth={2.2} />
            </Pressable>
          </View>
        )}
      </View>

      {/* ===== بطاقة تأكيد المطابقة (قبول/رفض قبل الرنين) ===== */}
      <Modal
        visible={!!pendingMatch}
        transparent
        animationType="fade"
        onRequestClose={handleRejectMatch}
      >
        <View style={styles.matchBackdrop}>
          <View style={styles.matchCard}>
            <LinearGradient
              colors={[...theme.preview]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.matchAvatarRing}
            >
              {pendingMatch?.avatar ? (
                <Image
                  source={{ uri: pendingMatch.avatar }}
                  style={styles.matchAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.matchAvatar, styles.matchAvatarFallback]}>
                  <Text style={styles.matchAvatarLetter}>
                    {(pendingMatch?.displayName ?? '؟').charAt(0)}
                  </Text>
                </View>
              )}
            </LinearGradient>

            <Text style={styles.matchFoundLabel}>تم العثور على شريك</Text>
            <Text style={styles.matchName} numberOfLines={1}>
              {pendingMatch?.displayName ?? 'شريك متاح'}
            </Text>
            <Text style={styles.matchHint}>
              {isVideo
                ? 'هل تريد بدء مكالمة فيديو الآن؟'
                : 'هل تريد بدء مكالمة صوتية الآن؟'}
            </Text>

            <View style={styles.matchActions}>
              <Pressable
                onPress={handleRejectMatch}
                style={({ pressed }) => [styles.matchReject, pressed && { opacity: 0.85 }]}
              >
                <X size={20} color={lu.colors.ink2} strokeWidth={2.6} />
                <Text style={styles.matchRejectText}>تجاهل</Text>
              </Pressable>
              <Pressable
                onPress={handleAcceptMatch}
                style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={[...theme.cta]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.matchAccept}
                >
                  {isVideo ? (
                    <Video size={18} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <Mic size={18} color="#fff" strokeWidth={2.5} />
                  )}
                  <Text style={styles.matchAcceptText}>بدء المكالمة</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScheduleMatchSheet
        visible={showSchedule}
        type={matchType}
        ageRanges={isVideo ? Object.entries(ageRanges).filter(([, v]) => v).map(([k]) => k) : []}
        onClose={() => setShowSchedule(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glowOrb: {
    position: 'absolute',
    top: '16%',
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.55,
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: lu.radius.base,
    marginTop: 6,
    overflow: 'hidden',
    ...lu.shadows.grad,
    shadowOpacity: 0.28,
  },
  dueBannerTitle: { fontSize: 14, color: '#fff', fontFamily: lu.fonts.bodyBold },
  dueBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1, fontFamily: lu.fonts.body },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 7,
    marginHorizontal: 10,
  },
  headerPillText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  selfHalo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
  },
  orbitAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  orbitLetter: {
    color: '#fff',
    fontSize: 16,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroRing: {
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.grad,
  },
  heroRingInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    bottom: -2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: lu.fonts.displayHeavy,
    marginTop: 26,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: lu.fonts.body,
    marginTop: 6,
    textAlign: 'center',
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: lu.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  waitStack: { flexDirection: 'row', alignItems: 'center' },
  waitAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitAvatarLetter: { color: '#fff', fontSize: 12, fontFamily: lu.fonts.displayHeavy, includeFontPadding: false },
  waitText: { color: '#fff', fontSize: 13, fontFamily: lu.fonts.bodySemi, includeFontPadding: false },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: lu.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    maxWidth: '100%',
  },
  glassPillText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: lu.fonts.bodySemi,
    flexShrink: 1,
    includeFontPadding: false,
  },
  queueHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontFamily: lu.fonts.body,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 18,
    maxWidth: 300,
  },
  ageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  ageChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: lu.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ageChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  ageCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSheet: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: lu.radius.xl,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  metaItem: { flex: 1, alignItems: 'center', gap: 2 },
  metaCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: lu.fonts.bodyMedium,
    includeFontPadding: false,
  },
  metaValue: {
    color: '#fff',
    fontSize: 15,
    fontFamily: lu.fonts.displaySemi,
    includeFontPadding: false,
  },
  metaDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.14)' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  startBtn: {
    height: 54,
    borderRadius: lu.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  stopBtn: {
    height: 54,
    borderRadius: lu.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: lu.colors.live,
    shadowColor: lu.colors.live,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  // ===== بطاقة تأكيد المطابقة =====
  matchBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  matchCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.xl,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'center',
    ...lu.shadows.card,
  },
  matchAvatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.grad,
  },
  matchAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAvatarFallback: {
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  matchAvatarLetter: {
    color: '#fff',
    fontSize: 40,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  matchFoundLabel: {
    color: lu.colors.muted,
    fontSize: 13,
    fontFamily: lu.fonts.bodySemi,
    marginTop: 16,
    includeFontPadding: false,
  },
  matchName: {
    color: lu.colors.ink,
    fontSize: 22,
    fontFamily: lu.fonts.displayHeavy,
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  matchHint: {
    color: lu.colors.ink2,
    fontSize: 14,
    fontFamily: lu.fonts.body,
    marginTop: 8,
    textAlign: 'center',
  },
  matchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  matchReject: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: lu.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  matchRejectText: {
    color: lu.colors.ink2,
    fontSize: 15,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  matchAccept: {
    height: 52,
    borderRadius: lu.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  matchAcceptText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
});
