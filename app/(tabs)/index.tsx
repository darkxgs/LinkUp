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
import {
  Check,
  Bell, Search, Video, Phone,
  SlidersHorizontal,
  MapPin,
} from 'lucide-react-native';
import { ArrowRight } from '@/components/ui/RtlIcons';

import { lu } from '@/theme/lu-brand';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { useAuth } from '@/hooks/useAuth';
import { useDiscoverUsers } from '@/hooks/useUsers';
import { UserDoc } from '@/services/firebase/users';
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

const MATCH_HERO_BG = {
  video: require('../../assets/images/video_match_bg.png'),
  voice: require('../../assets/images/voice_match_bg.png'),
} as const;

export default function DiscoverScreen() {
  const { t, isRTL: isRtl } = useAppLanguage();
  const L = (ar: string, en: string) => (isRtl ? ar : en);
  const ROW = 'row';

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user: currentUser } = useAuth();
  const PAD = W < 360 ? 14 : 16;
  const headerMetrics = useTabHeaderMetrics(W);
  const GAP = 13;
  const cardW = Math.floor((W - PAD * 2 - GAP) / 2);

  const [matchMode, setMatchMode] = useState<MatchMode>('video');
  const matchQueueCount = useMatchQueueOnlineCount(matchMode);
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

  const myGender = readUserGender(currentUser);

  const nearbyDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    nearbyUsers.forEach((u) => map.set(u.uid, u.distanceKm));
    return map;
  }, [nearbyUsers]);

  const displayedUsers = useMemo(() => {
    if (dsTab === 'nearby') {
      let list: UserDoc[] = nearbyUsers;
      list = filterUsersByOppositeGender(list, myGender);
      list = list.filter((u) => userMatchesDiscoverFilter(u, discoverFilter, presenceMap, presenceNow));
      return list;
    }

    let list = (users ?? []).filter((u) => u.uid !== myUid);
    list = filterUsersByOppositeGender(list, myGender);
    list = list.filter((u) => userMatchesDiscoverFilter(u, discoverFilter, presenceMap, presenceNow));
    list.sort((a, b) => {
      const aOnline = isUserOnline(resolveLastSeenMs(a.lastSeen, presenceMap[a.uid]), presenceNow);
      const bOnline = isUserOnline(resolveLastSeenMs(b.lastSeen, presenceMap[b.uid]), presenceNow);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return 0;
    });
    return list;
  }, [users, myUid, dsTab, currentUser, discoverFilter, presenceMap, presenceNow, myGender, nearbyUsers]);

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

  const isVid = matchMode === 'video';
  const heroW = W - PAD * 2;
  const heroH = Math.round(heroW * 0.42);
  const heroOverlay = isVid
  ? (['rgba(180,14,14,0.84)', 'rgba(225,20,20,0.52)', 'rgba(255,45,45,0.08)'] as const)
  : (['rgba(216, 29, 29, 0.84)', 'rgba(234, 38, 38, 0.52)', 'rgba(237, 68, 68, 0.08)'] as const);
  const heroTitle = isVid ? t('home.videoMatch') : t('home.voiceMatch');
  const heroSub = isVid ? t('home.videoMatchDesc') : t('home.voiceMatchDesc');
  const heroOnline = `${matchQueueCount.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} ${L('متصل', 'online')}`;
  const heroCta = t('home.matchStart');
  const heroCtaColor = isVid ? '#E11414' : '#EA2626';
  const vidBg = isVid ? '#fff' : 'rgba(255,255,255,0.18)';
  const vidCol = isVid ? '#E11414' : '#fff';
  const voiBg = !isVid ? '#fff' : 'rgba(255,255,255,0.18)';
  const voiCol = !isVid ? '#EA2626' : '#fff';

  const dsTabs: { id: DsTab; label: string }[] = [
    { id: 'all', label: t('home.filterAll') },
    { id: 'nearby', label: t('home.tabNearby') },
  ];

  const renderUser = useCallback(
    ({ item }: { item: UserDoc }) => (
      <ExploreUserCard
        user={item}
        width={cardW}
        currentUid={myUid}
        presenceTs={presenceMap[item.uid]}
        presenceNow={presenceNow}
        distanceKm={nearbyDistanceMap.get(item.uid)}
        onPress={() => router.push(`/profile/${item.uid}` as any)}
      />
    ),
    [cardW, myUid, presenceMap, presenceNow, router, nearbyDistanceMap],
  );

  const ListHeader = (
    <View>
      <View style={{ paddingTop: insets.top + 8 }}>
        <TabScreenHeader pad={PAD} subtitle={t('rooms.homeSubtitle')}>
          <HeaderIconButton onPress={() => router.push('/search' as any)}>
            <Search size={headerMetrics.iconSize} color={lu.colors.ink} strokeWidth={2.2} />
          </HeaderIconButton>
          <HeaderIconButton badge onPress={() => router.push('/notifications' as any)}>
            <Bell size={headerMetrics.iconSize} color={lu.colors.ink} strokeWidth={2.2} />
          </HeaderIconButton>
        </TabScreenHeader>
      </View>

      <View style={{ paddingHorizontal: PAD, marginTop: 4 }}>
        <View style={[styles.hero, { height: heroH }]}>
          <Image
            source={isVid ? MATCH_HERO_BG.video : MATCH_HERO_BG.voice}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            pointerEvents="none"
          />
          <LinearGradient
            colors={heroOverlay}
            start={{ x: isRtl ? 1 : 0, y: 0.5 }}
            end={{ x: isRtl ? 0 : 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroInner}>
            <View style={[styles.heroTopRow, { flexDirection: ROW }]}>
              <View style={[styles.heroToggle, { flexDirection: ROW }]}>
                <Pressable onPress={() => setMatchMode('video')} style={[styles.toggleBtn, { backgroundColor: vidBg, flexDirection: ROW }]}>
                  <Video size={13} color={vidCol} strokeWidth={2} />
                  <Text style={[styles.toggleText, { color: vidCol }]}>{t('home.matchVideo')}</Text>
                </Pressable>
                <Pressable onPress={() => setMatchMode('voice')} style={[styles.toggleBtn, { backgroundColor: voiBg, flexDirection: ROW }]}>
                  <Phone size={13} color={voiCol} strokeWidth={2} />
                  <Text style={[styles.toggleText, { color: voiCol }]}>{t('home.matchVoice')}</Text>
                </Pressable>
              </View>
              <View style={[styles.onlinePill, { flexDirection: ROW }]}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{heroOnline}</Text>
              </View>
            </View>
            <View style={styles.heroBody}>
              <Text style={[styles.heroTitle, { textAlign: isRtl ? 'right' : 'left' }]}>{heroTitle}</Text>
              <Text style={[styles.heroSub, { textAlign: isRtl ? 'right' : 'left' }]} numberOfLines={2}>{heroSub}</Text>
            </View>
            <Pressable style={[styles.heroCta, { flexDirection: ROW }]} onPress={() => router.push(`/match/${matchMode}` as any)}>
              <Text style={[styles.heroCtaText, { color: heroCtaColor }]}>{heroCta}</Text>
              <ArrowRight size={15} color={heroCtaColor} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.trust, { marginHorizontal: PAD, flexDirection: ROW }]}>
        {[
          t('home.trustModerated'),
          t('home.trustVerified'),
          t('home.trustSafeChat'),
        ].map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.trustDot} />}
            <View style={[styles.trustItem, { flexDirection: ROW }]}>
              <Check size={13} color="#36C98B" strokeWidth={3} />
              <Text style={styles.trustText}>{label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <HomeGamesHub pad={PAD} onNavigate={(route) => router.push(route as any)} />

      <View style={[styles.sectionHead, { marginHorizontal: PAD, flexDirection: ROW, marginTop: 22 }]}>
        <Text style={styles.sectionTitle}>{t('home.suggestedPeople')}</Text>
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
                  <View style={styles.pillInactive}>
                    <Text style={[styles.pillText, { color: '#6B7280' }]}>{tb.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setFilterModalOpen(true)}
            style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
            accessibilityLabel={t('home.filterTitle')}
          >
            <SlidersHorizontal size={16} color={filterActive ? '#E11414' : '#6B7280'} strokeWidth={2.4} />
            {filterActive ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <>
    <LinearGradient colors={['#FBEAEA', '#FBF1F1', '#F8F6F7']} locations={[0, 0.14, 0.3]} style={styles.root}>
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
                <Text style={styles.emptyText}>
                  {emptyFilter
                    ? t('home.noUsersFilter')
                    : isNearby
                      ? t('home.noNearbyPeople')
                      : t('home.noPeople')}
                </Text>
                {emptyFilter ? (
                  <Text style={styles.emptySubText}>{t('home.noUsersFilterDesc')}</Text>
                ) : isNearby ? (
                  <Text style={styles.emptySubText}>{t('home.noNearbyPeopleDesc')}</Text>
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

  hero: {
    borderRadius: 22, overflow: 'hidden',
    shadowColor: '#7A1414', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.38, shadowRadius: 20, elevation: 6,
  },
  heroInner: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  heroBody: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  heroTopRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroToggle: {
    alignItems: 'center', gap: 3, flexShrink: 1,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', padding: 3, borderRadius: 99,
  },
  toggleBtn: { alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 99 },
  toggleText: { fontFamily: HEAVY, fontSize: 11.5, fontWeight: '800' },
  heroTitle: {
    color: '#fff', fontSize: 19, fontWeight: '800', fontFamily: DISP,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 11.5, marginTop: 3, lineHeight: 16, maxWidth: '68%', fontFamily: BODY },
  onlinePill: {
    alignItems: 'center', gap: 5, flexShrink: 0,
    backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#36E07A', shadowColor: '#36E07A', shadowOpacity: 0.9, shadowRadius: 5 },
  onlineText: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: lu.fonts.bodyBold },
  heroCta: {
    alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff',
    borderRadius: 12, paddingVertical: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 3,
  },
  heroCtaText: { fontSize: 13, fontWeight: '800', fontFamily: HEAVY },

  trust: { alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 10 },
  trustDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#E0D6D6' },
  trustItem: { alignItems: 'center', gap: 5 },
  trustText: { fontSize: 11, color: '#7C7C85', fontWeight: '600', fontFamily: SEMI },

  sectionHead: { alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#15151A', fontFamily: HEAVY },

  pillActive: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99,
    shadowColor: '#E11414', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3,
  },
  pillInactive: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99, backgroundColor: '#fff',
    shadowColor: '#9A1414', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  pillText: { fontFamily: HEAVY, fontSize: 12.5, fontWeight: '800' },

  sectionActions: { alignItems: 'center', gap: 7 },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  filterBtnActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(225, 20, 20, 0.35)',
    backgroundColor: '#FDECEC',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E11414',
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  gridRow: { marginBottom: 13, marginTop: 8 },
  empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: lu.colors.ink2, fontFamily: lu.fonts.bodyBold, textAlign: 'center' },
  emptySubText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: BODY,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  enableLocBtn: { marginTop: 18, borderRadius: 14, overflow: 'hidden' },
  enableLocGrad: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  enableLocText: { color: '#fff', fontSize: 14, fontWeight: '800', fontFamily: HEAVY, textAlign: 'center' },
});