/**
 * Chat List — تصميم LinkUp الجديد
 * Source: test (2)/app/screens/chat.jsx
 * يحافظ على subscribeToConversations من Firestore.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  LuSearchIcon,
  LuSettingsIcon,
  LuGiftIcon,
  LuSparkleIcon,
  LuUserIcon,
  LuNotificationIcon,
  LuCoinIcon,
} from '@/components/icons/LuDesignIcons';
import { LuFeedbackIcon } from '@/components/icons/LuProfileIcons';
import { LuTabChatIcon } from '@/components/icons/LuTabIcons';
import {
  TabScreenHeader,
  HeaderIconButton,
  useTabHeaderMetrics,
} from '@/components/layout/TabScreenHeader';
import { Pin } from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';

import {
  subscribeToConversations,
  togglePinConversation,
  archiveConversation,
  hideConversationForUser,
  conversationHasThreadActivity,
  type Conversation,
} from '@/services/firebase/chat';
import { getChatFriendUids } from '@/services/firebase/chatFriends';
import { subscribeToMyAgencyChats, ensureMyAgencyChat, type AgencyChatMeta } from '@/services/firebase/agencyChat';
import { getUser, getUsers, type UserDoc } from '@/services/firebase/users';
import { subscribeToNotifications } from '@/services/firebase/notifications';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/components/ui';
import {
  SUPPORT_UID,
  sendOfficialWelcomeIfNeeded,
  resolveOfficialChatDisplayName,
  type OfficialAccountUid,
} from '@/services/supportAccount';
import { LinkUpSupportAvatar } from '@/components/support/LinkUpSupportAvatar';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveUserDocAvatar, resolveConversationPeerAvatar } from '@/utils/userAvatar';
import { useConfig } from '@/contexts/ConfigContext';
import { useAgencyRoomTracking } from '@/hooks/useAgencyRoomTracking';
import { HomeGamesHub } from '@/components/home/HomeGamesHub';
import { AgencyRoomTrackingAvatar } from '@/components/chat/AgencyRoomTrackingAvatar';
import { QuickClearChatsModal } from '@/components/chat/QuickClearChatsModal';
import { isTrackableAgencyPresence } from '@/services/roomFeatures';
import { navigateToRoom } from '@/utils/navigateToRoom';

const PAGE_BG = ['#FBEAEA', '#FBF1F1', '#F8F6F7'] as const;
const PAGE_BG_NIGHT = lu.gradients.pageHomeNight;
const PAGE_BG_LOCATIONS: readonly [number, number, number] = [0, 0.5, 1];

const CHAT_SHORTCUTS = [
  {
    id: 'recharge',
    route: '/wallet/recharge' as const,
    Icon: LuCoinIcon,
    iconFilled: false,
    colors: ['rgba(255, 248, 238, 0.65)', 'rgba(255, 239, 214, 0.55)'] as const,
    iconColor: '#F59E0B',
    badge: 'promo' as const,
    labelAr: 'المحفظة',
    labelEn: 'Wallet',
  },
  {
    id: 'gifts',
    route: '/gifts' as const,
    Icon: LuGiftIcon,
    iconFilled: true,
    colors: ['rgba(255, 238, 240, 0.65)', 'rgba(255, 228, 232, 0.55)'] as const,
    iconColor: '#FF3340',
    badge: null,
    labelAr: 'المكافآت',
    labelEn: 'Rewards',
  },
  {
    id: 'feedback',
    officialUid: SUPPORT_UID,
    Icon: LuFeedbackIcon,
    iconFilled: false,
    colors: ['rgba(253, 239, 239, 0.65)', 'rgba(252, 223, 223, 0.55)'] as const,
    iconColor: '#EC3E3E',
    badge: null,
    labelAr: 'الدعم',
    labelEn: 'Support',
  },
] as const;

const SHORTCUT_ICONS: Record<string, any> = {
  recharge: require('../../assets/images/chat_sc_wallet.png'),
  gifts: require('../../assets/images/chat_sc_reward.png'),
  feedback: require('../../assets/images/chat_sc_support.png'),
};

type HeaderTab = 'chat' | 'friends';

const FALLBACK_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#F0A0A0', '#FBD5D5'],
  ['#FFB199', '#FF7A8A'],
  ['#E36A6A', '#B00E0E'],
  ['#FF5C7A', '#E02B2B'],
  ['#FFD86F', '#FF9A2E'],
  ['#2BD9A8', '#22C58A'],
];

const ONLINE_MS = 2 * 60 * 1000;

type ChatFilterMode = 'all' | 'friends' | 'unread' | 'online' | 'pinned' | 'archived';

function gradFor(uid: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length]!;
}

function isUserOnline(lastSeen?: number): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen < ONLINE_MS;
}

function formatChatTime(ts: number, t: (key: string, opts?: any) => string, lang: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60) return i18n.t('time.minutesAgo', { count: mins });
  if (hours < 24) return i18n.t('time.hoursAgo', { count: hours });
  if (days < 7) return i18n.t('time.daysAgo', { count: days });
  return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en');
}

export default function ChatListScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { settings } = useConfig();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user: currentUser } = useAuth();
  const isSmall = W < 360;
  const pad = isSmall ? 14 : 16;
  const headerMetrics = useTabHeaderMetrics(W);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agencyChats, setAgencyChats] = useState<AgencyChatMeta[]>([]);
  const [friends, setFriends] = useState<UserDoc[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ChatFilterMode>('all');
  const [headerTab, setHeaderTab] = useState<HeaderTab>('chat');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const { showAlert, showActionSheet } = useAlert();
  const { isDark } = useThemeMode();

  const conversationPeerUids = useMemo(() => {
    const myId = currentUser?.uid;
    if (!myId) return [];
    const peers = new Set<string>();
    for (const conv of conversations) {
      const other = conv.participants.find((p) => p !== myId);
      if (other) peers.add(other);
    }
    for (const f of friends) peers.add(f.uid);
    return [...peers];
  }, [conversations, currentUser?.uid, friends]);

  const { isInRoom, getMemberRoom } = useAgencyRoomTracking(conversationPeerUids);
  const [showQuickClear, setShowQuickClear] = useState(false);
  // وضع التحديد المتعدد — حذف عدة محادثات دفعة واحدة (b20)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [peerProfiles, setPeerProfiles] = useState<Map<string, UserDoc | null>>(new Map());

  const conversationPeerUidsKey = useMemo(
    () => conversationPeerUids.slice().sort().join(','),
    [conversationPeerUids],
  );

  useEffect(() => {
    if (!conversationPeerUidsKey) {
      setPeerProfiles(new Map());
      return;
    }
    let cancelled = false;
    const uids = conversationPeerUidsKey.split(',');
    void getUsers(uids).then((map) => {
      if (!cancelled) setPeerProfiles(map);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationPeerUidsKey]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToConversations((convs) => {
      setConversations(convs);
      setLoading(false);
    });
    const unsubAgency = subscribeToMyAgencyChats(setAgencyChats);
    // يضمن إنشاء/انضمام المستخدم لدردشة وكالته حتى تظهر في القائمة
    ensureMyAgencyChat().catch(() => {});
    return () => { unsub(); unsubAgency(); };
  }, [currentUser?.uid]);

  const loadFriends = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const chatFriends = await getChatFriendUids(currentUser.uid);
      setFriendUids(chatFriends);
      // كل الأصدقاء (كان مقصوصاً على 12 فيختلف العدد عن باقي الشاشات)
      const ids = [...chatFriends].slice(0, 60);
      const users = await Promise.all(ids.map((id) => getUser(id)));
      setFriends(users.filter((u): u is UserDoc => u != null));
    } catch {
      setFriends([]);
      setFriendUids(new Set());
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    const unsub = subscribeToNotifications((items) => {
      setUnreadNotifCount(items.filter((n) => !n.isRead).length);
    });
    return unsub;
  }, []);

  // debounce حقل البحث (~250ms) لتقليل إعادة الفلترة أثناء الكتابة
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFriends();
    if (conversationPeerUids.length) {
      const map = await getUsers(conversationPeerUids);
      setPeerProfiles(map);
    }
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 600);
  }, [loadFriends, conversationPeerUids]);

  const handleTogglePin = useCallback(async (conv: Conversation) => {
    const isPinned = conv.pinnedBy?.[currentUser?.uid ?? ''] === true;
    try {
      await togglePinConversation(conv.id, !isPinned);
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: e?.message ?? t('chat.pinFailed'),
      });
    }
  }, [currentUser?.uid, showAlert, t]);

  const handleArchive = useCallback((conv: Conversation) => {
    const isArchived = conv.archivedBy?.[currentUser?.uid ?? ''] === true;
    showAlert({
      type: 'info',
      title: isArchived ? t('chat.unarchiveChat') : t('chat.archiveChat'),
      message: isArchived ? t('chat.unarchiveChatConfirm') : t('chat.archiveChatConfirm'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isArchived ? t('chat.unarchiveChat') : t('chat.archiveChat'),
          onPress: async () => {
            try {
              await archiveConversation(conv.id, !isArchived);
            } catch (e: any) {
              showAlert({
                type: 'error',
                title: t('common.error'),
                message: e?.message ?? t('chat.archiveFailed'),
              });
            }
          },
        },
      ],
    });
  }, [currentUser?.uid, showAlert, t]);

  const handleShortcutPress = useCallback(
    async (item: (typeof CHAT_SHORTCUTS)[number]) => {
      if ('officialUid' in item && item.officialUid) {
        try {
          await sendOfficialWelcomeIfNeeded(item.officialUid as OfficialAccountUid);
        } catch {
          // نفتح الشات حتى لو فشل الترحيب
        }
        router.push(`/chat/${item.officialUid}` as any);
        return;
      }
      if ('route' in item && item.route) {
        router.push(item.route as any);
      }
    },
    [router],
  );

  const handleDeleteConversation = useCallback((conv: Conversation) => {
    showAlert({
      type: 'warning',
      title: t('chat.deleteChat'),
      message: t('chat.deleteChatConfirm'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setConversations((prev) => prev.filter((c) => c.id !== conv.id));
              await hideConversationForUser(conv.id);
              showAlert({
                type: 'success',
                title: t('common.done'),
                message: t('chat.deleteChatSuccess'),
              });
            } catch (e: any) {
              showAlert({
                type: 'error',
                title: t('common.error'),
                message: e?.message ?? t('chat.deleteChatFailed'),
              });
            }
          },
        },
      ],
    });
  }, [showAlert, t]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedConvIds(new Set());
  }, []);

  const handleToggleSelectConv = useCallback((conv: Conversation) => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      if (next.has(conv.id)) next.delete(conv.id);
      else next.add(conv.id);
      return next;
    });
  }, []);

  /** حذف كل المحادثات المحددة — تحديث متفائل ثم حذف متوازٍ (نفس نمط الحذف الفردي) */
  const handleDeleteSelected = useCallback(() => {
    const ids = [...selectedConvIds];
    if (ids.length === 0) return;
    showAlert({
      type: 'warning',
      title: t('chat.deleteSelectedTitle'),
      message: t('chat.deleteSelectedConfirm', { count: ids.length }),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const idSet = new Set(ids);
            setConversations((prev) => prev.filter((c) => !idSet.has(c.id)));
            exitSelectMode();
            const results = await Promise.allSettled(
              ids.map((id) => hideConversationForUser(id)),
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) {
              showAlert({
                type: 'error',
                title: t('common.error'),
                message: t('chat.deleteSelectedPartialFail', { count: failed }),
              });
            } else {
              showAlert({
                type: 'success',
                title: t('common.done'),
                message: t('chat.deleteChatSuccess'),
              });
            }
          },
        },
      ],
    });
  }, [selectedConvIds, showAlert, t, exitSelectMode]);

  const handleReportConversation = useCallback((conv: Conversation) => {
    const otherUid = conv.participants.find((p) => p !== currentUser?.uid) ?? '';
    if (!otherUid) return;
    router.push(
      `/report?type=user&target=${otherUid}&source=chat` as any,
    );
  }, [currentUser?.uid, router]);

  const handleConversationMenu = useCallback((conv: Conversation) => {
    const uid = currentUser?.uid ?? '';
    const isPinned = conv.pinnedBy?.[uid] === true;
    const isArchived = conv.archivedBy?.[uid] === true;

    showActionSheet({
      title: t('chat.conversationActions'),
      buttons: [
        {
          text: isPinned ? t('chat.unpin') : t('chat.pin'),
          onPress: () => handleTogglePin(conv),
        },
        {
          text: isArchived ? t('chat.unarchiveChat') : t('chat.archiveChat'),
          onPress: () => handleArchive(conv),
        },
        {
          text: t('chat.reportUser'),
          onPress: () => handleReportConversation(conv),
        },
        {
          // دخول وضع التحديد المتعدد مع تحديد هذه المحادثة (b20)
          text: t('chat.multiSelect'),
          onPress: () => {
            setSelectMode(true);
            setSelectedConvIds(new Set([conv.id]));
          },
        },
        {
          text: t('chat.deleteChat'),
          style: 'destructive',
          onPress: () => handleDeleteConversation(conv),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  }, [currentUser?.uid, showActionSheet, t, handleTogglePin, handleArchive, handleReportConversation, handleDeleteConversation]);

  const handleOpenConversation = useCallback((conv: Conversation) => {
    const otherUid =
      conv.participants.find((p) => p !== currentUser?.uid) ?? conv.participants[0];
    router.push(`/chat/${otherUid}` as any);
  }, [currentUser?.uid, router]);

  /** ضغط الصورة — انتقال مباشر لروم الوكالة إن كان نشطاً (بدون فتح الشات) */
  const handleAvatarTrackPress = useCallback((uid: string) => {
    const presence = getMemberRoom(uid);
    if (!isTrackableAgencyPresence(presence) || !presence?.currentRoomId) return;
    void navigateToRoom(router, presence.currentRoomId);
  }, [getMemberRoom, router]);

  const lang = i18n.language;
  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => {
      const otherUid = item.participants.find((p) => p !== currentUser?.uid) ?? '';
      const selected = selectedConvIds.has(item.id);
      return (
      <View style={[styles.whiteSheetContinued, isDark && styles.whiteSheetContinuedDark]}>
        <View>
          <ConversationRow
            conv={item}
            currentUid={currentUser?.uid}
            isSmall={isSmall}
            dark={isDark}
            t={t}
            lang={lang}
            showAgencyMusic={isInRoom(otherUid)}
            onAvatarPress={selectMode ? undefined : handleAvatarTrackPress}
            onTogglePin={selectMode ? handleToggleSelectConv : handleConversationMenu}
            onPress={selectMode ? handleToggleSelectConv : handleOpenConversation}
          />
          {selectMode ? (
            <View pointerEvents="none" style={styles.selectBadgeWrap}>
              <View style={[styles.selectBadge, selected && styles.selectBadgeOn]}>
                {selected ? <Text style={styles.selectBadgeCheck}>✓</Text> : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
      );
    },
    [currentUser?.uid, isSmall, t, lang, isDark, isInRoom, handleAvatarTrackPress, handleConversationMenu, handleOpenConversation, selectMode, selectedConvIds, handleToggleSelectConv],
  );

  const filterCounts = useMemo(() => {
    const uid = currentUser?.uid ?? '';
    const active = conversations.filter(
      (c) => !c.archivedBy?.[uid] && conversationHasThreadActivity(c),
    );
    return {
      // عدد الأصدقاء الكلي (متابعة متبادلة) — نفس مصدر باقي الشاشات،
      // كان يَعُدّ محادثات الأصدقاء فقط فيخالف عدد الأصدقاء بالحساب
      friends: friendUids.size,
      unread: active.reduce((sum, c) => sum + (c.unreadBy?.[uid] ?? 0), 0),
      online: active.filter((c) => c.isOnline).length,
      pinned: active.filter((c) => c.pinnedBy?.[uid] === true).length,
    };
  }, [conversations, currentUser?.uid, friendUids]);

  const filteredConvs = useMemo(() => {
    const uid = currentUser?.uid ?? '';
    let list = conversations.filter((c) => conversationHasThreadActivity(c));

    if (filterMode === 'archived') {
      list = list.filter((c) => c.archivedBy?.[uid] === true);
    } else {
      list = list.filter((c) => !c.archivedBy?.[uid]);
      if (filterMode === 'friends') {
        list = list.filter((c) => {
          const otherUid = c.participants.find((p) => p !== uid) ?? '';
          return otherUid !== '' && friendUids.has(otherUid);
        });
      } else if (filterMode === 'unread') {
        list = list.filter((c) => (c.unreadBy?.[uid] ?? 0) > 0);
      } else if (filterMode === 'online') {
        list = list.filter((c) => c.isOnline === true);
      } else if (filterMode === 'pinned') {
        list = list.filter((c) => c.pinnedBy?.[uid] === true);
      }
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const otherUid = c.participants.find((p) => p !== currentUser?.uid) ?? '';
      const name = (c.participantNames?.[otherUid] ?? '').toLowerCase();
      const last = (c.lastMessage ?? '').toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [conversations, searchQuery, filterMode, currentUser?.uid, friendUids]);

  const showFriendsStrip = filterMode === 'all' || filterMode === 'friends';

  /** أصدقاء (متابعة متبادلة / وكالة) بدون محادثة نشطة */
  const friendsWithoutChat = useMemo(() => {
    const inConvs = new Set<string>();
    for (const c of conversations) {
      const other = c.participants.find((p) => p !== currentUser?.uid);
      if (other) inConvs.add(other);
    }
    return friends.filter((f) => !inConvs.has(f.uid));
  }, [friends, conversations, currentUser?.uid]);

  const listConversations = useMemo(() => {
    const friendByUid = new Map(friends.map((f) => [f.uid, f]));
    const mapped = filteredConvs.map((c) => {
      const otherUid = c.participants.find((p) => p !== currentUser?.uid) ?? '';
      const friend = friendByUid.get(otherUid);
      const peerDoc = peerProfiles.get(otherUid) ?? friend ?? null;
      const avatar = resolveConversationPeerAvatar(
        c,
        otherUid,
        peerDoc as unknown as Record<string, unknown> | undefined,
      );

      const betterName = friend
        ? resolveDisplayName({
            displayName: friend.displayName,
            email: friend.email,
          })
        : '';
      const stored = c.participantNames?.[otherUid] ?? '';
      const storedOk =
        stored.length > 0 && stored !== t('rooms.userFallback') && !stored.includes('@');
      const nextNames =
        !storedOk && betterName && betterName !== t('rooms.userFallback')
          ? { ...c.participantNames, [otherUid]: betterName }
          : c.participantNames;

      return {
        ...c,
        participantNames: nextNames,
        participantAvatars: {
          ...(c.participantAvatars ?? {}),
          [otherUid]: avatar,
        },
      };
    });
    return [...mapped].sort((a, b) => {
      const aSupport = a.participants.includes(SUPPORT_UID) ? 1 : 0;
      const bSupport = b.participants.includes(SUPPORT_UID) ? 1 : 0;
      if (aSupport !== bSupport) return bSupport - aSupport;
      const uid = currentUser?.uid ?? '';
      const aPinned = a.pinnedBy?.[uid] ? 1 : 0;
      const bPinned = b.pinnedBy?.[uid] ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
    });
  }, [filteredConvs, friends, peerProfiles, currentUser?.uid, t]);

  const shortcutGap = isSmall ? 8 : 10;
  const shortcutW =
    (W - pad * 2 - shortcutGap * (CHAT_SHORTCUTS.length - 1)) / CHAT_SHORTCUTS.length;

  return (
    <LinearGradient
      colors={isDark ? PAGE_BG_NIGHT : PAGE_BG}
      locations={PAGE_BG_LOCATIONS}
      style={styles.container}
    >
      <FlatList
        data={listConversations}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 110,
        }}
        renderItem={renderConversation}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        updateCellsBatchingPeriod={60}
        ListHeaderComponent={
          <View>
            {/* ===== الشريط العلوي الموحد (مطابق لصفحة Home) ===== */}
            <TabScreenHeader pad={pad} dark={isDark}>
              <HeaderIconButton dark={isDark} onPress={() => router.push('/search' as any)}>
                <LuSearchIcon size={headerMetrics.iconSize} color={isDark ? '#fff' : lu.colors.ink} />
              </HeaderIconButton>
              <HeaderIconButton
                dark={isDark}
                onPress={() => router.push('/notifications' as any)}
                badge={unreadNotifCount > 0}
              >
                <LuNotificationIcon size={headerMetrics.iconSize} color={isDark ? '#fff' : lu.colors.ink} />
              </HeaderIconButton>
            </TabScreenHeader>

            {/* تبويبات + إعدادات */}
            <View style={[styles.headerRow, { paddingHorizontal: pad + 2, marginTop: 4 }]}>
              <View style={styles.headerTabs}>
                <Pressable
                  onPress={() => {
                    setHeaderTab('chat');
                    if (filterMode === 'friends') setFilterMode('all');
                  }}
                  style={styles.headerTabBtn}
                >
                  <Text
                    style={[
                      styles.headerTabText,
                      isDark && { color: lu.colors.nightMuted },
                      headerTab === 'chat' && (isDark ? styles.headerTabTextActiveDark : styles.headerTabTextActive),
                    ]}
                  >
                    {t('chat.title')}
                  </Text>
                  {headerTab === 'chat' ? (
                    <LinearGradient
                      colors={['#FF4D5E', '#C40E2E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.headerTabUnderline}
                    />
                  ) : (
                    <View style={styles.headerTabUnderlinePlaceholder} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setHeaderTab('friends');
                    setFilterMode('friends');
                  }}
                  style={styles.headerTabBtn}
                >
                  <Text
                    style={[
                      styles.headerTabText,
                      isDark && { color: lu.colors.nightMuted },
                      headerTab === 'friends' && (isDark ? styles.headerTabTextActiveDark : styles.headerTabTextActive),
                    ]}
                  >
                    {t('chat.friends')}
                  </Text>
                  {headerTab === 'friends' ? (
                    <LinearGradient
                      colors={['#FF4D5E', '#C40E2E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.headerTabUnderline}
                    />
                  ) : (
                    <View style={styles.headerTabUnderlinePlaceholder} />
                  )}
                </Pressable>
                <View style={styles.headerSparkle}>
                  <LuSparkleIcon size={11} color={lu.colors.pink} />
                </View>
              </View>
              <CircBtn
                onPress={() => {
                  showActionSheet({
                    title: t('chat.title'),
                    buttons: [
                      {
                        text: t('chat.multiSelect'),
                        onPress: () => setSelectMode(true),
                      },
                      {
                        text: t('chat.quickClearTitle'),
                        onPress: () => setShowQuickClear(true),
                      },
                      {
                        text: t('common.settings'),
                        onPress: () => router.push('/settings' as any),
                      },
                      { text: t('common.cancel'), style: 'cancel' },
                    ],
                  });
                }}
                icon={<LuSettingsIcon size={21} color={isDark ? '#fff' : lu.colors.ink} />}
                badge={false}
                dark={isDark}
              />
            </View>

            {/* بطاقات الاختصار — شحن / إشعارات / مساعد / فيدباك */}
            <View
              style={[
                styles.shortcutsRow,
                { paddingHorizontal: pad, gap: shortcutGap },
              ]}
            >
              {CHAT_SHORTCUTS.map((item, index) => (
                <ChatShortcutTile
                  key={item.id}
                  index={index}
                  width={shortcutW}
                  item={item}
                  dark={isDark}
                  promoLabel={
                    item.id === 'recharge' && settings.inAppRechargeEnabled !== true
                      ? ''
                      : t('chat.storePromo')
                  }
                  onPress={() => handleShortcutPress(item)}
                />
              ))}
            </View>

            <ChatFilterBar
              pad={pad}
              dark={isDark}
              mode={filterMode}
              counts={filterCounts}
              onSelect={(mode) => {
                setFilterMode(mode);
                if (mode === 'friends') setHeaderTab('friends');
                else setHeaderTab('chat');
              }}
            />

            {filterMode !== 'archived' ? (
              <View style={styles.gamesHubWrap}>
                <HomeGamesHub
                  pad={pad}
                  dark={isDark}
                  onNavigate={(route) => router.push(route as any)}
                />
              </View>
            ) : null}

            {/* ورقة بيضاء: الأصدقاء */}
            <View style={[styles.whiteSheet, isDark && styles.whiteSheetDark]}>
              {showFriendsStrip && friendsWithoutChat.length > 0 ? (
                <>
                  <View style={styles.friendsHeader}>
                    <GradientSectionTitle>{t('chat.friends')}</GradientSectionTitle>
                    <Pressable
                      onPress={() =>
                        currentUser?.uid &&
                        router.push(
                          `/profile/list?userId=${currentUser.uid}&type=following` as any,
                        )
                      }
                    >
                      <Text style={[styles.seeAll, isDark && { color: "#FF5C6C" }]}>{t('common.viewAll')}</Text>
                    </Pressable>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.friendsScroll}
                  >
                    {friendsWithoutChat.map((u, i) => (
                      <FriendChip
                        key={u.uid}
                        index={i}
                        user={u}
                        dark={isDark}
                        showAgencyMusic={isInRoom(u.uid)}
                        onAvatarPress={handleAvatarTrackPress}
                        onPress={() => router.push(`/chat/${u.uid}` as any)}
                      />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {/* دردشات الوكالات (لأعضائها فقط) */}
              {agencyChats.length > 0 ? (
                <>
                  {showFriendsStrip && friendsWithoutChat.length > 0 && <View style={[styles.threadListDivider, isDark && styles.threadListDividerDark]} />}
                  {agencyChats.map((ac) => (
                    <AgencyChatRow
                      key={ac.id}
                      chat={ac}
                      dark={isDark}
                      onPress={() => router.push(`/agency/chat?agencyId=${ac.agencyId}` as any)}
                    />
                  ))}
                </>
              ) : null}

              {showFriendsStrip && (friendsWithoutChat.length > 0 || agencyChats.length > 0) && listConversations.length > 0 ? (
                <View style={[styles.threadListDivider, isDark && styles.threadListDividerDark]} />
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={[styles.emptyState, styles.whiteSheetContinued, isDark && styles.whiteSheetContinuedDark]}>
              <ActivityIndicator size="large" color={lu.colors.pink} />
            </View>
          ) : (
            <View style={[styles.emptyState, styles.whiteSheetContinued, isDark && styles.whiteSheetContinuedDark]}>
              <View style={{ marginBottom: 10 }}>
                <LuTabChatIcon size={52} active={false} />
              </View>
              <Text style={[styles.emptyText, isDark && { color: lu.colors.nightInk2 }]}>
                {filterMode === 'archived'
                  ? t('chat.noArchivedChats')
                  : filterMode === 'friends'
                    ? t('chat.noFriendsChats')
                    : filterMode === 'unread'
                    ? t('chat.noUnreadChats')
                    : filterMode === 'online'
                      ? t('chat.noOnlineChats')
                      : filterMode === 'pinned'
                        ? t('chat.noPinnedChats')
                        : t('chat.noConversations')}
              </Text>
              <Text style={[styles.emptySubtitle, isDark && { color: lu.colors.nightMuted }]}>
                {t('chat.startFromDiscover')}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={lu.colors.pink}
            colors={[lu.colors.pink]}
          />
        }
      />

      {/* شريط إجراءات التحديد المتعدد (b20) */}
      {selectMode ? (
        <View style={[styles.selectBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={exitSelectMode} style={styles.selectBarBtn} hitSlop={6}>
            <Text style={styles.selectBarCancel}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.selectBarCount}>
            {t('chat.selectedCount', { count: selectedConvIds.size })}
          </Text>
          <Pressable
            onPress={handleDeleteSelected}
            disabled={selectedConvIds.size === 0}
            style={[
              styles.selectBarBtn,
              styles.selectBarDelete,
              selectedConvIds.size === 0 && { opacity: 0.4 },
            ]}
            hitSlop={6}
          >
            <Text style={styles.selectBarDeleteText}>{t('chat.deleteSelectedAction')}</Text>
          </Pressable>
        </View>
      ) : null}

      <QuickClearChatsModal
        visible={showQuickClear}
        onClose={() => setShowQuickClear(false)}
      />
    </LinearGradient>
  );
}

function ChatShortcutTile({
  index = 0,
  width,
  item,
  promoLabel,
  dark,
  onPress,
}: {
  index?: number;
  width: number;
  item: (typeof CHAT_SHORTCUTS)[number];
  promoLabel: string;
  dark?: boolean;
  onPress: () => void;
}) {
  const { i18n } = useTranslation();
  const showPromo = item.badge === 'promo' && !!promoLabel;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.shortcutTile,
          { width, opacity: pressed ? 0.6 : 1 },
        ]}
      >
      {showPromo ? (
        <View style={styles.shortcutPromoBadge}>
          <Text style={styles.shortcutPromoText}>{promoLabel}</Text>
        </View>
      ) : null}
      <View style={[styles.shortcutRing, !dark && styles.shortcutRingLight]}>
        <Image
          source={SHORTCUT_ICONS[item.id]}
          style={styles.shortcutIconImg}
          contentFit="contain"
        />
      </View>
      <View style={[styles.shortcutLabelPill, !dark && styles.shortcutLabelPillLight]}>
        <Text
          style={[styles.shortcutLabel, dark && { color: '#fff' }]}
          numberOfLines={1}
        >
          {i18n.language?.startsWith('ar') ? item.labelAr : item.labelEn}
        </Text>
      </View>
      </Pressable>
    </Animated.View>
  );
}

function ChatFilterBar({
  pad,
  dark,
  mode,
  counts,
  onSelect,
}: {
  pad: number;
  dark?: boolean;
  mode: ChatFilterMode;
  counts: { friends: number; unread: number; online: number; pinned: number };
  onSelect: (mode: ChatFilterMode) => void;
}) {
  const { t } = useTranslation();

  const chips: {
    id: ChatFilterMode;
    label: string;
    count?: number;
  }[] = [
    { id: 'all', label: t('chat.filterChipAll') },
    { id: 'friends', label: t('chat.filterChipFriends'), count: counts.friends },
    { id: 'unread', label: t('chat.filterChipUnread'), count: counts.unread },
    { id: 'online', label: t('chat.filterChipOnline'), count: counts.online },
    { id: 'pinned', label: t('chat.filterChipPinned'), count: counts.pinned },
    { id: 'archived', label: t('chat.filterChipArchived') },
  ];

  const formatCount = (n: number) => (n > 9999 ? '9999+' : String(n));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.filterBar, { paddingHorizontal: pad }]}
    >
      {chips.map((chip) => {
        const active = mode === chip.id;
        const showCount = chip.count != null && chip.count > 0;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onSelect(chip.id)}
            style={({ pressed }) => [
              styles.filterChip,
              dark && styles.filterChipDark,
              active && (dark ? styles.filterChipActiveDark : styles.filterChipActive),
              pressed && { opacity: 0.9 },
            ]}
          >
            {active && !dark ? (
              <LinearGradient
                colors={['#FF4D66', '#C40E2E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text
              style={[
                styles.filterChipLabel,
                dark && { color: 'rgba(255,255,255,0.68)' },
                active && styles.filterChipLabelActive,
              ]}
              numberOfLines={1}
            >
              {chip.label}
              {showCount ? (
                <Text
                  style={[
                    styles.filterChipCount,
                    dark && { color: '#FF5C6C' },
                    active && styles.filterChipCountActive,
                  ]}
                >
                  {' '}
                  {formatCount(chip.count!)}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function GradientSectionTitle({ children }: { children: string }) {
  return (
    <MaskedView
      maskElement={
        <Text style={[styles.friendsTitle, { color: '#000' }]}>{children}</Text>
      }
    >
      <LinearGradient colors={lu.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[styles.friendsTitle, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function CircBtn({
  icon,
  badge,
  dark,
  onPress,
}: {
  icon: React.ReactNode;
  badge?: boolean;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.circBtn, dark && styles.circBtnDark, pressed && { opacity: 0.9 }]}
    >
      {icon}
      {badge ? <View style={styles.circBadge} /> : null}
    </Pressable>
  );
}

function FriendChip({
  user,
  index = 0,
  dark,
  showAgencyMusic,
  onAvatarPress,
  onPress,
}: {
  user: UserDoc;
  index?: number;
  dark?: boolean;
  showAgencyMusic?: boolean;
  onAvatarPress?: (uid: string) => void;
  onPress: () => void;
}) {
  const online = isUserOnline(user.lastSeen);
  const grad = gradFor(user.uid);
  const initial = (user.displayName ?? '?').trim().charAt(0) || '★';
  const avSize = 52;
  const avatarUri = resolveUserDocAvatar(user as unknown as Record<string, unknown>, user.uid);

  const avatarNode = (
    <View style={[styles.friendAvatarWrap, online && !showAgencyMusic && styles.friendRing]}>
      <AgencyRoomTrackingAvatar size={avSize} active={!!showAgencyMusic}>
        <LinearGradient
          colors={grad}
          style={[
            styles.friendAvatar,
            {
              width: avSize,
              height: avSize,
              borderRadius: showAgencyMusic ? avSize / 2 : 16,
            },
          ]}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={avatarUri}
            />
          ) : (
            <Text style={styles.friendInitial}>{initial}</Text>
          )}
        </LinearGradient>
      </AgencyRoomTrackingAvatar>
    </View>
  );

  return (
    <Animated.View entering={FadeInRight.delay(index * 60).springify()}>
      <Pressable onPress={onPress} style={styles.friendChip}>
        {showAgencyMusic && onAvatarPress ? (
          <Pressable
            onPress={() => onAvatarPress(user.uid)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={resolveDisplayName({ displayName: user.displayName, email: user.email })}
          >
            {avatarNode}
          </Pressable>
        ) : (
          avatarNode
        )}
        <Text style={[styles.friendName, dark && { color: '#fff' }]} numberOfLines={1}>
          {resolveDisplayName({ displayName: user.displayName, email: user.email })}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const ConversationRow = memo(function ConversationRow({
  conv,
  currentUid,
  isSmall,
  t,
  lang,
  dark,
  showAgencyMusic,
  onAvatarPress,
  onPress,
  onTogglePin,
}: {
  conv: Conversation;
  currentUid?: string;
  isSmall: boolean;
  t: (key: string, opts?: any) => string;
  lang: string;
  dark?: boolean;
  showAgencyMusic?: boolean;
  onAvatarPress?: (uid: string) => void;
  onPress: (conv: Conversation) => void;
  onTogglePin: (conv: Conversation) => void;
}) {
  const otherUid = conv.participants.find((p) => p !== currentUid) ?? '';
  const isSupportChat = otherUid === SUPPORT_UID;
  const name = isSupportChat
    ? resolveOfficialChatDisplayName(otherUid) ?? t('support.headerTitle')
    : resolveDisplayName({
      displayName: conv.participantNames?.[otherUid],
    });
  const avatarUri = resolveConversationPeerAvatar(
    conv,
    otherUid,
    undefined,
  );
  // رابط صورة مكسور كان يترك دائرة فارغة بلا حرف — نتذكر الفشل ونعرض الحرف
  const [brokenAvatarUri, setBrokenAvatarUri] = useState<string | null>(null);
  const showAvatarImg = !!avatarUri && brokenAvatarUri !== avatarUri;
  const unread = conv.unreadBy?.[currentUid ?? ''] ?? 0;
  const isPinned = conv.pinnedBy?.[currentUid ?? ''] === true;
  const grad = gradFor(otherUid);
  const initial = (name ?? '?').trim().charAt(0) || '★';
  const avSize = isSmall ? 48 : 52;
  const online = conv.isOnline;

  return (
    <View>
      <Pressable
        onPress={() => onPress(conv)}
        onLongPress={() => onTogglePin(conv)}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.threadRow,
          pressed && { opacity: 0.92 },
        ]}
      >
      {isPinned ? (
        <LinearGradient
          colors={dark
            ? ['rgba(255,45,60,0.1)', 'rgba(255,45,60,0.05)']
            : ['rgba(255, 238, 238, 0.45)', 'rgba(255, 236, 240, 0.45)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {showAgencyMusic && onAvatarPress && !isSupportChat ? (
        <Pressable
          onPress={() => onAvatarPress(otherUid)}
          hitSlop={4}
          style={[styles.threadAvatarWrap, styles.threadAvatarAgency]}
        >
          <AgencyRoomTrackingAvatar size={avSize} active>
            <LinearGradient
              colors={grad}
              style={{
                width: avSize,
                height: avSize,
                borderRadius: avSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {showAvatarImg ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{
                    width: avSize,
                    height: avSize,
                    borderRadius: avSize / 2,
                    position: 'absolute',
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={avatarUri}
                  onError={() => setBrokenAvatarUri(avatarUri)}
                />
              ) : (
                <Text style={[styles.threadAvatarLetter, { fontSize: avSize * 0.4 }]}>
                  {initial}
                </Text>
              )}
            </LinearGradient>
          </AgencyRoomTrackingAvatar>
          {unread > 0 ? (
            <View style={styles.avatarUnreadBadge}>
              <Text style={styles.avatarUnreadText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : (
      <View style={[styles.threadAvatarWrap, showAgencyMusic && styles.threadAvatarAgency]}>
        {isSupportChat ? (
          <LinkUpSupportAvatar size={avSize} />
        ) : (
          <AgencyRoomTrackingAvatar size={avSize} active={!!showAgencyMusic}>
            <LinearGradient
              colors={grad}
              style={{
                width: avSize,
                height: avSize,
                borderRadius: avSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {showAvatarImg ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{
                    width: avSize,
                    height: avSize,
                    borderRadius: avSize / 2,
                    position: 'absolute',
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={avatarUri}
                  onError={() => setBrokenAvatarUri(avatarUri)}
                />
              ) : (
                <Text style={[styles.threadAvatarLetter, { fontSize: avSize * 0.4 }]}>
                  {initial}
                </Text>
              )}
            </LinearGradient>
          </AgencyRoomTrackingAvatar>
        )}
        {unread > 0 ? (
          <View style={styles.avatarUnreadBadge}>
            <Text style={styles.avatarUnreadText}>
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        ) : null}
        {online && !isSupportChat && !showAgencyMusic ? (
          <View style={[styles.onlineIndicatorDot, dark && { borderColor: '#1D1317' }]} />
        ) : null}
      </View>
      )}

      <View style={styles.threadBody}>
        <View style={styles.threadTitleRow}>
          <Text style={[styles.threadName, dark && { color: '#fff' }]} numberOfLines={1}>
            {name}
          </Text>
          {isSupportChat && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓</Text>
            </View>
          )}
          {isPinned ? (
            <Pin size={12} color={lu.colors.gold2} fill={lu.colors.gold2} strokeWidth={0} />
          ) : null}
        </View>
        <Text
          style={[
            styles.threadLast,
            dark && { color: lu.colors.nightMuted },
            unread > 0 && { color: dark ? '#fff' : lu.colors.ink, fontWeight: '700' },
          ]}
          numberOfLines={1}
        >
          {conv.lastMessage || t('chat.startConversation')}
        </Text>
      </View>

      <View style={styles.threadMeta}>
        <Text style={[styles.threadTime, dark && { color: '#FF5C6C' }]}>{formatChatTime(conv.lastMessageAt, t, lang)}</Text>
        </View>
      </Pressable>
    </View>
  );
});

function AgencyChatRow({ chat, dark, onPress }: { chat: AgencyChatMeta; dark?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { width: W } = useWindowDimensions();
  const isSmall = W < 360;
  const avSize = isSmall ? 48 : 52;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.threadRow, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.threadAvatarWrap}>
        <LinearGradient
          colors={lu.gradients.brand}
          style={{ width: avSize, height: avSize, borderRadius: avSize / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {chat.avatar ? (
            <Image
              source={{ uri: chat.avatar }}
              style={{ width: avSize, height: avSize, borderRadius: avSize / 2, position: 'absolute' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={chat.avatar}
            />
          ) : (
            <LuUserIcon size={avSize * 0.46} color="#fff" filled />
          )}
        </LinearGradient>
      </View>
      <View style={styles.threadBody}>
        <View style={styles.threadTitleRow}>
          <Text style={[styles.threadName, dark && { color: '#fff' }]} numberOfLines={1}>{chat.name}</Text>
          <View style={styles.agencyBadge}>
            <Text style={styles.agencyBadgeText}>{t('chat.agencyTag')}</Text>
          </View>
        </View>
        <Text style={[styles.threadLast, dark && { color: lu.colors.nightMuted }]} numberOfLines={1}>
          {chat.lastMessage || t('agency.centerMembers', { count: chat.members?.length ?? 0 })}
        </Text>
      </View>
      <View style={styles.threadMeta}>
        <LuUserIcon size={16} color={lu.colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  onlineIndicatorDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: lu.colors.mint,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 3,
  },
  verifiedBadge: {
    backgroundColor: lu.colors.purple,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  agencyBadge: {
    backgroundColor: lu.colors.purple,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  agencyBadgeText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '800',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    gap: 8,
  },
  headerTabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 18,
  },
  headerTabBtn: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  headerTabText: {
    fontSize: 18,
    fontWeight: '600',
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
  },
  headerTabTextActive: {
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  headerTabTextActiveDark: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
  },
  headerTabUnderline: {
    marginTop: 6,
    width: 28,
    height: 3,
    borderRadius: 99,
  },
  headerTabUnderlinePlaceholder: {
    marginTop: 6,
    width: 28,
    height: 3,
  },
  headerSparkle: {
    marginBottom: 8,
    opacity: 0.85,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },

  shortcutsRow: {
    flexDirection: 'row',
    paddingTop: 4,
    paddingBottom: 10,
  },
  shortcutTile: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  shortcutIconImg: {
    width: 64,
    height: 64,
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
  },
  shortcutRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255,77,94,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
    backgroundColor: 'rgba(255,45,60,0.05)',
  },
  shortcutRingLight: {
    borderColor: 'rgba(225,20,20,0.45)',
    backgroundColor: 'rgba(225,20,20,0.04)',
    shadowOpacity: 0.25,
  },
  shortcutLabelPill: {
    marginTop: -13,
    paddingHorizontal: 15,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1.2,
    borderColor: 'rgba(255,77,94,0.75)',
    backgroundColor: '#1D1014',
  },
  shortcutLabelPillLight: {
    borderColor: 'rgba(225,20,20,0.45)',
    backgroundColor: '#FDF4F4',
  },
  shortcutPromoBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#FF9A2E',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomRightRadius: 10,
    zIndex: 2,
  },
  gamesHubWrap: {
    marginTop: -10,
    marginBottom: 10,
  },
  shortcutPromoText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },

  circBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  circBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,60,0.35)',
    shadowColor: '#FF1E30',
    shadowOpacity: 0.3,
    elevation: 2,
  },
  circBadge: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lu.colors.live,
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  searchBoxDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,60,0.28)',
    shadowColor: '#FF1E30',
    shadowOpacity: 0.2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
    paddingVertical: 0,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 10,
  },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  filterChipActive: {
    borderColor: '#FF4D66',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  filterChipDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: lu.colors.nightLine,
  },
  filterChipActiveDark: {
    backgroundColor: 'rgba(255,45,60,0.16)',
    borderColor: '#FF3B55',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink2,
    fontFamily: lu.fonts.bodyBold,
  },
  filterChipLabelActive: {
    color: '#fff',
  },
  filterChipCount: {
    fontSize: 13,
    fontWeight: '800',
    color: lu.colors.live,
    fontFamily: lu.fonts.bodyHeavy,
  },
  filterChipCountActive: {
    color: '#fff',
  },

  whiteSheet: {
    backgroundColor: '#fff',
    borderTopStartRadius: 32,
    borderTopEndRadius: 32,
    marginTop: 14,
    paddingTop: 20,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 8,
  },
  whiteSheetDark: {
    backgroundColor: lu.colors.nightCard,
    shadowColor: '#FF1E30',
    shadowOpacity: 0.15,
  },
  whiteSheetContinued: {
    backgroundColor: '#fff',
    marginTop: 0,
    paddingHorizontal: 8,
  },
  whiteSheetContinuedDark: {
    backgroundColor: lu.colors.nightCard,
  },
  threadListDividerDark: {
    backgroundColor: lu.colors.nightLine,
  },
  threadListDivider: {
    height: 1,
    backgroundColor: lu.colors.line,
    marginHorizontal: 18,
    marginTop: 2,
    marginBottom: 4,
  },

  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  seeAll: {
    fontSize: 12.5,
    color: lu.colors.muted,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
  friendsScroll: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 14,
  },
  friendsEmpty: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  friendsEmptyText: {
    fontSize: 13,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
    textAlign: 'center',
  },

  friendChip: {
    alignItems: 'center',
    width: 56,
    gap: 6,
  },
  friendAvatarWrap: {
    borderRadius: 99,
    padding: 0,
  },
  friendRing: {
    padding: 2.5,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: lu.colors.mint,
  },
  friendAvatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  friendInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: lu.fonts.display,
  },
  friendName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: lu.colors.ink,
    maxWidth: 56,
    fontFamily: lu.fonts.bodySemi,
  },

  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'transparent',
  },
  // وضع التحديد المتعدد (b20)
  selectBadgeWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    end: 14,
    justifyContent: 'center',
  },
  selectBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lu.colors.muted,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeOn: {
    borderColor: lu.colors.pink,
    backgroundColor: lu.colors.pink,
  },
  selectBadgeCheck: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  selectBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: lu.colors.line,
  },
  selectBarBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  selectBarCancel: {
    color: lu.colors.ink2,
    fontSize: 14,
    fontWeight: '600',
  },
  selectBarCount: {
    color: lu.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  selectBarDelete: {
    backgroundColor: '#EF4444',
  },
  selectBarDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  threadBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  threadAvatarWrap: {
    borderRadius: 99,
    position: 'relative',
  },
  threadAvatarAgency: {
    marginBottom: 6,
    overflow: 'visible',
  },
  threadRing: {
    padding: 2.5,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: lu.colors.mint,
  },
  threadAvatarLetter: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: lu.fonts.display,
  },
  threadName: {
    flexShrink: 1,
    fontSize: 14.5,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  threadLast: {
    fontSize: 12.5,
    color: lu.colors.ink2,
    marginTop: 3,
    fontFamily: lu.fonts.body,
  },
  threadMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  threadTime: {
    fontSize: 11,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
  },
  avatarUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  avatarUnreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 12,
  },

  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.bodyBold,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: lu.colors.muted,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: lu.fonts.body,
  },

});
