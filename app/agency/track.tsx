/**
 * تتبع أعضاء الوكالة — رؤية حالة كل عضو (متصل/غير متصل) + الغرفة الحالية
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Search,
  Users,
  X,
  Radio,
  Circle,
  Eye,
} from 'lucide-react-native';
import { ChevronRight, ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import {
  subscribeToMyAgency,
  subscribeToAgencyMembers,
  type Agency,
  type AgencyMember,
} from '@/services/agencyService';
import {
  subscribeToBatchPresence,
  type UserPresence,
} from '@/services/roomFeatures';
import { isUserOnline } from '@/utils/presence';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

type Filter = 'all' | 'online' | 'inRoom' | 'offline';

export default function AgencyTrackScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAr = i18n.language?.startsWith('ar') === true;

  const [agency, setAgency] = useState<Agency | null>(null);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence | null>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return subscribeToMyAgency(setAgency);
  }, []);

  useEffect(() => {
    if (!agency) return;
    return subscribeToAgencyMembers(agency.id, setMembers);
  }, [agency?.id]);

  useEffect(() => {
    const uids = members.map((m) => m.uid);
    if (uids.length === 0) return;
    return subscribeToBatchPresence(uids, setPresenceMap);
  }, [members.map((m) => m.uid).join(',')]);

  const enriched = useMemo(() => {
    return members.map((m) => {
      const presence = presenceMap[m.uid] ?? null;
      const inRoom = Boolean(presence?.currentRoomId);
      const online = inRoom; // if in a room, they're online
      return { ...m, presence, online, inRoom };
    });
  }, [members, presenceMap]);

  const stats = useMemo(() => {
    let online = 0;
    let inRoom = 0;
    for (const e of enriched) {
      if (e.online) online++;
      if (e.inRoom) inRoom++;
    }
    return { total: enriched.length, online, inRoom, offline: enriched.length - online };
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'online') list = list.filter((e) => e.online);
    else if (filter === 'inRoom') list = list.filter((e) => e.inRoom);
    else if (filter === 'offline') list = list.filter((e) => !e.online);

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (m) => m.uidName.toLowerCase().includes(term) || m.uid.toLowerCase().includes(term),
      );
    }

    return list.sort((a, b) => {
      if (a.inRoom && !b.inRoom) return -1;
      if (!a.inRoom && b.inRoom) return 1;
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return 0;
    });
  }, [enriched, filter, search]);

  const handleGoToRoom = useCallback(
    (roomId: string) => {
      router.push(`/room/${roomId}` as any);
    },
    [router],
  );

  const handleGoToProfile = useCallback(
    (uid: string) => {
      router.push(`/profile/${uid}` as any);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof enriched)[0] }) => (
      <MemberTrackRow
        member={item}
        isAr={isAr}
        onRoomPress={handleGoToRoom}
        onProfilePress={handleGoToProfile}
      />
    ),
    [isAr, handleGoToRoom, handleGoToProfile],
  );

  const keyExtractor = useCallback((m: AgencyMember) => m.id, []);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: isAr ? 'الكل' : 'All', count: stats.total },
    { key: 'online', label: isAr ? 'متصل' : 'Online', count: stats.online },
    { key: 'inRoom', label: isAr ? 'في غرفة' : 'In Room', count: stats.inRoom },
    { key: 'offline', label: isAr ? 'غير متصل' : 'Offline', count: stats.offline },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A0A0C', '#2D0C0C', '#1A0A0C']}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronRight size={20} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Eye size={18} color={lu.colors.pink} />
            <Text variant="h3" color="#fff" weight="bold">
              {isAr ? 'تتبع الأعضاء' : 'Track Members'}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>{isAr ? 'إجمالي' : 'Total'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4ADE80' }]}>{stats.online}</Text>
            <Text style={styles.statLabel}>{isAr ? 'متصل' : 'Online'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: lu.colors.pink }]}>{stats.inRoom}</Text>
            <Text style={styles.statLabel}>{isAr ? 'في غرفة' : 'In Room'}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label} ({f.count})
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Search size={15} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isAr ? 'ابحث عن عضو...' : 'Search member...'}
            placeholderTextColor="#9CA3AF"
            style={[styles.searchInput, { textAlign: isAr ? 'right' : 'left' }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        initialNumToRender={15}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(false)}
            tintColor={lu.colors.pink}
          />
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color="#4B5563" />
            <Text variant="button" color="#9CA3AF" align="center" style={{ marginTop: 12 }}>
              {search
                ? (isAr ? 'لا توجد نتائج' : 'No results')
                : (isAr ? 'لا يوجد أعضاء' : 'No members')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const MemberTrackRow = React.memo(function MemberTrackRow({
  member,
  isAr,
  onRoomPress,
  onProfilePress,
}: {
  member: {
    id: string;
    uid: string;
    uidName: string;
    uidAvatar: string;
    online: boolean;
    inRoom: boolean;
    presence: UserPresence | null;
    pearlsEarned: number;
  };
  isAr: boolean;
  onRoomPress: (roomId: string) => void;
  onProfilePress: (uid: string) => void;
}) {
  return (
    <View style={rowStyles.container}>
      <Pressable onPress={() => onProfilePress(member.uid)} style={rowStyles.avatarWrap}>
        {member.uidAvatar ? (
          <Image
            source={{ uri: member.uidAvatar }}
            style={rowStyles.avatar}
            cachePolicy="memory-disk"
            recyclingKey={member.id}
          />
        ) : (
          <View style={[rowStyles.avatar, rowStyles.avatarFallback]}>
            <Users size={18} color="#6B7280" />
          </View>
        )}
        <View
          style={[
            rowStyles.statusDot,
            member.inRoom
              ? rowStyles.dotInRoom
              : member.online
                ? rowStyles.dotOnline
                : rowStyles.dotOffline,
          ]}
        />
      </Pressable>

      <Pressable onPress={() => onProfilePress(member.uid)} style={rowStyles.infoCol}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {member.uidName}
        </Text>
        {member.inRoom && member.presence ? (
          <View style={rowStyles.roomTag}>
            <Radio size={10} color={lu.colors.pink} />
            <Text style={rowStyles.roomName} numberOfLines={1}>
              {member.presence.roomName || (isAr ? 'غرفة' : 'Room')}
            </Text>
          </View>
        ) : member.online ? (
          <Text style={rowStyles.statusOnline}>
            {isAr ? 'متصل الآن' : 'Online now'}
          </Text>
        ) : (
          <Text style={rowStyles.statusOffline}>
            {isAr ? 'غير متصل' : 'Offline'}
          </Text>
        )}
      </Pressable>

      <View style={rowStyles.earningsCol}>
        <Text style={rowStyles.earnings}>
          {(member.pearlsEarned ?? 0).toLocaleString()}
        </Text>
        <Text style={rowStyles.earningsLabel}>{isAr ? 'ماسة' : 'Pearls'}</Text>
      </View>

      {member.inRoom && member.presence?.currentRoomId ? (
        <Pressable
          onPress={() => onRoomPress(member.presence!.currentRoomId)}
          style={rowStyles.joinBtn}
        >
          <Text style={rowStyles.joinBtnText}>{isAr ? 'دخول' : 'Join'}</Text>
          <ChevronLeft size={12} color="#fff" />
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  hero: { paddingBottom: 16 },
  header: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: lu.fonts.displayHeavy,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: lu.fonts.body,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: lu.colors.pink,
    borderColor: lu.colors.pink,
  },
  filterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: lu.fonts.body,
  },
  filterTextActive: {
    color: '#fff',
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
  },
  empty: {
    padding: 60,
    alignItems: 'center',
  },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0F0F0F',
  },
  dotOnline: {
    backgroundColor: '#4ADE80',
  },
  dotInRoom: {
    backgroundColor: lu.colors.pink,
  },
  dotOffline: {
    backgroundColor: '#6B7280',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: lu.fonts.bodyBold,
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(225, 20, 20, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  roomName: {
    color: lu.colors.pink,
    fontSize: 11,
    fontFamily: lu.fonts.body,
    maxWidth: 120,
  },
  statusOnline: {
    color: '#4ADE80',
    fontSize: 11,
    fontFamily: lu.fonts.body,
  },
  statusOffline: {
    color: '#6B7280',
    fontSize: 11,
    fontFamily: lu.fonts.body,
  },
  earningsCol: {
    alignItems: 'center',
    minWidth: 50,
  },
  earnings: {
    color: lu.colors.gold,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: lu.fonts.bodySemi,
  },
  earningsLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: lu.fonts.body,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: lu.colors.pink,
    minWidth: 60,
    justifyContent: 'center',
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
});
