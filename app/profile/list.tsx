/**
 * LinkUp App — قائمة المتابعين / يتابع / الزوار
 * تستخدم بيانات Firebase الحقيقية
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Users, Crown, UserPlus, UserCheck, UserMinus } from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { Text, BackButton, RealCountryFlag } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { getUsers, UserDoc } from '@/services/firebase/users';
import {
  subscribeToFollowUserIds,
  subscribeToMyFollowingIds,
  isFollowing,
  toggleFollow,
  removeFollower,
  reconcileSocialCounts,
} from '@/services/firebase/follow';
import { subscribeProfileVisitors } from '@/services/firebase/profileVisitors';
import { resolveDisplayName } from '@/utils/displayName';
import { colors, radius, spacing, shadows } from '@/theme';

type ListType = 'followers' | 'following' | 'visitors';

const LIST_LABELS: Record<ListType, string> = {
  followers: i18n.t('profile.myFollowers'),
  following: i18n.t('profile.text12996'),
  visitors: i18n.t('profile.myVisitors'),
};

export default function ProfileListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { type = 'followers', userId } = useLocalSearchParams<{ type: ListType; userId: string }>();

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const visibleUsers = useMemo(() => {
    if (!currentUser?.uid) return users;
    return users.filter((u) => u.uid !== currentUser.uid);
  }, [users, currentUser?.uid]);

  const isOwnProfile = Boolean(currentUser?.uid && userId === currentUser.uid);
  const isOwnFollowersList = isOwnProfile && type === 'followers';

  useEffect(() => {
    if (!userId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    if (type === 'visitors') {
      setLoading(true);
      const unsub = subscribeProfileVisitors(userId, (visits) => {
        const mapped: UserDoc[] = visits.map((v) => ({
          uid: v.visitorUid,
          phoneNumber: '',
          displayName: v.displayName,
          avatar: v.avatar,
          gender: 'female' as const,
          birthYear: 2000,
          country: v.country,
          coins: 0,
          pearls: 0,
          casinoCoins: 0,
          level: v.level,
          xp: 0,
          followers: 0,
          following: 0,
          visitors: 0,
          totalRoomsCreated: 0,
          isVIP: v.isVIP,
          createdAt: v.visitedAt,
        }));
        setUsers(mapped);
        setLoading(false);
      });
      return () => unsub();
    }

    if (isOwnProfile) {
      void reconcileSocialCounts(userId).catch(() => {});
    }

    setLoading(true);
    let cancelled = false;
    const unsub = subscribeToFollowUserIds(userId, type as 'followers' | 'following', async (ids) => {
      try {
        const map = await getUsers(ids);
        if (cancelled) return;
        const ordered = ids
          .map((id) => map.get(id))
          .filter((u): u is UserDoc => u != null);
        setUsers(ordered);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [type, userId, isOwnProfile]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setFollowingSet(new Set());
      return;
    }
    return subscribeToMyFollowingIds(currentUser.uid, setFollowingSet);
  }, [currentUser?.uid]);

  const handleRemoveFollower = async (uid: string) => {
    if (!currentUser?.uid || busyUid === uid || !isOwnFollowersList) return;
    setBusyUid(uid);
    try {
      await removeFollower(uid);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch {
      // ignore — reconcile on next load fixes drift
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleFollow = async (uid: string) => {
    if (!currentUser?.uid || busyUid === uid) return;
    const previous = followingSet.has(uid);
    setBusyUid(uid);
    setFollowingSet((prev) => {
      const next = new Set(prev);
      if (previous) next.delete(uid);
      else next.add(uid);
      return next;
    });
    try {
      const nextState = await toggleFollow(uid);
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (nextState) next.add(uid);
        else next.delete(uid);
        return next;
      });
      if (!nextState && type === 'following' && userId === currentUser.uid) {
        setUsers((prev) => prev.filter((u) => u.uid !== uid));
      }
    } catch {
      try {
        const real = await isFollowing(uid);
        setFollowingSet((prev) => {
          const next = new Set(prev);
          if (real) next.add(uid);
          else next.delete(uid);
          return next;
        });
      } catch {
        setFollowingSet((prev) => {
          const next = new Set(prev);
          if (previous) next.add(uid);
          else next.delete(uid);
          return next;
        });
      }
    } finally {
      setBusyUid(null);
    }
  };

  const renderItem = useCallback(
    ({ item: u }: { item: UserDoc }) => (
      <UserRow
        u={u}
        isFollowing={followingSet.has(u.uid)}
        busy={busyUid === u.uid}
        showRemoveFollower={isOwnFollowersList}
        onOpen={() => router.push(`/profile/${u.uid}` as any)}
        onToggle={() => void handleToggleFollow(u.uid)}
        onRemove={() => void handleRemoveFollower(u.uid)}
        followLabel={t('profile.follow')}
        followingLabel={t('profile.followingState')}
        removeLabel={t('common.remove')}
      />
    ),
    [followingSet, busyUid, router, t, isOwnFollowersList],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FECACA', '#F89A9A']}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <BackButton />
          <View style={styles.titleRow}>
            <Users size={20} color="#E11414" strokeWidth={2.5} />
            <Text variant="h2" weight="bold">
              {LIST_LABELS[type as ListType]}
            </Text>
            <Text variant="caption" color={colors.text.secondary}>
              ({visibleUsers.length})
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleUsers}
          keyExtractor={(u) => u.uid}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Users size={48} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text variant="body" color={colors.text.secondary} style={{ marginTop: spacing.base }}>
                {t('profile.text86551')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const UserRow = React.memo(function UserRow({
  u,
  isFollowing,
  busy,
  showRemoveFollower,
  onOpen,
  onToggle,
  onRemove,
  followLabel,
  followingLabel,
  removeLabel,
}: {
  u: UserDoc;
  isFollowing: boolean;
  busy: boolean;
  showRemoveFollower?: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onRemove: () => void;
  followLabel: string;
  followingLabel: string;
  removeLabel: string;
}) {
  const displayName = resolveDisplayName({
    displayName: u.displayName,
    email: u.email,
  });
  return (
    <Pressable onPress={onOpen} style={styles.userRow}>
      <Image
        source={{ uri: u.avatar }}
        style={styles.avatar}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={u.uid}
        transition={150}
      />
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {displayName}
          </Text>
          <RealCountryFlag countryCode={u.country} size={14} />
          {u.isVIP && (
            <View style={styles.vipBadge}>
              <Crown size={9} color={colors.white} fill={colors.white} strokeWidth={0} />
            </View>
          )}
        </View>
        <Text variant="caption" color={colors.text.secondary}>
          المستوى {u.level} • {u.followers} متابع
        </Text>
      </View>
      {showRemoveFollower ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={busy}
          style={[styles.followBtn, styles.removeFollowerBtn]}
        >
          <UserMinus size={14} color="#EF4444" strokeWidth={2.5} />
          <Text variant="caption" color="#EF4444" weight="bold">
            {busy ? '...' : removeLabel}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          disabled={busy}
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
        >
          {isFollowing ? (
            <>
              <UserCheck size={14} color="#10B981" strokeWidth={2.5} />
              <Text variant="caption" color="#10B981" weight="bold">
                {followingLabel}
              </Text>
            </>
          ) : (
            <>
              <UserPlus size={14} color={colors.white} strokeWidth={2.5} />
              <Text variant="caption" color={colors.white} weight="bold">
                {busy ? '...' : followLabel}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </Pressable>
  );
});

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
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scrollContent: {
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBEAEA',
  },
  nameRow: {
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
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F26161',
    borderRadius: radius.full,
  },
  followBtnActive: {
    backgroundColor: '#D1FAE5',
  },
  removeFollowerBtn: {
    backgroundColor: '#FEE2E2',
  },
});
