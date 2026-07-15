/**
 * Discover / Home — الاستكشاف (التصميم الجديد)
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import {
  Check,
  Bell, Search,
  SlidersHorizontal,
  MapPin,
  ShieldCheck,
  BadgeCheck,
  MessageCircleHeart,
} from 'lucide-react-native';
import { ArrowRight } from '@/components/ui/RtlIcons';

import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { useAuth } from '@/hooks/useAuth';
import { useDiscoverUsers } from '@/hooks/useUsers';
import { UserDoc } from '@/services/firebase/users';
import { subscribeToMyFollowingIds } from '@/services/firebase/follow';
import { isUserOnline, resolveLastSeenMs } from '@/utils/presence';
import { usePresenceForUids } from '@/hooks/usePresence';
import { useMatchQueueOnlineCount } from '@/hooks/useMatchQueueOnlineCount';
import { DiscoverFilterModal } from '@/components/discover/DiscoverFilterModal';
import { ExploreUserCard } from '@/components/discover/ExploreUserCard';
import { HomeGamesHub } from '@/components/home/HomeGamesHub';
import {
  TabScreenHeader,
  HeaderIconButton,
  useTabHeaderMetrics,
} from '@/components/layout/TabScreenHeader';
import {
  DEFAULT_DISCOVER_USER_FILTER,
  isDiscoverFilterActive,
  userMatchesDiscoverFilter,
  type DiscoverUserFilter,
} from '@/utils/discoverFilter';
import {
  filterUsersByOppositeGender,
  readUserGender,
} from '@/utils/genderAccess';
import {
  requestLocationPermission,
  hasLocationPermission,
  ensureUserLocationSynced,
  bootstrapUserLocation,
  subscribeLocationSynced,
  getNearbyUsers,
  getUserStoredLocation,
  formatDistance,
  type NearbyUser,
} from '@/services/locationService';

const HEAVY = lu.fonts.bodyHeavy;
const DISP = lu.fonts.displayHeavy;
const SEMI = lu.fonts.bodySemi;
const BODY = lu.fonts.body;

type MatchMode = 'video' | 'voice';
type DsTab = 'all' | 'nearby' | 'list';

// شكل البطاقة بقصّة علوية منحنية (درجة ناعمة) على الجهة اليمنى — تُعكس في RTL.
const NOTCH_DIP = 17;
const GIRL_RISE = 16; // مقدار بروز صورة الفتاة فوق حافة البطاقة.
const TICKET_R = 32; // نصف قطر زوايا البطاقة.
const notchTicketPath = (w: number, h: number, mirror: boolean) => {
  const r = TICKET_R;
  const d = NOTCH_DIP;
  const x1 = w * 0.34; // بداية انحدار القصّة
  const x2 = w * 0.68; // نهاية الانحدار
  const k = (x2 - x1) * 0.9;
  const X = (x: number) => (mirror ? w - x : x);
  return [
    `M ${X(0)} ${r}`,
    `Q ${X(0)} 0 ${X(r)} 0`,
    `L ${X(x1)} 0`,
    `C ${X(x1 + k)} 0 ${X(x2 - k)} ${d} ${X(x2)} ${d}`,
    `L ${X(w - r)} ${d}`,
    `Q ${X(w)} ${d} ${X(w)} ${d + r}`,
    `L ${X(w)} ${h - r}`,
    `Q ${X(w)} ${h} ${X(w - r)} ${h}`,
    `L ${X(r)} ${h}`,
    `Q ${X(0)} ${h} ${X(0)} ${h - r}`,
    'Z',
  ].join(' ');
};


export default function DiscoverScreen() {
  const { t, isRTL: isRtl } = useAppLanguage();
  const L = (ar: string, en: string) => (isRtl ? ar : en);
  const ROW = 'row';

  const { isDark } = useThemeMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user: currentUser } = useAuth();
  const PAD = W < 360 ? 14 : 16;
  const headerMetrics = useTabHeaderMetrics(W);
  const GAP = 13;
  const cardW = Math.floor((W - PAD * 2 - GAP) / 2);

  const videoQueueCount = useMatchQueueOnlineCount('video');
  const voiceQueueCount = useMatchQueueOnlineCount('voice');
  const [dsTab, setDsTab] = useState<DsTab>('all');
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverUserFilter>(DEFAULT_DISCOVER_USER_FILTER);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const { users, loading, refresh } = useDiscoverUsers({ pageSize: 40 });
  const { presenceMap, now: presenceNow } = usePresenceForUids(
    useMemo(() => (users ?? []).map((u) => u.uid), [users]),
  );
  const [refreshing, setRefreshing] = useState(false);

  // ========= Nearby Geo State =========
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const nearbyFetchedRef = useRef(false);

  const fetchNearbyUsers = useCallback(async () => {
    setNearbyLoading(true);
    try {
      let coords = await ensureUserLocationSynced(true);
      const granted = await hasLocationPermission();
      setLocationGranted(granted);
      // fallback: استخدم آخر إحداثيات مخزنة لو التحديث اللحظي لم يعد إحداثيات.
      if (!coords && granted) {
        const stored = await getUserStoredLocation();
        if (stored) {
          coords = { latitude: stored.latitude, longitude: stored.longitude };
        }
      }
      if (!granted || !coords) {
        setNearbyUsers([]);
        return null;
      }
      setMyCoords(coords);
      const results = await getNearbyUsers(coords.latitude, coords.longitude, 50, 40);
      setNearbyUsers(results);
      nearbyFetchedRef.current = true;
      return results;
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    void bootstrapUserLocation().catch(() => {});
  }, [currentUser?.uid]);

  // تجهيز حالة الصلاحية/الإحداثيات مبكراً من الشاشة الرئيسية.
  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      const granted = await hasLocationPermission();
      if (cancelled) return;
      setLocationGranted(granted);
      if (granted) {
        const coords =
          (await ensureUserLocationSynced(false)) ??
          (await getUserStoredLocation());
        if (!cancelled && coords) {
          setMyCoords({ latitude: coords.latitude, longitude: coords.longitude });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    return subscribeLocationSynced((coords) => {
      void hasLocationPermission().then(setLocationGranted);
      if (coords && dsTab === 'nearby') {
        void fetchNearbyUsers();
      }
    });
  }, [dsTab, fetchNearbyUsers]);

  useEffect(() => {
    if (dsTab !== 'nearby') return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchNearbyUsers();
    })();
    return () => { cancelled = true; };
  }, [dsTab, fetchNearbyUsers]);

  const handleEnableLocation = useCallback(async () => {
    const granted = await requestLocationPermission();
    setLocationGranted(granted);
    if (!granted) return;
    await fetchNearbyUsers();
  }, [fetchNearbyUsers]);
  // ========= End Nearby Geo State =========

  const myUid = currentUser?.uid;

  // استبعاد من أتابعهم أصلاً (ونفسي) من «الأشخاص المقترحون»
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!myUid) {
      setFollowingIds(new Set());
      return;
    }
    return subscribeToMyFollowingIds(myUid, setFollowingIds);
  }, [myUid]);

  const myGender = readUserGender(currentUser);

  const nearbyDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    nearbyUsers.forEach((u) => map.set(u.uid, u.distanceKm));
    return map;
  }, [nearbyUsers]);

  const displayedUsers = useMemo(() => {
    if (dsTab === 'nearby') {
      let list: UserDoc[] = nearbyUsers;
      list = list.filter((u) => u.uid !== myUid && !followingIds.has(u.uid));
      list = filterUsersByOppositeGender(list, myGender);
      list = list.filter((u) => userMatchesDiscoverFilter(u, discoverFilter, presenceMap, presenceNow));
      return list;
    }

    let list = (users ?? []).filter((u) => u.uid !== myUid && !followingIds.has(u.uid));
    list = filterUsersByOppositeGender(list, myGender);
    list = list.filter((u) => userMatchesDiscoverFilter(u, discoverFilter, presenceMap, presenceNow));
    list.sort((a, b) => {
      const aOnline = isUserOnline(resolveLastSeenMs(a.lastSeen, presenceMap[a.uid]), presenceNow);
      const bOnline = isUserOnline(resolveLastSeenMs(b.lastSeen, presenceMap[b.uid]), presenceNow);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return 0;
    });
    return list;
  }, [users, myUid, dsTab, currentUser, discoverFilter, presenceMap, presenceNow, myGender, nearbyUsers, followingIds]);

  const isNearby = dsTab === 'nearby';
  const filterActive = isDiscoverFilterActive(discoverFilter);
  const emptyFilter = !loading && !nearbyLoading && displayedUsers.length === 0 && filterActive;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (dsTab === 'nearby') {
        await fetchNearbyUsers();
      } else {
        await refresh?.();
      }
    } finally {
      setRefreshing(false);
    }
  }, [refresh, dsTab, fetchNearbyUsers]);

  // بطاقتا المطابقة (فيديو/صوت) — جنباً إلى جنب بدون تمرير.
  const ticketW = Math.floor((W - PAD * 2 - 10) / 2);
  const ticketH = Math.round(ticketW * 0.72);
  const notchD = notchTicketPath(ticketW, ticketH, isRtl);
  const onlineLabel = (n: number) => `${n.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} ${L('متصل', 'online')}`;
  // آخر كلمة من الوصف تُبرز بالأحمر — مثل "instantly" في التصميم المرجعي.
  const splitAccent = (s: string): [string, string] => {
    const words = s.trim().split(/\s+/);
    return [words.slice(0, -1).join(' '), words[words.length - 1] ?? ''];
  };
  // لوحة ألوان الصفحة حسب الوضع (داكن/فاتح).
  const pal = isDark
    ? {
        pageGrad: [...lu.gradients.pageHomeNight] as [string, string, ...string[]],
        sectionTitle: lu.colors.nightInk,
        pillInactiveBg: lu.colors.nightCard,
        pillBorder: lu.colors.nightLine,
        pillInactiveText: 'rgba(255,255,255,0.62)',
        filterBg: lu.colors.nightCard,
        filterIcon: 'rgba(255,255,255,0.62)',
        filterDotBorder: lu.colors.night0,
        emptyText: lu.colors.nightInk2,
        emptySubText: lu.colors.nightMuted,
        headerIcon: '#fff',
      }
    : {
        pageGrad: ['#FBEAEA', '#FBF1F1', '#F8F6F7'] as [string, string, ...string[]],
        sectionTitle: '#15151A',
        pillInactiveBg: '#FFFFFF',
        pillBorder: '#EEE7E8',
        pillInactiveText: '#6B7280',
        filterBg: '#FFFFFF',
        filterIcon: '#6B7280',
        filterDotBorder: '#FFFFFF',
        emptyText: lu.colors.ink2,
        emptySubText: '#9CA3AF',
        headerIcon: lu.colors.ink,
      };

  const matchTickets = [
    {
      id: 'video' as MatchMode,
      girl: require('../../assets/images/hero_video_girl.webp'),
      icon: require('../../assets/images/hero_video_icon.png'),
      title: t('home.videoMatch'),
      sub: t('home.videoMatchDesc'),
      online: onlineLabel(videoQueueCount),
      bg: ['#A8163E', '#5E0E26', '#2A0812'] as const,
      border: 'rgba(255,90,130,0.4)',
      cta: ['#FF4D66', '#E1142E'] as const,
      glow: '#FF2D55',
      waves: false,
    },
    {
      id: 'voice' as MatchMode,
      girl: require('../../assets/images/hero_voice_girl.webp'),
      icon: require('../../assets/images/hero_voice_icon.png'),
      title: t('home.voiceMatch'),
      sub: t('home.voiceMatchDesc'),
      online: onlineLabel(voiceQueueCount),
      bg: ['#5B1E9E', '#38115F', '#190930'] as const,
      border: 'rgba(178,120,255,0.4)',
      cta: ['#9B5CFF', '#6C2BD9'] as const,
      glow: '#8B5CF6',
      waves: true,
    },
  ];
  const WAVE_HEIGHTS = [10, 22, 14, 30, 18, 38, 24, 44, 20, 34, 15, 26, 12, 20, 9];

  // نبض زر البدء + توهجه — لمسة حيّة على البطاقة الرئيسية.
  const ctaGlow = useSharedValue(0);
  const ctaPress = useSharedValue(1);
  useEffect(() => {
    ctaGlow.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const ctaAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaPress.value * (1 + ctaGlow.value * 0.02) }],
    shadowOpacity: 0.35 + ctaGlow.value * 0.3,
  }));

  const heroDotGlow = useAnimatedStyle(() => ({
    opacity: 0.55 + ctaGlow.value * 0.45,
    transform: [{ scale: 0.9 + ctaGlow.value * 0.35 }],
  }));

  const dsTabs: { id: DsTab; label: string }[] = [
    { id: 'all', label: t('home.filterAll') },
    { id: 'nearby', label: t('home.tabNearby') },
  ];

  const renderUser = useCallback(
    ({ item }: { item: UserDoc }) => (
      <ExploreUserCard
        user={item}
        dark={isDark}
        width={cardW}
        currentUid={myUid}
        isFollowing={!!myUid && followingIds.has(item.uid)}
        presenceTs={presenceMap[item.uid]}
        presenceNow={presenceNow}
        distanceKm={nearbyDistanceMap.get(item.uid)}
        onPress={() => router.push(`/profile/${item.uid}` as any)}
      />
    ),
    [cardW, myUid, followingIds, presenceMap, presenceNow, router, nearbyDistanceMap, isDark],
  );

  const ListHeader = (
    <View>
      <View style={{ paddingTop: insets.top + 8 }}>
        <TabScreenHeader dark={isDark} pad={PAD}>
          <HeaderIconButton dark={isDark} onPress={() => router.push('/search' as any)}>
            <Search size={headerMetrics.iconSize} color={pal.headerIcon} strokeWidth={2.2} />
          </HeaderIconButton>
          <HeaderIconButton dark={isDark} badge onPress={() => router.push('/notifications' as any)}>
            <Bell size={headerMetrics.iconSize} color={pal.headerIcon} strokeWidth={2.2} />
          </HeaderIconButton>
        </TabScreenHeader>
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={{ flexDirection: ROW, gap: 10, paddingHorizontal: PAD, marginTop: GIRL_RISE + 2 }}>
        {matchTickets.map((tk) => (
          <Animated.View key={tk.id} style={[ctaAnimStyle, { width: ticketW }]}>
            <Pressable
              onPressIn={() => { ctaPress.value = withTiming(0.96, { duration: 90 }); }}
              onPressOut={() => { ctaPress.value = withSpring(1); }}
              onPress={() => router.push(`/match/${tk.id}` as any)}
              style={{ height: ticketH }}
            >
              <MaskedView
                style={StyleSheet.absoluteFillObject}
                maskElement={
                  <Svg width={ticketW} height={ticketH}>
                    <Path d={notchD} fill="#fff" />
                  </Svg>
                }
              >
                <View style={{ flex: 1 }}>
                  <LinearGradient
                    colors={[...tk.bg]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {tk.waves ? (
                    <View style={[styles.waveRow, { flexDirection: ROW }]} pointerEvents="none">
                      {WAVE_HEIGHTS.map((h, i) => (
                        <View key={i} style={[styles.waveBar, { height: h }]} />
                      ))}
                    </View>
                  ) : null}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.girlArc,
                      {
                        width: ticketH * 1.55,
                        height: ticketH * 1.55,
                        borderRadius: ticketH * 0.78,
                        top: -ticketH * 0.18,
                        end: -ticketH * 0.45,
                      },
                    ]}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.girlArcInner,
                      {
                        width: ticketH * 1.15,
                        height: ticketH * 1.15,
                        borderRadius: ticketH * 0.58,
                        top: 0,
                        end: -ticketH * 0.3,
                      },
                    ]}
                  />
                  <LinearGradient
                    colors={[tk.bg[1], `${tk.bg[1]}00`]}
                    start={{ x: isRtl ? 1 : 0, y: 0.5 }}
                    end={{ x: isRtl ? 0.4 : 0.6, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                </View>
              </MaskedView>
              <Svg
                width={ticketW}
                height={ticketH}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              >
                <Path d={notchD} fill="none" stroke={tk.border} strokeWidth={1.5} />
              </Svg>
              <View
                pointerEvents="none"
                style={[
                  styles.girlWrap,
                  // خصائص منطقية — تنعكس تلقائياً مع RTL لتبقى الفتاة على جهة القصّة.
                  { height: ticketH + GIRL_RISE, end: 0, borderBottomEndRadius: TICKET_R },
                ]}
              >
                <Image
                  source={tk.girl}
                  style={styles.ticketGirl}
                  contentFit="cover"
                  contentPosition="top"
                />
              </View>
              <View style={styles.ticketContent}>
                <Image source={tk.icon} style={styles.ticketIcon} contentFit="contain" />
                <View style={[styles.heroTitleRow, { flexDirection: ROW }]}>
                  <Image source={require('../../assets/images/heart-glow.png')} style={styles.heroHeart} contentFit="contain" />
                  <Text style={styles.ticketTitle} numberOfLines={1}>{tk.title}</Text>
                </View>
                <Text style={[styles.ticketSub, { textAlign: isRtl ? 'right' : 'left' }]} numberOfLines={2}>
                  {splitAccent(tk.sub)[0]}{splitAccent(tk.sub)[0] ? ' ' : ''}
                  <Text style={styles.ticketSubAccent}>{splitAccent(tk.sub)[1]}</Text>
                </Text>
                <View style={[styles.onlineRow, { flexDirection: ROW }]}>
                  <Animated.View style={[styles.onlineDot, heroDotGlow]} />
                  <Text style={styles.onlineRowText}>{tk.online}</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </Animated.View>

      {/* شرائح الثقة — معطلة مؤقتاً
      <Animated.View entering={FadeInDown.delay(80).duration(500)} style={[styles.trust, { marginHorizontal: PAD, flexDirection: ROW }]}>
        {([
          [t('home.trustModerated'), ShieldCheck],
          [t('home.trustVerified'), BadgeCheck],
          [t('home.trustSafeChat'), MessageCircleHeart],
        ] as const).map(([label, TrustIcon], i) => (
          <View key={i} style={[styles.trustItem, { flexDirection: ROW }]}>
            <View style={styles.trustIconWrap}>
              <TrustIcon size={19} color="#FF6B7A" strokeWidth={2.1} />
              <View style={styles.trustCheck}>
                <Check size={7.5} color="#fff" strokeWidth={4} />
              </View>
            </View>
            <Text style={styles.trustText} numberOfLines={2}>{label}</Text>
          </View>
        ))}
      </Animated.View>
      */}

      <Animated.View entering={FadeInDown.delay(160).duration(500)}>
        <HomeGamesHub pad={PAD} dark={isDark} onNavigate={(route) => router.push(route as any)} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(500)} style={[styles.sectionHead, { marginHorizontal: PAD, flexDirection: ROW, marginTop: 22 }]}>
        <Text style={[styles.sectionTitle, { color: pal.sectionTitle }]}>{t('home.suggestedPeople')}</Text>
        <View style={[styles.sectionActions, { flexDirection: ROW }]}>
          {dsTabs.map((tb) => {
            const active = dsTab === tb.id;
            return (
              <Pressable key={tb.id} onPress={() => setDsTab(tb.id)}>
                {active ? (
                  <LinearGradient colors={['#FF2D2D', '#B00E0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pillActive}>
                    <Text style={[styles.pillText, { color: '#fff' }]}>{tb.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.pillInactive, { backgroundColor: pal.pillInactiveBg, borderColor: pal.pillBorder }]}>
                    <Text style={[styles.pillText, { color: pal.pillInactiveText }]}>{tb.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setFilterModalOpen(true)}
            style={[styles.filterBtn, { backgroundColor: pal.filterBg, borderColor: pal.pillBorder }, filterActive && styles.filterBtnActive]}
            accessibilityLabel={t('home.filterTitle')}
          >
            <SlidersHorizontal size={16} color={filterActive ? '#FF5C5C' : pal.filterIcon} strokeWidth={2.4} />
            <View style={[styles.filterDot, { borderColor: pal.filterDotBorder }]} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );

  return (
    <>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <LinearGradient colors={pal.pageGrad} locations={[0, 0.2, 0.45]} style={styles.root}>
      <FlatList
        data={displayedUsers}
        keyExtractor={(u) => u.uid}
        renderItem={renderUser}
        numColumns={2}
        columnWrapperStyle={[styles.gridRow, { gap: GAP, paddingHorizontal: PAD, flexDirection: ROW }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          (loading || nearbyLoading)
            ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color={lu.colors.pink} />
                {nearbyLoading && <Text style={[styles.emptySubText, { marginTop: 12 }]}>{t('home.loadingNearby')}</Text>}
              </View>
            )
            : isNearby && locationGranted === false
            ? (
              <View style={styles.empty}>
                <MapPin size={40} color="#E11414" strokeWidth={1.8} />
                <Text style={[styles.emptyText, { marginTop: 12 }]}>{t('home.enableLocationDesc')}</Text>
                <Pressable style={styles.enableLocBtn} onPress={handleEnableLocation}>
                  <LinearGradient colors={['#FF2D2D', '#B00E0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enableLocGrad}>
                    <Text style={styles.enableLocText}>{t('home.enableLocation')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )
            : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: pal.emptyText }]}>
                  {emptyFilter
                    ? t('home.noUsersFilter')
                    : isNearby
                      ? t('home.noNearbyPeople')
                      : t('home.noPeople')}
                </Text>
                {emptyFilter ? (
                  <Text style={[styles.emptySubText, { color: pal.emptySubText }]}>{t('home.noUsersFilterDesc')}</Text>
                ) : isNearby ? (
                  <Text style={[styles.emptySubText, { color: pal.emptySubText }]}>{t('home.noNearbyPeopleDesc')}</Text>
                ) : null}
              </View>
            )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.pink} />}
      />
    </LinearGradient>
    <DiscoverFilterModal
      visible={filterModalOpen}
      value={discoverFilter}
      onConfirm={setDiscoverFilter}
      onClose={() => setFilterModalOpen(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // حاوية صورة الفتاة — تبرز فوق حافة البطاقة المقصوصة.
  girlWrap: {
    position: 'absolute',
    bottom: 0,
    width: '52%',
    overflow: 'hidden',
  },
  ticketGirl: {
    width: '100%',
    height: '100%',
  },
  ticketContent: {
    flex: 1,
    width: '64%',
    paddingHorizontal: 11,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 3,
  },
  ticketIcon: {
    width: 34,
    height: 34,
    marginBottom: 2,
  },
  ticketTitle: {
    color: '#fff', fontSize: 13, fontWeight: '800', fontFamily: DISP, flexShrink: 1,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  ticketSub: {
    color: 'rgba(255,255,255,0.85)', fontSize: 10, lineHeight: 14, fontFamily: BODY,
    includeFontPadding: false,
  },
  ticketSubAccent: {
    color: '#FF4D5E', fontStyle: 'italic', fontWeight: '800', fontFamily: HEAVY,
  },
  waveRow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(200,150,255,0.3)',
  },
  girlArc: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  girlArcInner: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroTitleRow: {
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  heroHeart: { width: 13, height: 13 },
  onlinePill: {
    alignItems: 'center', gap: 5, flexShrink: 0,
    backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#36E07A', shadowColor: '#36E07A', shadowOpacity: 0.9, shadowRadius: 5 },
  onlineText: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: lu.fonts.bodyBold, includeFontPadding: false },
  // صفّ المتصلين أسفل الوصف داخل البطاقة.
  onlineRow: { alignItems: 'center', gap: 5, marginTop: 3 },
  onlineRowText: {
    color: 'rgba(255,255,255,0.72)', fontSize: 9.5, fontWeight: '700',
    fontFamily: lu.fonts.bodyBold, includeFontPadding: false,
  },

  trust: { alignItems: 'stretch', justifyContent: 'center', gap: 8, marginTop: 12 },
  trustItem: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: lu.colors.nightCard, borderWidth: 1, borderColor: lu.colors.nightLine2,
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3,
  },
  trustIconWrap: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,45,60,0.12)',
    shadowColor: '#FF3C4C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
  },
  trustCheck: {
    position: 'absolute', bottom: -2, end: -3,
    width: 13, height: 13, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderWidth: 1.4, borderColor: lu.colors.nightCard,
  },
  trustText: {
    fontSize: 11, color: lu.colors.nightInk, fontWeight: '600', fontFamily: SEMI, flexShrink: 1,
    includeFontPadding: false, textAlignVertical: 'center',
  },

  sectionHead: { alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: lu.colors.nightInk, fontFamily: HEAVY },

  pillActive: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99,
    shadowColor: '#E11414', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 3,
  },
  pillInactive: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99,
    backgroundColor: lu.colors.nightCard, borderWidth: 1, borderColor: lu.colors.nightLine,
  },
  pillText: { fontFamily: HEAVY, fontSize: 12.5, fontWeight: '800' },

  sectionActions: { alignItems: 'center', gap: 7 },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: lu.colors.nightCard,
    borderWidth: 1,
    borderColor: lu.colors.nightLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: 'rgba(255, 60, 60, 0.5)',
    backgroundColor: 'rgba(225, 20, 20, 0.16)',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF3D3D',
    borderWidth: 1.5,
    borderColor: lu.colors.night0,
  },

  gridRow: { marginBottom: 13, marginTop: 8 },
  empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: lu.colors.nightInk2, fontFamily: lu.fonts.bodyBold, textAlign: 'center' },
  emptySubText: {
    fontSize: 13,
    color: lu.colors.nightMuted,
    fontFamily: BODY,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  enableLocBtn: { marginTop: 18, borderRadius: 14, overflow: 'hidden' },
  enableLocGrad: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  enableLocText: { color: '#fff', fontSize: 14, fontWeight: '800', fontFamily: HEAVY, textAlign: 'center' },
});