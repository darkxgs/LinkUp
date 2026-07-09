/**
 * LinkUp App — شاشة البحث
 * غرف · أشخاص · ID
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import {
  Search as SearchIcon,
  X,
  Users,
  Home,
  Crown,
  Hash,
} from 'lucide-react-native';

import { Text, BackButton, RealCountryFlag } from '@/components/ui';
import { AgencyRoomTrackingAvatar } from '@/components/chat/AgencyRoomTrackingAvatar';
import { useAgencyRoomTracking } from '@/hooks/useAgencyRoomTracking';
import { getDiscoverUsers, searchUsers, UserDoc } from '@/services/firebase/users';
import { subscribeToRooms, findRoomByCode, type Room } from '@/services/firebase/rooms';
import { isTrackableAgencyPresence } from '@/services/roomFeatures';
import { firestore } from '@/services/firebase';
import { resolveUserIdentifier, getDisplayAccountId } from '@/services/userIdentifier';
import { colors, radius, spacing, shadows } from '@/theme';

type SearchTab = 'all' | 'users' | 'rooms' | 'id';

const SEARCH_TABS: { id: SearchTab; labelKey: string }[] = [
  { id: 'all', labelKey: 'store.categories.all' },
  { id: 'users', labelKey: 'search.users' },
  { id: 'rooms', labelKey: 'search.rooms' },
  { id: 'id', labelKey: 'search.byId' },
];

function matchesQuery(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isIdLikeQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^[a-zA-Z0-9]{20,}$/.test(trimmed)) return true;
  const digits = normalizeDigits(trimmed);
  return digits.length >= 4;
}

/** تطابق كود/معرّف الغرفة — تطابق تام أو لاحقة فقط (لا includes فارغ) */
function matchRoomByCode(room: Room, trimmed: string, digits: string): boolean {
  if (room.id === trimmed) return true;
  if (room.vanityId && (room.vanityId === trimmed || (digits && room.vanityId === digits))) {
    return true;
  }
  if (room.agencyId && (room.agencyId === trimmed || (digits && room.agencyId === digits))) {
    return true;
  }
  if (room.id.endsWith(trimmed)) return true;
  if (digits && digits.length >= 4 && room.id.endsWith(digits)) return true;
  return false;
}

function findRoomByIdentifier(rooms: Room[], trimmed: string): Room | null {
  const digits = normalizeDigits(trimmed);
  return (
    rooms.find((r) => r.id === trimmed)
    ?? rooms.find((r) => matchRoomByCode(r, trimmed, digits))
    ?? null
  );
}

