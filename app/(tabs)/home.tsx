/**
 * LinkUp — شاشة الغرف (تصميم جديد: تبويبات pill + اهتماماتك + موصى به)
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Text as RNText,
  useWindowDimensions,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import {
  Plus,
  Users,
  Gamepad2,
  Heart,
  Radio,
  LayoutGrid,
  List,
  Bell,
  Mic2,
  Building2,
  Crown,
  Search,
  Lock,
} from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { Text } from '@/components/ui';
import {
  TabScreenHeader,
  HeaderIconButton,
  useTabHeaderMetrics,
} from '@/components/layout/TabScreenHeader';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';
import { Room, isRoomLive, isPersonalHostRoom, quickCreateRoom } from '@/services/firebase/rooms';
import { spacing } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';
import { resolveDisplayName } from '@/utils/displayName';
import { toSafeInt } from '@/utils/safeNumber';
import { readListCache, writeListCache } from '@/utils/persistentListCache';
import { subscribeToAgencies, type Agency } from '@/services/firebase/social';
import {
  subscribeToFavoriteRoomsLive,
  subscribeToRecentRoomsLive,
  type FavoriteRoom,
  type RecentRoom,
} from '@/services/roomFeatures';
import { enterAgencyRoomAndNavigate, navigateToRoom } from '@/utils/navigateToRoom';
import { getAgencyPeriodWeekKey } from '@/services/agencyService';
import { getAgencyLevelProgress, type AgencyLevelsRuntimeConfig } from '@/services/agencyLevels';
import { useAgencyLevelsConfig } from '@/hooks/useAgencyLevelsConfig';
import { AgencyRoomCard, type AgencyCardLayout } from '@/components/agency/AgencyRoomCard';
import {
  CountryFilterPopover,
  CountryGlobeTrigger,
} from '@/components/agency/CountryFilterPopover';
import {
  subscribeToAgencyRoomFrames,
  resolveAgencyCardFrameUrl,
  type RoomFrame,
} from '@/services/firebase/agencyRoomDecor';
import { DesignIcon } from '@/components/icons/DesignIcon';
import { SearchSvg, BellSvg } from '@/components/icons/designSvgs';
import { subscribeToRoomsLuckyBagActive } from '@/services/luckyBag';
import { useAgencyRoomsPresence } from '@/hooks/useAgencyRoomsPresence';

// اتجاه التخطيط: يُضبط مرة واحدة عند الإقلاع (forceRTL) — يجعل التصميم مناسباً للعربي والإنجليزي
const IS_RTL = I18nManager.isRTL;
const START_TEXT_ALIGN = IS_RTL ? 'right' : 'left';

// خلفية لؤلؤية فاخرة (Pearl Premium Light)
const PAGE_GRAD = ['#FFFFFF', '#FDECEC', '#F8F6F7'] as const;

const PAGE_GRAD_LOC: readonly [number, number, number] = [0, 0.4, 1];

type InterestRoomItem = {
  roomId: string;
  roomName: string;
  hostAvatar?: string;
  isLive: boolean;
  isAgencyRoom?: boolean;
  isFavorite: boolean;
  lastVisit?: number;
};

function isAgencyInterest(room: { isAgencyRoom?: boolean; agencyId?: string }): boolean {
  return room.isAgencyRoom === true || Boolean(room.agencyId?.trim());
}

// cache على مستوى الموديول للوكالات — عرض فوري عند العودة للشاشة دون سبينر حاجب
let agenciesMemCache: Agency[] | null = null;

/** عنصر قائمة تبويب «الغرف» — وكالة أو غرفة شخصية عامة (مدموجتان) */
type RoomsListEntry =
  | { kind: 'agency'; agency: Agency }
  | { kind: 'room'; room: Room };

function resolveAgencySupportPercent(
  agency: Agency,
  levelsConfig: AgencyLevelsRuntimeConfig,
): number {
  const weekKey = getAgencyPeriodWeekKey();
  const coins =
    String(agency.periodSupportWeekKey ?? '') === weekKey
      ? Math.max(0, Number(agency.periodSupportCoins) || 0)
      : 0;
  const progress = getAgencyLevelProgress(coins, levelsConfig);
  return Math.round(progress.progressRatio * 100);
}

const FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#FF6B6B', '#3A0A0A'],
  ['#F7971E', '#FFD200'],
  ['#F0A0A0', '#FBD5D5'],
  ['#EA6666', '#8A0E0E'],
  ['#FCA5A5', '#f5576c'],
];

function formatRecent(lastSeen: number | undefined, t: (key: string) => string): string {
  if (!lastSeen) return i18n.t('rooms.recently');
  const diff = Date.now() - lastSeen;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return i18n.t('common.justNow');
  if (mins < 60) return `${i18n.t('time.minutesAgo', { count: mins })}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${i18n.t('time.hoursAgo', { count: hrs })}`;
  return i18n.t('rooms.recently');
}

