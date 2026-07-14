/**
 * LinkUp App — شاشة الغرف والوكالات بالملف الشخصي
 * تعرض الغرفة الخاصة بالمالك في الأعلى، والتبويبات: انضم، متابعة، ومفضلة
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Headphones,
  Lock,
  ChevronLeft,
  ChevronRight,
  Star,
  Plus,
  Users,
  Compass,
} from 'lucide-react-native';

import { Text, BackButton, RealCountryFlag } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { firestore } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  findMyPrivateHostRoom,
  quickCreateRoom,
  normalizeRoomFromRtdb,
  type Room,
} from '@/services/firebase/rooms';
import {
  subscribeToRecentRoomsLive,
  subscribeToFavoriteRoomsLive,
  RecentRoom,
  FavoriteRoom,
} from '@/services/roomFeatures';
import { getUser, UserDoc } from '@/services/firebase/users';
import { navigateToRoom } from '@/utils/navigateToRoom';
import { resolveDisplayName } from '@/utils/displayName';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';

type TabType = 'joined' | 'following' | 'favorites';

export default function UserRoomsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { userId, tab } = useLocalSearchParams<{ userId?: string; tab?: TabType }>();

  // المعرف الفعلي للمستخدم المستهدف
  const targetUid = userId || currentUser?.uid || '';
  const isMe = targetUid === currentUser?.uid;

  const [targetUser, setTargetUser] = useState<UserDoc | null>(null);
  const [privateRoom, setPrivateRoom] = useState<Room | null>(null);
  const [loadingPrivate, setLoadingPrivate] = useState(true);
  const [creatingPrivate, setCreatingPrivate] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (tab === 'joined' || tab === 'following' || tab === 'favorites') return tab;
    return 'joined';
  });
  const [joinedRooms, setJoinedRooms] = useState<(RecentRoom & { isLive: boolean })[]>([]);
  const [favoriteRooms, setFavoriteRooms] = useState<(FavoriteRoom & { isLive: boolean })[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // 1. جلب بيانات صاحب الملف الشخصي
  useEffect(() => {
    if (!targetUid) return;
    let cancelled = false;
    getUser(targetUid).then((u) => {
      if (!cancelled && u) setTargetUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, [targetUid]);

  // 2. جلب الغرفة الخاصة
  useEffect(() => {
    if (!targetUid) return;
    setLoadingPrivate(true);
    let cancelled = false;

    const loadPrivateRoom = async () => {
      try {
        if (isMe) {
          const room = await findMyPrivateHostRoom();
          if (!cancelled) {
            setPrivateRoom(room);
            setLoadingPrivate(false);
          }
        } else {
          // جلب الغرفة الخاصة للمستخدم الآخر من doc الخاص به
          const docSnap = await getDoc(doc(firestore, 'users', targetUid));
          const privateRoomId = docSnap.data()?.hostPrivateRoomId as string | undefined;
          if (privateRoomId) {
            const { get } = await import('firebase/database');
            const { ref } = await import('firebase/database');
            const { realtimeDb } = await import('@/services/firebase');
            const rsnap = await get(ref(realtimeDb, `rooms/${privateRoomId}`));
            if (rsnap.exists() && !cancelled) {
              setPrivateRoom(normalizeRoomFromRtdb(privateRoomId, rsnap.val()));
            }
          }
          if (!cancelled) setLoadingPrivate(false);
        }
      } catch (e) {
        console.warn('Error loading private room:', e);
        if (!cancelled) setLoadingPrivate(false);
      }
    };

    loadPrivateRoom();
    return () => {
      cancelled = true;
    };
  }, [targetUid, isMe]);

  useEffect(() => {
    if (tab === 'joined' || tab === 'following' || tab === 'favorites') {
      setActiveTab(tab);
    }
  }, [tab]);

  // 3. الاشتراك في القوائم (انضم ومتابعة ومفضلة) — للمستخدم الحالي فقط
  useEffect(() => {
    if (!targetUid || !isMe) {
      setJoinedRooms([]);
      setFavoriteRooms([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);

    let unsub: (() => void) | null = null;

    if (activeTab === 'joined') {
      unsub = subscribeToRecentRoomsLive((rooms) => {
        setJoinedRooms(rooms);
        setLoadingList(false);
      }, 30);
    } else {
      // لكل من المتابعة والمفضلة، نستخدم favoriteRooms كقاعدة بيانات
      unsub = subscribeToFavoriteRoomsLive((rooms) => {
        setFavoriteRooms(rooms);
        setLoadingList(false);
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [targetUid, activeTab, isMe]);

  // 4. إنشاء غرفة خاصة سريعة للمستخدم الحالي
  const handleEnterOrCreatePrivateRoom = async () => {
    if (!isMe) {
      if (privateRoom) {
        // فحص التوفر + بوابة كلمة المرور قبل الدخول — الدفع المباشر لغرفة
        // ميتة كان يفتح شاشة روم حمراء فارغة عالقة
        void navigateToRoom(router, privateRoom.id);
      }
      return;
    }

    if (privateRoom) {
      router.push(`/room/${privateRoom.id}` as any);
      return;
    }

    setCreatingPrivate(true);
    try {
      const roomId = await quickCreateRoom();
      const { get } = await import('firebase/database');
      const { ref } = await import('firebase/database');
      const { realtimeDb } = await import('@/services/firebase');
      const rsnap = await get(ref(realtimeDb, `rooms/${roomId}`));
      if (rsnap.exists()) {
        setPrivateRoom(normalizeRoomFromRtdb(roomId, rsnap.val()));
      }
      router.push(`/room/${roomId}` as any);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'فشل إنشاء الغرفة');
    } finally {
      setCreatingPrivate(false);
    }
  };

  // تصفية الهدايا والمفضلة
  // سنقوم بتقسيم الرومات المفضلة بين تبويبي "متابعة" و "مفضلة"
  // لعرض تصميم متميز، سنعرض رومات الوكالة في "متابعة" والرومات العامة في "مفضلة" أو العكس
  const filteredList = useMemo(() => {
    const source = activeTab === 'joined'
      ? joinedRooms
      : activeTab === 'following'
        ? favoriteRooms.filter((r) => r.isAgencyRoom)
        : favoriteRooms.filter((r) => !r.isAgencyRoom);

    // منع تكرار نفس الروم إذا تكررت السجلات لأي سبب.
    const seen = new Set<string>();
    return source.filter((r) => {
      const roomId = String(r.roomId ?? '').trim();
      if (!roomId || seen.has(roomId)) return false;
      seen.add(roomId);
      return true;
    });
  }, [activeTab, joinedRooms, favoriteRooms]);

  const targetName = resolveDisplayName({
    displayName: targetUser?.displayName,
    email: targetUser?.phoneNumber || undefined,
  }, t('rooms.userFallback'));

  const renderRoomItem = useCallback(({ item }: { item: any }) => {
    const isAgency = item.isAgencyRoom === true || !!item.agencyId;
    const isLive = item.isLive === true;
    const displayImage =
      (isAgency ? item.roomBanner : undefined) ||
      item.roomBanner ||
      item.hostAvatar ||
      'https://picsum.photos/200';

    return (
      <Pressable
        onPress={() => void navigateToRoom(router, String(item.roomId))}
        style={({ pressed }) => [styles.roomRow, pressed && { opacity: 0.85 }]}
      >
        {/* معلومات الغرفة باليسار (نظام RTL) */}
        <View style={styles.roomInfoLeft}>
          <View style={styles.badgeRow}>
            <View style={[styles.categoryTag, isAgency && styles.categoryTagAgency]}>
              <Text style={styles.categoryTagText}>
                {isAgency ? 'وكالة' : 'دردشة'}
              </Text>
            </View>
            <RealCountryFlag countryCode={targetUser?.country || 'WW'} size={14} />
            {/* أُزيل شارة LV: كانت مربوطة بمستوى صاحب الحساب (targetUser) فتظهر نفس
                الرقم على كل الغرف/الوكالات. بيانات القائمة (RecentRoom/FavoriteRoom)
                لا تحمل مستوى الوكالة/الغرفة، فإظهاره مضلِّل. */}
          </View>
          
          <Text style={styles.roomRowName} numberOfLines={1}>
            {item.roomName}
          </Text>
          
          <Text style={styles.roomRowHost} numberOfLines={1}>
            {isAgency ? 'وكيل عام' : `مضيف: ${item.hostName || targetName}`}
          </Text>

          {isLive ? (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Users size={11} color="#10B981" />
              <Text style={styles.liveText}>نشط</Text>
            </View>
          ) : (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>مغلق</Text>
            </View>
          )}
        </View>

        {/* صورة الغرفة باليمين (نظام RTL) */}
        <View style={styles.roomRowImageWrap}>
          <Image
            source={{ uri: displayImage }}
            style={styles.roomRowImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {item.isPrivate && (
            <View style={styles.lockOverlay}>
              <Lock size={12} color="#fff" />
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [targetUser, targetName, router]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <Text style={styles.headerTitle} weight="bold">
          {t('profile.roomsAndAgencies')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* القسم العلوي: الغرفة الخاصة */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} weight="bold">
            {t('profile.roomsAndAgencies')}
          </Text>
          {I18nManager.isRTL ? <ChevronLeft size={20} color={lu.colors.ink} /> : <ChevronRight size={20} color={lu.colors.ink} />}
        </View>

        <Pressable
          onPress={handleEnterOrCreatePrivateRoom}
          disabled={creatingPrivate || loadingPrivate}
          style={({ pressed }) => [styles.privateRoomCard, pressed && { opacity: 0.95 }]}
        >
          {loadingPrivate ? (
            <ActivityIndicator size="small" color={colors.brand.primary} style={{ padding: 20 }} />
          ) : (
            <>
              {/* تفاصيل الغرفة باليسار (RTL) */}
              <View style={styles.privateInfoLeft}>
                <View style={styles.privateBadgeRow}>
                  <LinearGradient
                    colors={['#FBBF24', '#F59E0B']}
                    style={styles.levelBadge}
                  >
                    <Text style={styles.levelBadgeText}>LV{targetUser?.level || 1}</Text>
                  </LinearGradient>
                  <RealCountryFlag countryCode={targetUser?.country || 'WW'} size={14} />
                </View>
                
                <Text style={styles.privateRoomName} weight="bold">
                  {privateRoom ? privateRoom.name : targetName}
                </Text>
                
                <Text style={styles.privateRoomSubtitle}>
                  {privateRoom ? `ID: ${privateRoom.id}` : `@${targetUser?.displayName || 'room'}`}
                </Text>
              </View>

              {/* صورة الغرفة باليمين — القفل يظهر فقط إذا كانت الغرفة مقفلة فعلاً */}
              <View style={styles.privateAvatarWrap}>
                <Image
                  source={{ uri: targetUser?.avatar || 'https://i.pravatar.cc/200' }}
                  style={styles.privateAvatar}
                  contentFit="cover"
                />
                {(!privateRoom ||
                  (privateRoom as any).mode === 'locked' ||
                  (!(privateRoom as any).mode && privateRoom.isPrivate)) ? (
                  <View style={styles.lockBadge}>
                    <Lock size={12} color="#fff" />
                  </View>
                ) : null}
              </View>
            </>
          )}

          {creatingPrivate && (
            <View style={styles.creatingOverlay}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.creatingText}>جاري فتح الغرفة...</Text>
            </View>
          )}
        </Pressable>

        {/* تبويبات التصفح */}
        {isMe ? (
        <View style={styles.tabsContainer}>
          <Pressable
            onPress={() => setActiveTab('joined')}
            style={[styles.tabBtn, activeTab === 'joined' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'joined' && styles.tabTextActive]} weight="semibold">
              {t('profile.roomsTabJoined')}
            </Text>
            {activeTab === 'joined' && <View style={styles.activeLine} />}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('following')}
            style={[styles.tabBtn, activeTab === 'following' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]} weight="semibold">
              {t('profile.myAgencies')}
            </Text>
            {activeTab === 'following' && <View style={styles.activeLine} />}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('favorites')}
            style={[styles.tabBtn, activeTab === 'favorites' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]} weight="semibold">
              {t('rooms.favoriteRooms')}
            </Text>
            {activeTab === 'favorites' && <View style={styles.activeLine} />}
          </Pressable>
        </View>
        ) : null}

        {/* قائمة الرومات */}
        {!isMe ? (
          <View style={styles.emptyList}>
            <Compass size={40} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyText} variant="bodySmall">
              {t('profile.roomsPrivateHint')}
            </Text>
          </View>
        ) : loadingList ? (
          <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 40 }} />
        ) : filteredList.length === 0 ? (
          <View style={styles.emptyList}>
            <Compass size={40} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyText} variant="bodySmall">
              {t('profile.roomsEmptyTab')}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredList.map((item) => (
              <View key={item.roomId}>
                {renderRoomItem({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7E7',
  },
  headerTitle: {
    fontSize: 18,
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  privateRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.md,
    ...shadows.sm,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3E8E8',
    position: 'relative',
    overflow: 'hidden',
  },
  privateInfoLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 10,
  },
  privateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.full,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  privateRoomName: {
    fontSize: 16,
    color: '#15151A',
    marginBottom: 4,
    textAlign: 'left',
  },
  privateRoomSubtitle: {
    fontSize: 12,
    color: '#9A9AA5',
    fontWeight: '600',
  },
  privateAvatarWrap: {
    position: 'relative',
  },
  privateAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: '#FEE2E2',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  creatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7E7',
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    color: '#9A9AA5',
  },
  tabTextActive: {
    color: '#E11414',
    fontFamily: lu.fonts.bodyHeavy,
  },
  activeLine: {
    position: 'absolute',
    bottom: 0,
    width: '40%',
    height: 3,
    backgroundColor: '#06B6D4', // Cyan active bar matching screenshot
    borderRadius: 1.5,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: '#F3E8E8',
  },
  roomInfoLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  categoryTag: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  categoryTagAgency: {
    backgroundColor: '#FEE2E2',
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
  },
  roomRowName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#15151A',
    marginBottom: 4,
    textAlign: 'left',
  },
  roomRowHost: {
    fontSize: 12,
    color: '#5E5E68',
    marginBottom: 6,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: 'bold',
  },
  offlineIndicator: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  offlineText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  roomRowImageWrap: {
    position: 'relative',
  },
  roomRowImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  listWrap: {
    gap: 10,
    paddingBottom: 8,
  },
  emptyText: {
    color: '#9A9AA5',
    textAlign: 'center',
  },
});