function filterRoomsForSearch(rooms: Room[], rawQuery: string, tab: SearchTab): Room[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const digits = normalizeDigits(trimmed);
  const codeSearch = tab === 'rooms' || tab === 'id' || isIdLikeQuery(trimmed);

  if (codeSearch) {
    if (digits.length > 0 && digits.length < 4 && tab === 'rooms') return [];
    return rooms.filter((room) => matchRoomByCode(room, trimmed, digits));
  }

  return rooms.filter(
    (room) =>
      matchesQuery(room.name, trimmed)
      || matchesQuery(room.hostName, trimmed)
      || matchesQuery(room.category, trimmed),
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [suggestedUsers, setSuggestedUsers] = useState<UserDoc[]>([]);
  const [userResults, setUserResults] = useState<UserDoc[]>([]);
  const [idUser, setIdUser] = useState<UserDoc | null>(null);
  const [idRoom, setIdRoom] = useState<Room | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [fetchedCodeRoom, setFetchedCodeRoom] = useState<Room | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { users } = await getDiscoverUsers({}, 8);
        if (!cancelled) setSuggestedUsers(users);
      } catch (e) {
        console.error('search suggestions:', e);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToRooms((rooms) => setAllRooms(rooms), 60);
    return unsub;
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUserResults([]);
      setIdUser(null);
      setIdRoom(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const runIdLookup = activeTab === 'id' || activeTab === 'all';
        if (runIdLookup && isIdLikeQuery(trimmed)) {
          const uid = await resolveUserIdentifier(trimmed);
          if (uid) {
            const snap = await getDoc(doc(firestore, 'users', uid));
            setIdUser(
              snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserDoc) : null,
            );
          } else {
            setIdUser(null);
          }

          let roomMatch = findRoomByIdentifier(allRooms, trimmed);
          if (!roomMatch && isIdLikeQuery(trimmed)) {
            roomMatch = await findRoomByCode(trimmed);
          }
          setIdRoom(roomMatch);
        } else {
          setIdUser(null);
          setIdRoom(null);
        }

        if (activeTab === 'all' || activeTab === 'users') {
          const users = await searchUsers(trimmed);
          setUserResults(users);
        } else {
          setUserResults([]);
        }
      } catch (e) {
        console.error('search:', e);
        setUserResults([]);
        setIdUser(null);
        setIdRoom(null);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, activeTab, allRooms]);

  const localFilteredRooms = useMemo(
    () => filterRoomsForSearch(allRooms, query, activeTab),
    [allRooms, query, activeTab],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setFetchedCodeRoom(null);
      return;
    }
    const codeSearch = activeTab === 'rooms' || activeTab === 'id' || isIdLikeQuery(trimmed);
    if (!codeSearch || localFilteredRooms.length > 0) {
      setFetchedCodeRoom(null);
      return;
    }
    let cancelled = false;
    void findRoomByCode(trimmed).then((room) => {
      if (!cancelled) setFetchedCodeRoom(room);
    });
    return () => {
      cancelled = true;
    };
  }, [query, activeTab, localFilteredRooms.length]);

  const filteredRooms = useMemo(() => {
    if (localFilteredRooms.length > 0) return localFilteredRooms;
    return fetchedCodeRoom ? [fetchedCodeRoom] : [];
  }, [localFilteredRooms, fetchedCodeRoom]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const showUsers = activeTab === 'all' || activeTab === 'users';
  const showRooms = activeTab === 'all' || activeTab === 'rooms';
  const showId = activeTab === 'all' || activeTab === 'id';
  const idLookupActive = isSearching && showId && isIdLikeQuery(trimmedQuery);

  const placeholder =
    activeTab === 'id'
      ? t('search.idPlaceholder')
      : t('search.placeholder');

  const visibleUserUids = useMemo(() => {
    const uids = new Set<string>();
    for (const user of suggestedUsers) uids.add(user.uid);
    for (const user of userResults) uids.add(user.uid);
    if (idUser) uids.add(idUser.uid);
    return [...uids];
  }, [suggestedUsers, userResults, idUser]);

  const { isInRoom, getMemberRoom } = useAgencyRoomTracking(visibleUserUids);

  const handleAvatarTrackPress = useCallback((uid: string) => {
    const presence = getMemberRoom(uid);
    if (!isTrackableAgencyPresence(presence) || !presence?.currentRoomId) return;
    router.push(`/room/${presence.currentRoomId}` as any);
  }, [getMemberRoom, router]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FECACA', '#F89A9A']}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <BackButton />
          <View style={styles.searchBar}>
            <SearchIcon size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="search"
              keyboardType={activeTab === 'id' ? 'number-pad' : 'default'}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <X size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabsRow}>
        {SEARCH_TABS.map((tab) => (
          <Tab
            key={tab.id}
            label={t(tab.labelKey)}
            isActive={activeTab === tab.id}
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isSearching ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={16} color="#E11414" strokeWidth={2.5} />
              <Text variant="bodySmall" weight="bold">
                {t('search.suggestedPeople')}
              </Text>
            </View>
            {loadingSuggestions ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : suggestedUsers.length === 0 ? (
              <Text variant="caption" color={colors.text.secondary} align="center" style={styles.emptyHint}>
                {t('search.noResults')}
              </Text>
            ) : (
              suggestedUsers.map((user) => (
                <UserRow
                  key={user.uid}
                  user={user}
                  followersLabel={t('profile.followers')}
                  showAgencyMusic={isInRoom(user.uid)}
                  onAvatarPress={handleAvatarTrackPress}
                  onPress={() => router.push(`/profile/${user.uid}` as any)}
                />
              ))
            )}
          </View>
        ) : searching ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : (
          <>
            {showId && idLookupActive ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Hash size={16} color="#E11414" strokeWidth={2.5} />
                  <Text variant="bodySmall" weight="bold">
                    {t('search.byId')}
                  </Text>
                </View>
                {!idUser && !idRoom ? (
                  <Text variant="caption" color={colors.text.secondary} align="center" style={styles.emptyHint}>
                    {t('search.idNotFound')}
                  </Text>
                ) : null}
                {idUser ? (
                  <UserRow
                    user={idUser}
                    followersLabel={t('profile.followers')}
                    accountId={getDisplayAccountId(idUser.publicAccountId, idUser.uid)}
                    showAgencyMusic={isInRoom(idUser.uid)}
                    onAvatarPress={handleAvatarTrackPress}
                    onPress={() => router.push(`/profile/${idUser.uid}` as any)}
                  />
                ) : null}
                {idRoom ? (
                  <RoomRow
                    room={idRoom}
                    onPress={() => router.push(`/room/${idRoom.id}` as any)}
                  />
                ) : null}
              </View>
            ) : null}

            {activeTab === 'id' && !idLookupActive ? (
              <Text variant="caption" color={colors.text.secondary} align="center" style={styles.emptyHint}>
                {t('search.idHint')}
              </Text>
            ) : null}

            {showUsers ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Users size={16} color="#E11414" strokeWidth={2.5} />
                  <Text variant="bodySmall" weight="bold">
                    {t('search.users')} ({userResults.length})
                  </Text>
                </View>
                {userResults.length === 0 ? (
                  activeTab === 'users' || (activeTab === 'all' && !idUser) ? (
                    <Text variant="caption" color={colors.text.secondary} align="center" style={styles.emptyHint}>
                      {t('search.noResults')}
                    </Text>
                  ) : null
                ) : (
                  userResults.map((user) => (
                    <UserRow
                      key={user.uid}
                      user={user}
                      followersLabel={t('profile.followers')}
                      accountId={getDisplayAccountId(user.publicAccountId, user.uid)}
                      showAgencyMusic={isInRoom(user.uid)}
                      onAvatarPress={handleAvatarTrackPress}
                      onPress={() => router.push(`/profile/${user.uid}` as any)}
                    />
                  ))
                )}
              </View>
            ) : null}

            {showRooms ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Home size={16} color="#C61414" strokeWidth={2.5} />
                  <Text variant="bodySmall" weight="bold">
                    {t('search.rooms')} ({filteredRooms.length})
                  </Text>
                </View>
                {filteredRooms.length === 0 ? (
                  <Text variant="caption" color={colors.text.secondary} align="center" style={styles.emptyHint}>
                    {t('search.noResults')}
                  </Text>
                ) : (
                  filteredRooms.map((room) => (
                    <RoomRow
                      key={room.id}
                      room={room}
                      onPress={() => router.push(`/room/${room.id}` as any)}
                    />
                  ))
                )}
              </View>
            ) : null}

            {activeTab === 'all'
              && !idUser
              && !idRoom
              && userResults.length === 0
              && filteredRooms.length === 0 ? (
                <Text variant="bodySmall" color={colors.text.secondary} align="center" style={styles.emptyHint}>
                  {t('search.noResults')}
                </Text>
              ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const Tab: React.FC<{ label: string; isActive: boolean; onPress: () => void }> = ({
  label,
  isActive,
  onPress,
}) => (
  <Pressable onPress={onPress} style={[styles.tab, isActive && styles.tabActive]}>
    <Text
      variant="bodySmall"
      weight={isActive ? 'bold' : 'medium'}
      color={isActive ? '#E11414' : '#5C5C64'}
    >
      {label}
    </Text>
    {isActive ? <View style={styles.tabIndicator} /> : null}
  </Pressable>
);

const UserRow: React.FC<{
  user: UserDoc;
  followersLabel: string;
  accountId?: string;
  showAgencyMusic?: boolean;
  onAvatarPress?: (uid: string) => void;
  onPress: () => void;
}> = ({
  user,
  followersLabel,
  accountId,
  showAgencyMusic,
  onAvatarPress,
  onPress,
}) => {
  const avSize = 48;

  const avatarNode = (
    <AgencyRoomTrackingAvatar size={avSize} active={!!showAgencyMusic}>
      <Image
        source={{ uri: user.avatar }}
        style={styles.userAvatar}
        contentFit="cover"
      />
    </AgencyRoomTrackingAvatar>
  );

  return (
    <Pressable onPress={onPress} style={styles.userRow}>
      {showAgencyMusic && onAvatarPress ? (
        <Pressable
          onPress={() => onAvatarPress(user.uid)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={user.displayName ?? user.uid}
        >
          {avatarNode}
        </Pressable>
      ) : (
        avatarNode
      )}
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {user.displayName}
          </Text>
          {user.isVIP ? (
            <View style={styles.vipBadge}>
              <Crown size={9} color={colors.white} fill={colors.white} strokeWidth={0} />
            </View>
          ) : null}
        </View>
        <Text variant="caption" color={colors.text.secondary}>
          {accountId ? `ID ${accountId}` : `${user.followers} ${followersLabel}`}
        </Text>
      </View>
      <RealCountryFlag countryCode={user.country} size={20} />
      <View style={styles.levelChip}>
        <Text variant="caption" color={colors.white} weight="bold" style={styles.levelText}>
          Lv{user.level}
        </Text>
      </View>
    </Pressable>
  );
};

const RoomRow: React.FC<{ room: Room; onPress: () => void }> = ({ room, onPress }) => {
  const displayId = room.vanityId || room.agencyId || room.id.slice(-7);
  return (
    <Pressable onPress={onPress} style={styles.userRow}>
      <Image
        source={{ uri: room.hostAvatar }}
        style={styles.userAvatar}
        contentFit="cover"
      />
      <View style={styles.userInfo}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {room.name}
        </Text>
        <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
          ID {displayId} · {room.hostName}
        </Text>
      </View>
      <RealCountryFlag countryCode={room.country} size={20} />
      <View style={[styles.roomLiveChip, !room.isActive && { backgroundColor: '#9CA3AF' }]}>
        <Text variant="caption" color={colors.white} weight="bold" style={styles.levelText}>
          {room.isActive ? 'LIVE' : 'OFF'}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },

  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    padding: 0,
  },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    gap: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  tabActive: {},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#E11414',
    borderRadius: 2,
  },

  scrollContent: {
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
  },

  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBEAEA',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vipBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChip: {
    backgroundColor: '#E11414',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  roomLiveChip: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  levelText: {
    fontSize: 10,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyHint: {
    padding: spacing.xl,
  },
});
