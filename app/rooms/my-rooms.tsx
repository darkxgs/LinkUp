/**
 * شاشة "غرفي" — تجمع:
 *  - الرومات المفضّلة (live من Firestore + حالة active من RTDB)
 *  - آخر الرومات اللي زرتها (recent)
 *  - إشعارات دخول المتابَعين
 *
 * الـ tabs الثلاثة تستخدم نفس البنية لكن مصدر مختلف.
 */

import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { IMG } from '@/utils/imageConfig';
import { Heart, Clock, Bell, Radio, Trash2, Volume2 } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  subscribeToFavoriteRoomsLive,
  unfavoriteRoom,
  getMyRecentRooms,
  subscribeToRoomEntryNotifications,
  type FavoriteRoom,
  type RecentRoom,
} from '@/services/roomFeatures';
import { colors, radius, spacing, shadows } from '@/theme';

type Tab = 'favorites' | 'recent' | 'notifications';

export default function MyRoomsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [tab, setTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<(FavoriteRoom & { isLive: boolean })[]>([]);
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubFav = subscribeToFavoriteRoomsLive(setFavorites);
    const unsubNotif = subscribeToRoomEntryNotifications(setNotifications);
    return () => {
      unsubFav?.();
      unsubNotif?.();
    };
  }, [user?.uid]);

  const loadRecent = async () => {
    if (!user?.uid) return;
    const list = await getMyRecentRooms(20);
    setRecent(list);
    setLoading(false);
  };

  useEffect(() => {
    loadRecent();
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecent();
    setRefreshing(false);
  };

  const handleUnfavorite = useCallback((room: FavoriteRoom) => {
    showAlert({
      type: 'warning',
      title: t('rooms.text52023'),
      message: `لن تتلقى إشعاراً عند فتح "${room.roomName}" مرة أخرى`,
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.unfollow'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unfavoriteRoom(room.roomId);
            } catch (e: any) {
              showAlert({ type: 'error', title: t('roomSettings.text32386'), message: e?.message ?? t('room.actionFailed') });
            }
          },
        },
      ],
    });
  }, [showAlert, t]);

  const goToRoom = useCallback((roomId: string) => {
    router.push(`/room/${roomId}` as any);
  }, [router]);

  // بناء عناصر التبويب النشط فقط — قائمة افتراضية واحدة بدل رسم الكل في ScrollView
  const listData = useMemo<RowItem[]>(() => {
    if (tab === 'favorites') {
      return favorites.map((r) => ({
        key: r.roomId,
        title: r.roomName,
        subtitle: r.hostName ? `المضيف: ${r.hostName}` : '',
        avatar: r.hostAvatar,
        isLive: r.isLive,
        roomId: r.roomId,
        removable: r,
      }));
    }
    if (tab === 'recent') {
      return recent.map((r) => ({
        key: r.roomId,
        title: r.roomName,
        subtitle: `آخر زيارة: ${formatTimeAgo(r.lastVisit)}`,
        roomId: r.roomId,
      }));
    }
    return notifications.map((n) => ({
      key: n.id,
      title: `${n.fromName} دخل غرفة`,
      subtitle: `"${n.roomName}" • ${formatTimeAgo(n.createdAt)}`,
      avatar: n.fromAvatar,
      unread: !n.seen,
      roomId: n.roomId,
    }));
  }, [tab, favorites, recent, notifications]);

  const renderItem = useCallback(({ item }: { item: RowItem }) => (
    <RoomRow
      title={item.title}
      subtitle={item.subtitle}
      avatar={item.avatar}
      isLive={item.isLive}
      unread={item.unread}
      roomId={item.roomId}
      removable={item.removable}
      onPress={goToRoom}
      onRemove={handleUnfavorite}
    />
  ), [goToRoom, handleUnfavorite]);

  const emptyEl = useMemo(() => {
    if (tab === 'favorites') return <EmptyState icon={<Heart size={42} color="rgba(255,255,255,0.4)" />} title={t('rooms.text14532')} subtitle={t('rooms.text69039')} />;
    if (tab === 'recent') return <EmptyState icon={<Clock size={42} color="rgba(255,255,255,0.4)" />} title={t('rooms.text78282')} subtitle={t('rooms.text1420')} />;
    return <EmptyState icon={<Bell size={42} color="rgba(255,255,255,0.4)" />} title={t('notifications.noNotifications')} subtitle={t('rooms.text12639')} />;
  }, [tab, t]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#26090C', '#3A0A0A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={22} color="#fff" />
        </Pressable>
        <Text variant="h3" color="#fff" weight="bold">
          {t('rooms.myRooms')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabBtn
          icon={<Heart size={16} color="#fff" fill={tab === 'favorites' ? '#E11414' : 'transparent'} />}
          label={t('rooms.text33772')}
          active={tab === 'favorites'}
          onPress={() => setTab('favorites')}
          count={favorites.length}
        />
        <TabBtn
          icon={<Clock size={16} color="#fff" />}
          label={t('rooms.text7043')}
          active={tab === 'recent'}
          onPress={() => setTab('recent')}
          count={recent.length}
        />
        <TabBtn
          icon={<Bell size={16} color="#fff" />}
          label={t('rooms.text20945')}
          active={tab === 'notifications'}
          onPress={() => setTab('notifications')}
          count={notifications.filter((n) => !n.seen).length}
        />
      </View>

      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={emptyEl}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}

type RowItem = {
  key: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  isLive?: boolean;
  unread?: boolean;
  roomId: string;
  removable?: FavoriteRoom;
};

const keyExtractor = (item: RowItem) => item.key;

// ===== Helper Components =====
function TabBtn({
  icon,
  label,
  active,
  onPress,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  count: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      {icon}
      <Text variant="caption" color="#fff" weight={active ? 'bold' : 'regular'}>
        {label}
      </Text>
      {count > 0 && (
        <View style={styles.tabCount}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const RoomRow = memo(function RoomRow({
  title,
  subtitle,
  avatar,
  isLive,
  unread,
  roomId,
  removable,
  onPress,
  onRemove,
}: {
  title: string;
  subtitle?: string;
  avatar?: string;
  isLive?: boolean;
  unread?: boolean;
  roomId: string;
  removable?: FavoriteRoom;
  onPress: (roomId: string) => void;
  onRemove: (room: FavoriteRoom) => void;
}) {
  return (
    <Pressable onPress={() => onPress(roomId)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }, unread && styles.rowUnread]}>
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} recyclingKey={avatar} {...IMG} />
        ) : (
          <LinearGradient colors={['#E11414', '#C40E1E']} style={styles.avatar}>
            <Radio size={18} color="#fff" />
          </LinearGradient>
        )}
        {isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.livePulse} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="button" color="#fff" weight="bold" numberOfLines={1}>
            {title}
          </Text>
          {isLive && (
            <View style={styles.liveTag}>
              <Volume2 size={9} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>LIVE</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text variant="caption" color="rgba(255,255,255,0.65)" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {removable && (
        <Pressable onPress={() => onRemove(removable)} style={styles.removeBtn}>
          <Trash2 size={16} color="#EF4444" />
        </Pressable>
      )}
    </Pressable>
  );
});

const EmptyState = memo(function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text variant="h4" color="#fff" weight="bold" style={{ marginTop: 12 }}>
        {title}
      </Text>
      <Text variant="caption" color="rgba(255,255,255,0.6)" align="center" style={{ marginTop: 6 }}>
        {subtitle}
      </Text>
    </View>
  );
});

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'الآن';
  if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} دقيقة`;
  if (diff < 86_400_000) return `قبل ${Math.floor(diff / 3_600_000)} ساعة`;
  return new Date(ts).toLocaleDateString('ar');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#26090C' },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(225, 20, 20,0.35)',
    borderWidth: 1,
    borderColor: '#E11414',
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  rowUnread: {
    backgroundColor: 'rgba(225, 20, 20,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.3)',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#26090C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
});