function roomDisplayTitle(room: Room, t: (key: string) => string): string {
  const userFallback = i18n.t('rooms.userFallback');
  const voiceRoomDefault = i18n.t('rooms.voiceRoom');
  const fromName = resolveDisplayName({ displayName: room.name }, userFallback);
  if (fromName !== userFallback) return fromName;
  const host = resolveDisplayName({ displayName: room.hostName }, userFallback);
  return host !== userFallback ? host : voiceRoomDefault;
}

function pickGrad(seed: string | number): readonly [string, string] {
  const s = typeof seed === 'string' ? seed : String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length] ?? ['#F0A0A0', '#FBD5D5'];
}

function RoomSectionTitle({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <RNText style={[styles.roomSectionTitle, dark && { color: lu.colors.nightInk }]}>
      {children}
    </RNText>
  );
}

export default function RoomsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const pad = W < 360 ? 14 : 16;
  const roomGap = 13;
  const roomColW = Math.floor((W - pad * 2 - roomGap) / 2);
  const headerMetrics = useTabHeaderMetrics(W);
  const { isDark } = useThemeMode();
  const { user } = useAuth();
  const { rooms, loading } = useRooms(50);
  const levelsConfig = useAgencyLevelsConfig();

  const [refreshing, setRefreshing] = useState(false);
  const [country, setCountry] = useState('WW');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [favoriteInterestRooms, setFavoriteInterestRooms] = useState<
    (FavoriteRoom & { isLive: boolean })[]
  >([]);
  const [recentInterestRooms, setRecentInterestRooms] = useState<
    (RecentRoom & { isLive: boolean })[]
  >([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [agencies, setAgencies] = useState<Agency[]>(() => agenciesMemCache ?? []);
  const [agenciesLoading, setAgenciesLoading] = useState(() => !agenciesMemCache);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [agencyViewMode, setAgencyViewMode] = useState<AgencyCardLayout>('grid');
  const [agencyFrames, setAgencyFrames] = useState<RoomFrame[]>([]);
  const [luckyBagByRoomId, setLuckyBagByRoomId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = subscribeToAgencyRoomFrames(setAgencyFrames);
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setAgencies([]);
      setAgenciesLoading(false);
      return;
    }
    let mounted = true;

    if (!agenciesMemCache) {
      readListCache<Agency>('agencies').then((disk) => {
        if (mounted && disk?.length && !agenciesMemCache) {
          setAgencies(disk);
          setAgenciesLoading(false);
        }
      });
    }

    const unsub = subscribeToAgencies((list) => {
      agenciesMemCache = list;
      writeListCache('agencies', list);
      if (mounted) {
        setAgencies(list);
        setAgenciesLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [reloadTick, user?.uid]);

  const displayedInterestRooms = useMemo((): InterestRoomItem[] => {
    const userCountry = String(user?.profile?.country ?? 'PS').toUpperCase();

    // صورة الوكالة (نفس صورة كرت الوكالات بالأسفل) بدل صورة مدير الوكالة الشخصية.
    // نطابق ترتيب الأولوية المستخدم في AgencyRoomCard: غلاف → بانر → شعار → بانر الغرفة.
    const agencyById = new Map<string, Agency>();
    for (const ag of agencies) {
      if (ag.id) agencyById.set(ag.id, ag);
    }
    const roomById = new Map<string, (typeof rooms)[number]>();
    for (const r of rooms) {
      if (r.id) roomById.set(r.id, r);
    }
    const http = (v?: string): string | undefined =>
      v && v.startsWith('http') ? v : undefined;
    const resolveAgencyImage = (
      agencyId?: string,
      roomId?: string,
      fallback?: string,
    ): string | undefined => {
      const ag = agencyId ? agencyById.get(agencyId) : undefined;
      const room = roomId ? roomById.get(roomId) : undefined;
      return (
        http(ag?.logo) ??
        http(ag?.cardBackgroundUrl) ??
        http(ag?.banner) ??
        http(room?.banner) ??
        fallback
      );
    };

    const buildOfficialItems = (): InterestRoomItem[] => {
      const official = agencies.filter(
        (a) =>
          a.isCountryOfficialAgency &&
          (a.countryOfficialFor === userCountry || a.country === userCountry),
      );
      const items: InterestRoomItem[] = [];
      for (const ag of official.slice(0, 3)) {
        let roomId = ag.liveRoomId;
        if (!roomId) {
          const live = rooms.find((r) => r.agencyId === ag.id);
          roomId = live?.id;
        }
        if (!roomId) continue;
        items.push({
          roomId,
          roomName: ag.name,
          hostAvatar: resolveAgencyImage(ag.id, roomId, ag.logo),
          isLive: true,
          isAgencyRoom: true,
          isFavorite: false,
        });
      }
      return items;
    };

    const mergeWithOfficial = (items: InterestRoomItem[]): InterestRoomItem[] => {
      const official = buildOfficialItems();
      const seen = new Set<string>();
      const merged: InterestRoomItem[] = [];
      for (const item of [...official, ...items]) {
        if (seen.has(item.roomId)) continue;
        seen.add(item.roomId);
        merged.push(item);
      }
      return merged.slice(0, 5);
    };

    const agencyFavorites = favoriteInterestRooms.filter(isAgencyInterest);
    if (agencyFavorites.length > 0) {
      return mergeWithOfficial(
        agencyFavorites.slice(0, 5).map((r) => ({
          roomId: r.roomId,
          roomName: r.roomName,
          hostAvatar: resolveAgencyImage(r.agencyId, r.roomId, r.hostAvatar),
          isLive: r.isLive,
          isAgencyRoom: true,
          isFavorite: true,
        })),
      );
    }
    const recent = recentInterestRooms
      .filter(isAgencyInterest)
      .slice(0, 5)
      .map((r) => ({
        roomId: r.roomId,
        roomName: r.roomName,
        hostAvatar: resolveAgencyImage(r.agencyId, r.roomId, r.hostAvatar),
        isLive: r.isLive,
        isAgencyRoom: true,
        isFavorite: false,
        lastVisit: r.lastVisit,
      }));
    if (recent.length > 0) return mergeWithOfficial(recent);

    return buildOfficialItems();
  }, [favoriteInterestRooms, recentInterestRooms, agencies, rooms, user?.profile?.country]);

  const interestsFromFavorites = favoriteInterestRooms.some(isAgencyInterest);

  useEffect(() => {
    if (!user?.uid) {
      setFavoriteInterestRooms([]);
      setRecentInterestRooms([]);
      return;
    }
    const unsubFav = subscribeToFavoriteRoomsLive(setFavoriteInterestRooms);
    const unsubRecent = subscribeToRecentRoomsLive(setRecentInterestRooms, 12);
    return () => {
      unsubFav();
      unsubRecent();
    };
  }, [user?.uid, reloadTick]);

  const filteredAgencies = useMemo(() => {
    if (country === 'WW') return agencies;
    return agencies.filter((a) => a.country === country);
  }, [agencies, country]);

  const handleCountrySelect = useCallback((code: string) => {
    setCountry(code);
    setShowCountryModal(false);
  }, []);

  const agencyRoomMap = useMemo(() => {
    const map = new Map<string, Room>();
    for (const r of rooms) {
      if (!r.agencyId) continue;
      const existing = map.get(r.agencyId);
      const aud = toSafeInt(r.audienceCount);
      const existingAud = existing ? toSafeInt(existing.audienceCount) : -1;
      if (!existing || isRoomLive(r) || aud > existingAud) {
        map.set(r.agencyId, r);
      }
    }
    for (const a of agencies) {
      if (a.liveRoomId && !map.has(a.id)) {
        const linked = rooms.find((r) => r.id === a.liveRoomId);
        if (linked) map.set(a.id, linked);
      }
    }
    return map;
  }, [rooms, agencies]);

  const displayAgencies = useMemo(() => {
    const list = [...filteredAgencies].sort((a, b) => {
      const roomA = agencyRoomMap.get(a.id);
      const roomB = agencyRoomMap.get(b.id);
      const liveA = roomA && isRoomLive(roomA) ? 1 : 0;
      const liveB = roomB && isRoomLive(roomB) ? 1 : 0;
      if (liveB !== liveA) return liveB - liveA;
      const audA = toSafeInt(roomA?.audienceCount);
      const audB = toSafeInt(roomB?.audienceCount);
      if (audB !== audA) return audB - audA;
      return b.members - a.members;
    });
    return list;
  }, [filteredAgencies, agencyRoomMap]);

  // #29: الغرف الشخصية (عامة + مقفلة) تظهر مع الوكالات — الدخول للمقفلة عبر بوابة كلمة المرور
  const publicPersonalRooms = useMemo(() => {
    const visible = rooms.filter((r) => {
      if (!isPersonalHostRoom(r)) return false;
      if (country !== 'WW' && r.country !== country) return false;
      return true;
    });
    return visible.sort((a, b) => {
      const liveA = isRoomLive(a) ? 1 : 0;
      const liveB = isRoomLive(b) ? 1 : 0;
      if (liveB !== liveA) return liveB - liveA;
      const audA = toSafeInt(a.audienceCount);
      const audB = toSafeInt(b.audienceCount);
      if (audB !== audA) return audB - audA;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  }, [rooms, country]);

  const listLoading = loading || agenciesLoading;
  const listData = useMemo((): RoomsListEntry[] => {
    if (listLoading) return [];
    return [
      ...displayAgencies.map((agency): RoomsListEntry => ({ kind: 'agency', agency })),
      ...publicPersonalRooms.map((room): RoomsListEntry => ({ kind: 'room', room })),
    ];
  }, [listLoading, displayAgencies, publicPersonalRooms]);

  const agencyLiveRoomIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ag of displayAgencies) {
      const room = agencyRoomMap.get(ag.id);
      const roomId = room?.id ?? ag.liveRoomId;
      if (roomId) ids.add(roomId);
    }
    return [...ids];
  }, [displayAgencies, agencyRoomMap]);

  const presenceByRoomId = useAgencyRoomsPresence(agencyLiveRoomIds);

  const agencyLiveRoomIdsKey = useMemo(
    () => agencyLiveRoomIds.slice().sort().join(','),
    [agencyLiveRoomIds],
  );

  useEffect(() => {
    if (!agencyLiveRoomIdsKey) {
      setLuckyBagByRoomId({});
      return;
    }
    const roomIds = agencyLiveRoomIdsKey.split(',');
    return subscribeToRoomsLuckyBagActive(roomIds, setLuckyBagByRoomId);
  }, [agencyLiveRoomIdsKey]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadTick((t) => t + 1);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleOpenCreateRoom = async () => {
    if (!user) {
      Alert.alert(t('rooms.loginRequired'), t('rooms.loginToCreate'));
      return;
    }
    if (creatingRoom) return;
    setCreatingRoom(true);
    try {
      const roomId = await quickCreateRoom();
      router.replace(`/room/${roomId}` as any);
    } catch (e: any) {
      Alert.alert(t('rooms.createFailed'), e?.message ?? t('common.errorOccurred'));
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleAgencyPress = useCallback(
    async (agencyId: string) => {
      if (!user) {
        Alert.alert(t('rooms.loginRequired'), t('agencyApply.loginToEnter'));
        return;
      }
      try {
        await enterAgencyRoomAndNavigate(router, agencyId);
      } catch (e: any) {
        Alert.alert(t('room.actionFailed'), e?.message ?? t('common.error'));
      }
    },
    [router, t, user],
  );

  const handlePersonalRoomPress = useCallback(
    (room: Room) => {
      if (!user) {
        Alert.alert(t('rooms.loginRequired'), t('agencyApply.loginToEnter'));
        return;
      }
      // navigateToRoom يحترم بوابة كلمة المرور لو تغيّر وضع الغرفة
      void navigateToRoom(router, room.id);
    },
    [router, t, user],
  );

  const renderAgencyItem = useCallback(
    ({ item, index }: { item: RoomsListEntry; index: number }) => {
      const cardW = agencyViewMode === 'grid' ? roomColW : W - pad * 2;
      const wrapStyle =
        agencyViewMode === 'grid'
          ? {
              width: roomColW,
              marginBottom: roomGap,
              marginEnd: index % 2 === 0 ? roomGap / 2 : 0,
              marginStart: index % 2 === 1 ? roomGap / 2 : 0,
            }
          : { width: cardW, marginBottom: 0 };

      if (item.kind === 'room') {
        return (
          <View style={wrapStyle}>
            <PersonalRoomCard
              room={item.room}
              dark={isDark}
              onPress={() => handlePersonalRoomPress(item.room)}
            />
          </View>
        );
      }

      const agency = item.agency;
      const frameUrl = resolveAgencyCardFrameUrl(agency, agencyFrames);
      const room = agencyRoomMap.get(agency.id);
      const roomId = room?.id ?? agency.liveRoomId;
      const presence = roomId ? presenceByRoomId[roomId] : undefined;
      const hasActiveLuckyBag = roomId ? !!luckyBagByRoomId[roomId] : false;
      return (
        <View style={wrapStyle}>
          <AgencyRoomCard
            agency={agency}
            room={room}
            width={cardW}
            dark={isDark}
            layout={agencyViewMode}
            supportPercent={resolveAgencySupportPercent(agency, levelsConfig)}
            frameUrl={frameUrl}
            hasActiveLuckyBag={hasActiveLuckyBag}
            presence={presence}
            onPress={() => handleAgencyPress(agency.id)}
          />
        </View>
      );
    },
    [
      roomColW,
      roomGap,
      agencyRoomMap,
      levelsConfig,
      handleAgencyPress,
      handlePersonalRoomPress,
      agencyViewMode,
      agencyFrames,
      luckyBagByRoomId,
      presenceByRoomId,
      W,
      pad,
      isDark,
    ],
  );

  const listEmpty = listLoading ? (
    <View style={styles.emptyState}>
      <ActivityIndicator size="large" color={isDark ? '#FF5C6C' : lu.colors.purple} />
      <Text
        variant="caption"
        color={isDark ? lu.colors.nightMuted : lu.colors.muted}
        style={{ marginTop: spacing.base }}
      >
        {t('rooms.loadingAgencies')}
      </Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Building2 size={48} color={isDark ? lu.colors.nightMuted : lu.colors.muted} strokeWidth={1.5} />
      <Text
        variant="body"
        weight="semibold"
        color={isDark ? lu.colors.nightInk2 : lu.colors.ink2}
        style={{ marginTop: spacing.base }}
      >
        {country !== 'WW' ? t('rooms.noCountryAgencies') : t('rooms.noAgencies')}
      </Text>
    </View>
  );

  const listHeader = useMemo(
    () => (
    // هامش سالب يلغي حشوة قائمة FlashList — لتطابق حواف الأقسام مع بقية الصفحات.
    <View style={{ marginHorizontal: -pad }}>
      <TabScreenHeader dark={isDark} pad={pad} style={{ marginBottom: 6 }}>
        <HeaderIconButton dark={isDark} onPress={handleOpenCreateRoom}>
          {creatingRoom ? (
            <ActivityIndicator size="small" color={isDark ? '#FF5C6C' : lu.colors.purple} />
          ) : (
            <Plus
              size={headerMetrics.iconSize}
              color={isDark ? '#FF6B7A' : lu.colors.ink}
              strokeWidth={2.5}
            />
          )}
        </HeaderIconButton>
        <HeaderIconButton dark={isDark} onPress={() => router.push('/games' as any)}>
          <Gamepad2
            size={headerMetrics.iconSize}
            color={isDark ? '#C9A6FF' : lu.colors.ink}
            strokeWidth={2}
          />
        </HeaderIconButton>
        <HeaderIconButton dark={isDark} onPress={() => router.push('/search' as any)}>
          {isDark ? (
            <Search size={headerMetrics.iconSize} color="#fff" strokeWidth={2.2} />
          ) : (
            <DesignIcon xml={SearchSvg} size={headerMetrics.iconSize} />
          )}
        </HeaderIconButton>
        <HeaderIconButton dark={isDark} badge onPress={() => router.push('/notifications' as any)}>
          {isDark ? (
            <Bell size={headerMetrics.iconSize} color="#fff" strokeWidth={2.2} />
          ) : (
            <DesignIcon xml={BellSvg} size={headerMetrics.iconSize} />
          )}
        </HeaderIconButton>
      </TabScreenHeader>

        {displayedInterestRooms.length > 0 && (
          <>
            <View style={[styles.sectionHead, { paddingHorizontal: pad }]}>
              <View>
                <RoomSectionTitle dark={isDark}>{t('rooms.interests')}</RoomSectionTitle>
                {!interestsFromFavorites && user?.uid ? (
                  <RNText style={[styles.interestHint, isDark && { color: lu.colors.nightMuted }]}>{t('rooms.interestRecentHint')}</RNText>
                ) : null}
              </View>
              <Pressable onPress={() => router.push('/agencies' as any)}>
                <RNText style={[styles.viewAllText, isDark && { color: '#FF5C6C' }]}>{t('common.viewAll')}</RNText>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.interestsGrid, { paddingHorizontal: pad }]}
            >
              {displayedInterestRooms.map((item) => (
                <InterestRoomCard
                  key={item.roomId}
                  dark={isDark}
                  name={roomDisplayTitle(
                    // لا نفبرك hostName من اسم الروم — كان يكرر الاسم القديم (b10)
                    { name: item.roomName } as Room,
                    t,
                  )}
                  avatar={item.hostAvatar}
                  grad={pickGrad(item.roomId)}
                  isLive={item.isLive}
                  isAgency={!!item.isAgencyRoom}
                  isFavorite={item.isFavorite}
                  metaLabel={
                    item.isLive
                      ? t('rooms.interestLive')
                      : item.lastVisit
                        ? formatRecent(item.lastVisit, t)
                        : t('rooms.recently')
                  }
                  onPress={() => router.push(`/room/${item.roomId}` as any)}
                />
              ))}
            </ScrollView>
          </>
        )}

        <View style={[styles.sectionHead, { paddingHorizontal: pad, marginTop: 4 }]}>
          <View style={styles.sectionTitleRow}>
            {/* #2: التبويب «الغرف» — وكالات + غرف شخصية عامة مدموجة */}
            <RoomSectionTitle dark={isDark}>{t('rooms.title')}</RoomSectionTitle>
            <Crown size={16} color="#F0C75A" fill="#F0C75A" strokeWidth={0} />
          </View>
          <Pressable onPress={() => router.push('/agencies' as any)}>
            <RNText style={[styles.viewAllText, isDark && { color: '#FF5C6C' }]}>{t('common.viewAll')}</RNText>
          </Pressable>
        </View>

        <View style={[styles.agencyToolbar, { paddingHorizontal: pad }]}>
          <CountryGlobeTrigger
            dark={isDark}
            countryCode={country}
            onPress={() => setShowCountryModal(true)}
          />

          {country !== 'WW' ? (
            <Pressable
              onPress={() => setCountry('WW')}
              style={[styles.toolbarShowAllChip, isDark && styles.toolbarShowAllChipDark]}
            >
              <RNText style={[styles.toolbarShowAllText, isDark && { color: '#FF5C6C' }]}>{t('rooms.showAll')}</RNText>
            </Pressable>
          ) : null}

          <View style={{ flex: 1 }} />

          {/* مبدّل العرض شبكة/قائمة — زران بحالة نشطة متوهجة كما في التصميم المرجعي. */}
          <View style={[styles.viewToggleWrap, isDark && styles.viewToggleWrapDark]}>
            {([
              ['grid', LayoutGrid],
              ['list', List],
            ] as const).map(([mode, ToggleIcon]) => {
              const active = agencyViewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setAgencyViewMode(mode)}
                  style={({ pressed }) => [
                    styles.viewToggleBtn,
                    active && (isDark ? styles.viewToggleBtnActiveDark : styles.viewToggleBtnActive),
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <ToggleIcon
                    size={16}
                    color={
                      active
                        ? isDark ? '#FF5C6C' : '#E11414'
                        : isDark ? 'rgba(255,255,255,0.55)' : lu.colors.ink2
                    }
                    strokeWidth={2.3}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

      <View style={{ height: 8 }} />
    </View>
    ),
    [
      pad,
      headerMetrics.iconSize,
      creatingRoom,
      t,
      displayedInterestRooms,
      interestsFromFavorites,
      user?.uid,
      router,
      country,
      setCountry,
      setShowCountryModal,
      agencyViewMode,
      i18n.language,
      isDark,
    ],
  );

  return (
    <LinearGradient
      colors={isDark ? ([...lu.gradients.pageHomeNight] as [string, string, ...string[]]) : PAGE_GRAD}
      locations={PAGE_GRAD_LOC}
      style={styles.container}
    >
      <CountryFilterPopover
        visible={showCountryModal}
        currentCode={country}
        onSelect={handleCountrySelect}
        onClose={() => setShowCountryModal(false)}
      />
      <FlashList
        data={listData}
        extraData={`${i18n.language}-${agencyViewMode}`}
        keyExtractor={(item) =>
          item.kind === 'agency' ? item.agency.id : `room-${item.room.id}`
        }
        renderItem={renderAgencyItem}
        numColumns={agencyViewMode === 'grid' ? 2 : 1}
        estimatedItemSize={agencyViewMode === 'grid' ? 300 : 120}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 96,
          paddingHorizontal: pad,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
        }
      />
    </LinearGradient>
  );
}

/** بطاقة غرفة شخصية عامة — تُعرض مدموجة مع بطاقات الوكالات في تبويب «الغرف» */
const PersonalRoomCard = React.memo(function PersonalRoomCard({
  room,
  dark,
  onPress,
}: {
  room: Room;
  dark?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const cover = [room.banner, room.background, room.hostAvatar].find(
    (v) => v && v.startsWith('http'),
  );
  const grad = pickGrad(room.id);
  const live = isRoomLive(room);
  const audience = toSafeInt(room.audienceCount);
  const hostInitial = (room.hostName?.trim()?.[0] ?? '?').toUpperCase();
  const isLocked = (room.mode ?? (room.isPrivate ? 'locked' : 'public')) === 'locked';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roomCard,
        dark ? styles.roomCardDark : styles.roomCardLight,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.gridCover, { height: 128 }]}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={cover}
          />
        ) : (
          <LinearGradient
            colors={grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* تعتيم سفلي لوضوح اسم المضيف فوق الغلاف */}
        <LinearGradient
          colors={['transparent', 'rgba(10,4,6,0.62)']}
          start={{ x: 0.5, y: 0.35 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {live ? (
          <View style={[styles.gridLivePill, styles.livePillHot]}>
            <Radio size={9} color="#fff" strokeWidth={3} />
            <RNText style={styles.gridLiveText}>{t('rooms.liveBadge')}</RNText>
          </View>
        ) : null}
        {isLocked ? (
          <View style={styles.gridLockPill}>
            <Lock size={10} color="#fff" strokeWidth={2.5} />
          </View>
        ) : null}
        <View style={styles.gridAudiencePill}>
          <Users size={10} color="#fff" strokeWidth={2.5} />
          <RNText style={styles.gridAudienceText}>{audience}</RNText>
        </View>
        <View style={styles.gridHostRow}>
          <View style={styles.gridHostAvatar}>
            {room.hostAvatar?.startsWith('http') ? (
              <Image
                source={{ uri: room.hostAvatar }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={room.hostAvatar}
              />
            ) : (
              <RNText style={styles.gridHostInitial}>{hostInitial}</RNText>
            )}
          </View>
          <RNText style={styles.gridHostName} numberOfLines={1}>
            {room.hostName}
          </RNText>
        </View>
      </View>
      <View style={styles.gridBody}>
        <RNText
          style={[styles.gridTitle, dark && { color: lu.colors.nightInk }]}
          numberOfLines={2}
        >
          {room.name}
        </RNText>
        <View style={styles.gridFooter}>
          <View style={[styles.roomKindBadge, dark && styles.roomKindBadgeDark]}>
            <Mic2 size={10} color={dark ? '#FF6B7A' : lu.colors.purple} strokeWidth={2.5} />
            <RNText style={[styles.roomKindBadgeText, dark && { color: '#FF6B7A' }]}>
              {isLocked
                ? t('rooms.badgePrivateRoom', 'غرفة خاصة')
                : t('rooms.badgeRoom')}
            </RNText>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const InterestRoomCard = React.memo(function InterestRoomCard({
  name,
  avatar,
  grad,
  isLive,
  isAgency,
  isFavorite,
  metaLabel,
  dark,
  onPress,
}: {
  name: string;
  avatar?: string;
  grad: readonly [string, string];
  isLive: boolean;
  isAgency?: boolean;
  isFavorite?: boolean;
  metaLabel: string;
  dark?: boolean;
  onPress: () => void;
}) {
  const hasAvatar = Boolean(avatar && avatar.startsWith('http'));
  return (
    <View>
      <Pressable onPress={onPress} style={styles.storyContainer}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.storyRingWrap, dark && styles.storyRingWrapDark]}
        >
          <View style={[styles.storyAvatarWrap, dark && { backgroundColor: '#2A171C' }]}>
            {hasAvatar ? (
              <Image
                source={{ uri: avatar }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={avatar}
              />
            ) : isAgency ? (
              <Building2 size={22} color="#fff" strokeWidth={2} />
            ) : (
              <RNText style={styles.storyInitial}>{name.charAt(0).toUpperCase()}</RNText>
            )}
          </View>
          {isFavorite ? (
            <View style={styles.interestFavBadge}>
              <Heart size={8} color="#fff" fill="#fff" strokeWidth={0} />
            </View>
          ) : null}
          {isLive ? (
            <View style={[styles.interestLiveDot, dark && { borderColor: lu.colors.night0 }]} />
          ) : null}
        </LinearGradient>
        <RNText style={[styles.storyName, dark && { color: lu.colors.nightInk }]} numberOfLines={1}>{name}</RNText>
        <View style={styles.storyMeta}>
          {isLive ? (
            <Radio size={9} color="#22C55E" strokeWidth={3} />
          ) : (
            <Mic2 size={9} color={dark ? '#FF5C6C' : '#E11414'} strokeWidth={3} />
          )}
          <RNText style={[styles.storyTime, dark && { color: lu.colors.nightMuted }]}>{metaLabel}</RNText>
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabHidden: { display: 'none' },
  scrollContent: {},
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  globalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4ECEC',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: 130,
  },
  globalChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#9A1414',
    fontFamily: lu.fonts.bodyHeavy,
    flexShrink: 1,
  },
  agencyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
    marginBottom: 10,
  },
  toolbarShowAllChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#F6ECEC',
    borderWidth: 1,
    borderColor: '#EDD9D9',
  },
  toolbarShowAllChipDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: lu.colors.nightLine,
  },
  toolbarShowAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyHeavy,
  },
  // مبدّل شبكة/قائمة.
  viewToggleWrap: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDD3D3',
    borderRadius: 12,
    padding: 3,
  },
  viewToggleWrapDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: lu.colors.nightLine,
  },
  viewToggleBtn: {
    width: 34,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(225,20,20,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225,20,20,0.3)',
  },
  viewToggleBtnActiveDark: {
    backgroundColor: 'rgba(255,45,60,0.14)',
    borderWidth: 1,
    borderColor: '#FF3B55',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 2,
  },
  coinText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D4AF37',
    fontFamily: lu.fonts.bodyBold,
  },
  fab: {
    position: 'absolute',
    right: 18,
    shadowColor: '#E36A6A',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  fabInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.grad,
  },
  recommendSheet: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.9)',
    marginTop: 18,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 480,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 10,
    overflow: 'hidden',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#EFEFF2',
    marginBottom: 10,
  },
  createHeaderBtn: {
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  createHeaderBtnGrad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScroll: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 4,
    paddingBottom: 16,
  },
  tabTextWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabTextIdle: {
    color: lu.colors.muted,
    fontWeight: '700',
    fontSize: 16,
    fontFamily: lu.fonts.bodyBold,
  },
  tabTextActive: {
    color: lu.colors.ink,
    fontWeight: '900',
    fontSize: 18,
    fontFamily: lu.fonts.bodyHeavy,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.purple,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 10,
  },
  viewAllBtn: {
    backgroundColor: 'rgba(225,20,20,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.12)',
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#C0392B',
    fontFamily: lu.fonts.bodyBold,
  },
  interestsGrid: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 4,
    marginBottom: 4,
  },
  storyContainer: {
    alignItems: 'center',
    width: 62,
  },
  storyRingWrap: {
    width: 62,
    height: 62,
    borderRadius: 21,
    padding: 2.5,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  storyRingWrapDark: {
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 9,
    elevation: 5,
  },
  interestFavBadge: {
    position: 'absolute',
    top: 2,
    end: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3340',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  interestLiveDot: {
    position: 'absolute',
    bottom: 4,
    end: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  interestHint: {
    fontSize: 10,
    color: 'rgba(225,20,20,0.65)',
    fontFamily: lu.fonts.body,
    marginTop: 2,
    textAlign: START_TEXT_ALIGN,
  },
  storyAvatarWrap: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: lu.colors.ink2,
    fontFamily: lu.fonts.displayHeavy,
  },
  storyName: {
    color: '#15151A',
    fontWeight: '700',
    fontSize: 11.5,
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
  },
  storyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 1,
  },
  storyTime: {
    color: '#9A9AA5',
    fontSize: 9,
    fontFamily: lu.fonts.body,
  },
  filterToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 99,
    padding: 3,
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  filterToolBtn: {
    width: 32,
    height: 30,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToolBtnActive: {
    backgroundColor: 'rgba(225,20,20,0.1)',
  },
  filterToolDivider: {
    width: 1,
    height: 16,
    backgroundColor: lu.colors.line,
  },
  categoriesScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  categoryChipActive: {
    backgroundColor: lu.colors.purple,
    borderColor: lu.colors.purple,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  categoryChipTextActive: { color: '#fff' },
  roomsList: { gap: 16, paddingBottom: 12 },
  roomRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#E36A6A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 4,
    marginBottom: 6,
  },
  roomRowAvatar: {
    width: 90,
    height: 90,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E36A6A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
  roomRowAvatarAgency: {
    borderWidth: 2.5,
    borderColor: 'rgba(212, 175, 55, 0.65)',
  },
  roomRowAvatarInFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    shadowOpacity: 0,
    elevation: 0,
  },
  roomRowInitial: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    fontFamily: lu.fonts.displayHeavy,
  },
  roomRowBody: { flex: 1, minWidth: 0 },
  roomRowTitle: {
    fontWeight: '900',
    fontSize: 16,
    lineHeight: 22,
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: START_TEXT_ALIGN,
  },
  roomRowHost: {
    fontSize: 13,
    color: lu.colors.muted,
    marginTop: 4,
    fontFamily: lu.fonts.body,
    textAlign: START_TEXT_ALIGN,
  },
  liveAudioWrap: {
    position: 'absolute',
    top: 8,
    end: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  roomKindBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  myHostRoomBanner: {
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  myHostRoomBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(225,20,20,0.08)',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  myHostRoomBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(225, 20, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myHostRoomBannerText: {
    flex: 1,
    alignItems: IS_RTL ? 'flex-end' : 'flex-start',
  },
  myHostRoomTitle: {
    color: lu.colors.purple,
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    letterSpacing: 0.5,
  },
  myHostRoomSubtitle: {
    color: lu.colors.ink,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    marginTop: 2,
  },
  myHostRoomEnterPill: {
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
  },
  myHostRoomEnterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  roomKindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(225, 20, 20, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.15)',
  },
  roomKindBadgeDark: {
    backgroundColor: 'rgba(255,45,60,0.14)',
    borderColor: 'rgba(255,90,110,0.4)',
  },
  // بطاقة الغرفة الشخصية — إبراز أحمر مطابق لبطاقات الاكتشاف واللحظات.
  roomCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  roomCardLight: {
    backgroundColor: '#fff',
    borderColor: 'rgba(225,20,20,0.14)',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  roomCardDark: {
    backgroundColor: lu.colors.nightCard,
    borderColor: 'rgba(255,45,60,0.24)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  livePillHot: {
    backgroundColor: 'rgba(225,20,20,0.9)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  roomKindBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyHeavy,
  },
  myRoomKindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  myRoomKindBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D4AF37',
    fontFamily: lu.fonts.bodyHeavy,
  },
  agencyKindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  agencyKindBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B8860B',
    fontFamily: lu.fonts.bodyHeavy,
  },
  agenciesScroll: { gap: 14, paddingBottom: 4 },
  agencyCard: {
    width: 206,
    height: 124,
    borderRadius: 18,
    overflow: 'hidden',
    flexShrink: 0,
  },
  agencyRankPill: {
    position: 'absolute',
    top: 10,
    end: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 2,
  },
  agencyRankText: {
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
  },
  agencyScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  agencyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 11,
    paddingTop: 18,
  },
  agencyCardName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  agencyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  agencyCardMeta: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    flex: 1,
  },
  agencyEnterBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
  },
  agencyEnterText: {
    fontSize: 11.5,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#7A1414',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 4,
  },
  gridCover: {
    position: 'relative',
    overflow: 'hidden',
  },
  gridLivePill: {
    position: 'absolute',
    top: 10,
    start: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 4, 5,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  gridLiveText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: lu.fonts.bodyHeavy,
  },
  gridLockPill: {
    position: 'absolute',
    top: 10,
    end: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(10, 4, 5,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  gridCatPill: {
    position: 'absolute',
    top: 10,
    start: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  gridCatText: {
    fontSize: 8.5,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gridAudiencePill: {
    position: 'absolute',
    top: 10,
    end: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 4, 5,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  gridAudienceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gridHostRow: {
    position: 'absolute',
    bottom: 10,
    start: 10,
    end: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridHostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridHostInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  gridHostName: {
    flex: 1,
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridMyBadge: {
    position: 'absolute',
    bottom: 36,
    end: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 99,
    padding: 4,
  },
  gridPartyDot: {
    position: 'absolute',
    top: 36,
    start: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 99,
    padding: 4,
  },
  gridBody: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 13,
  },
  gridTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#15151A',
    lineHeight: 19,
    minHeight: 38,
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: START_TEXT_ALIGN,
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  gridCountryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  gridCountry: {
    fontSize: 11,
    color: '#9A9AA5',
    fontWeight: '600',
    fontFamily: lu.fonts.bodyBold,
    flexShrink: 1,
  },
  gridGiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(225,20,20,0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    flexShrink: 0,
  },
  gridGiftText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#E11414',
    fontFamily: lu.fonts.bodyHeavy,
  },
  aceBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    height: 130,
    marginVertical: 14,
    position: 'relative',
  },
  aceGiftIcon: {
    position: 'absolute',
    end: 8,
    bottom: 8,
    opacity: 0.9,
  },
  aceContent: { padding: 18, flex: 1, justifyContent: 'center' },
  aceTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 22,
    fontFamily: lu.fonts.displayHeavy,
  },
  aceSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    marginTop: 4,
    maxWidth: '62%',
    fontFamily: lu.fonts.body,
  },
  aceBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 99,
  },
  aceBtnText: {
    color: lu.colors.purple,
    fontWeight: '800',
    fontSize: 13.5,
    fontFamily: lu.fonts.bodyHeavy,
  },
  followingEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(225,20,20,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 99,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});

