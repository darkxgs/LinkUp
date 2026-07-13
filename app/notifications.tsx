/**
 * LinkUp App — شاشة الإشعارات
 * تبويبات: المنشورات | المتابعة | رسائل النظام (الإدارة)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  UserPlus,
  Gift,
  Heart,
  MessageSquare,
  AtSign,
  Eye,
  Bell,
  Volume2,
  Settings,
  Check,
  Sparkles,
  ShieldAlert,
  Ban,
  Wallet,
  Flag,
  FileText,
  Crown,
  Swords,
} from 'lucide-react-native';

import { Text, BackButton } from '@/components/ui';
import { CasinoNotificationsFeed } from '@/components/games/CasinoNotificationsFeed';
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  parseNotificationDisplay,
  dismissChatMessageNotifications,
  syncMessageNotificationsWithInbox,
  Notification,
} from '@/services/firebase/notifications';
import { resolveNotificationRoute } from '@/utils/notificationRouting';
import {
  NOTIFICATION_FILTER_TABS,
  categorizeNotification,
  countUnreadInTab,
  filterNotificationsByTab,
  isSystemNotification,
  resolveNotificationEffectiveType,
  type NotificationFilterTab,
} from '@/utils/notificationCategories';
import { colors, radius, spacing } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { isRTLActive } from '@/utils/rtl';
import {
  resolveNotificationAvatar,
  resolveNotificationStoredAvatar,
  resolveUserDocAvatar,
} from '@/utils/userAvatar';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/index';

const ICONS: Record<string, { Icon: any; color: string; bg: string }> = {
  follow: { Icon: UserPlus, color: '#E11414', bg: '#FEE2E2' },
  gift: { Icon: Gift, color: '#E11414', bg: '#FFE6E9' },
  like: { Icon: Heart, color: '#EF4444', bg: '#FEE2E2' },
  comment: { Icon: MessageSquare, color: '#ED4444', bg: '#FCDDDD' },
  message: { Icon: MessageSquare, color: '#E11414', bg: '#FEE2E2' },
  mention: { Icon: AtSign, color: '#10B981', bg: '#D1FAE5' },
  visit: { Icon: Eye, color: '#F59E0B', bg: '#FEF3C7' },
  system: { Icon: Bell, color: '#E11414', bg: '#FEE2E2' },
  room_invite: { Icon: Volume2, color: '#C61414', bg: '#FBD2D2' },
  game_challenge: { Icon: Swords, color: '#EF4444', bg: '#FEE2E2' },
  moderation: { Icon: ShieldAlert, color: '#DC2626', bg: '#FEE2E2' },
  report_update: { Icon: Flag, color: '#D97706', bg: '#FEF3C7' },
  admin_recharge: { Icon: Wallet, color: '#10B981', bg: '#D1FAE5' },
  agency_application_approved: { Icon: Sparkles, color: '#10B981', bg: '#D1FAE5' },
  agency_host_invite: { Icon: UserPlus, color: '#E11414', bg: '#FFE6E9' },
  agency_application_rejected: { Icon: ShieldAlert, color: '#EF4444', bg: '#FEE2E2' },
  agency_application_expired: { Icon: ShieldAlert, color: '#F59E0B', bg: '#FEF3C7' },
  agency_needs_verification: { Icon: ShieldAlert, color: '#E11414', bg: '#FEE2E2' },
  agency_application_ready: { Icon: Sparkles, color: '#10B981', bg: '#D1FAE5' },
  post: { Icon: FileText, color: '#E11414', bg: '#FFE6E9' },
  kyc_pending: { Icon: ShieldAlert, color: '#E11414', bg: '#FEE2E2' },
  kyc_rejected: { Icon: ShieldAlert, color: '#EF4444', bg: '#FEE2E2' },
  kyc_approved: { Icon: ShieldAlert, color: '#10B981', bg: '#D1FAE5' },
  vip_status: { Icon: Crown, color: '#F59E0B', bg: '#FEF3C7' },
};

const TAB_LABEL_KEYS: Record<NotificationFilterTab, string> = {
  posts: 'notifications.tabPosts',
  follow: 'notifications.tabFollow',
  messages: 'notifications.tabMessages',
  casino: 'notifications.tabCasino',
  system: 'notifications.tabSystem',
};

const TAB_EMPTY_KEYS: Record<NotificationFilterTab, { title: string; desc: string }> = {
  posts: { title: 'notifications.emptyPosts', desc: 'notifications.emptyPostsDesc' },
  follow: { title: 'notifications.emptyFollow', desc: 'notifications.emptyFollowDesc' },
  messages: { title: 'notifications.emptyMessages', desc: 'notifications.emptyMessagesDesc' },
  casino: { title: 'notifications.emptyCasino', desc: 'notifications.emptyCasinoDesc' },
  system: { title: 'notifications.emptySystem', desc: 'notifications.emptySystemDesc' },
};

function messagePreviewText(notif: Notification): string {
  const body = notif.data?.body;
  if (typeof body === 'string' && body.trim()) return body.trim();
  const msg = notif.message.trim();
  const colon = msg.indexOf(':');
  if (colon > 0 && colon < 48) return msg.slice(colon + 1).trim();
  return msg;
}

const MODERATION_ICONS: Partial<Record<string, typeof Ban>> = {
  account_banned: Ban,
  withdrawal_blocked: Wallet,
  account_warning: ShieldAlert,
  verification_required: ShieldAlert,
};

function resolveNotifIconKey(notif: Notification): string {
  const route = resolveNotificationEffectiveType(notif);
  if (ICONS[route]) return route;
  if (['like', 'comment', 'mention'].includes(notif.type)) return notif.type;
  return notif.type;
}

function timeAgo(
  timestamp: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string,
): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return t('common.justNow');
  if (minutes < 60) return t('common.minutesAgo', { count: minutes });
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  if (days < 7) return t('common.daysAgo', { count: days });
  const d = new Date(timestamp);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${hh}:${mm} ${day}/${month.toString().padStart(2, '0')}`;
}

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('posts');
  const [fetchedAvatars, setFetchedAvatars] = useState<Record<string, string>>({});
  const fetchedUidsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    // أمان: لو لم يصل أي snapshot (خطأ مُبتلَع/شبكة) لا نُبقِ الدوّارة للأبد
    const fallback = setTimeout(() => setLoading(false), 8000);
    const unsub = subscribeToNotifications((data) => {
      clearTimeout(fallback);
      setNotifications(data);
      setLoading(false);
    });
    void syncMessageNotificationsWithInbox();
    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, []);

  useEffect(() => {
    const missingUids = [
      ...new Set(
        notifications
          .filter((n) => n.fromUid && !resolveNotificationStoredAvatar(n))
          .map((n) => n.fromUid as string)
          .filter((uid) => !fetchedUidsRef.current.has(uid)),
      ),
    ];
    if (!missingUids.length) return;

    missingUids.forEach((uid) => fetchedUidsRef.current.add(uid));
    let cancelled = false;

    void (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        missingUids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(firestore, 'users', uid));
            updates[uid] = resolveUserDocAvatar(
              snap.exists() ? snap.data() : undefined,
              uid,
            );
          } catch {
            updates[uid] = resolveUserDocAvatar(undefined, uid);
          }
        }),
      );
      if (!cancelled && Object.keys(updates).length) {
        setFetchedAvatars((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notifications]);

  const filtered = useMemo(
    () => (activeTab === 'casino' ? [] : filterNotificationsByTab(notifications, activeTab)),
    [notifications, activeTab],
  );

  const unreadByTab = useMemo(() => {
    const counts = {} as Record<NotificationFilterTab, number>;
    for (const tab of NOTIFICATION_FILTER_TABS) {
      counts[tab] = tab === 'casino' ? 0 : countUnreadInTab(notifications, tab);
    }
    return counts;
  }, [notifications]);

  const handleMarkTabRead = async () => {
    const unread = filtered.filter((x) => !x.isRead);
    if (!unread.length) return;
    await markAllAsRead(unread.map((n) => ({ id: n.id, data: n.data })));
    setNotifications((prev) =>
      prev.map((n) => {
        if (categorizeNotification(n) === activeTab) return { ...n, isRead: true };
        return n;
      }),
    );
  };

  const handlePress = async (notif: Notification) => {
    const isChatMessage = notif.type === 'message' && !!notif.fromUid;

    if (isChatMessage) {
      await dismissChatMessageNotifications({
        fromUid: notif.fromUid,
        conversationId:
          typeof notif.data?.conversationId === 'string'
            ? notif.data.conversationId
            : undefined,
      });
      setNotifications((prev) =>
        prev.filter(
          (n) =>
            !(
              n.type === 'message'
              && n.fromUid === notif.fromUid
            ),
        ),
      );
    } else if (!notif.isRead) {
      await markAsRead(notif.id, {
        broadcastId: notif.data?.broadcastId as string | undefined,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
    }

    const route = resolveNotificationRoute({
      type: notif.type,
      notifType: resolveNotificationEffectiveType(notif),
      fromUid: notif.fromUid,
      message: notif.message,
      route: typeof notif.data?.route === 'string' ? notif.data.route : undefined,
      data: notif.data,
    });
    if (route === '/notifications') return;
    router.push(route as any);
  };

  const isRTL = isRTLActive();
  const tabUnread = unreadByTab[activeTab];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            {tabUnread > 0 ? (
              <Pressable onPress={() => void handleMarkTabRead()} style={styles.markTabBtn}>
                <Check size={14} color="#10B981" strokeWidth={2.5} />
              </Pressable>
            ) : (
              <View style={styles.headerSidePlaceholder} />
            )}
          </View>
          <Text variant="h3" weight="bold" style={styles.headerTitle}>
            {t('notifications.title')}
          </Text>
          <View style={[styles.headerSide, styles.headerSideEnd]}>
            <BackButton />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {NOTIFICATION_FILTER_TABS.map((tab) => {
            const active = activeTab === tab;
            const count = unreadByTab[tab];
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text
                  variant="bodySmall"
                  weight={active ? 'bold' : 'medium'}
                  color={active ? '#fff' : colors.text.secondary}
                  style={styles.tabLabel}
                >
                  {t(TAB_LABEL_KEYS[tab])}
                </Text>
                {count > 0 ? (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading && activeTab !== 'casino' ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: spacing.base }}>
              {t('notifications.text63078')}
            </Text>
          </View>
        ) : activeTab === 'casino' ? (
          <CasinoNotificationsFeed />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Bell size={44} color="#E11414" strokeWidth={1.5} />
            </View>
            <Text variant="h4" weight="semibold" align="center" style={{ marginTop: spacing.lg }}>
              {t(TAB_EMPTY_KEYS[activeTab].title)}
            </Text>
            <Text variant="bodySmall" color={colors.text.secondary} align="center" style={{ marginTop: 4 }}>
              {t(TAB_EMPTY_KEYS[activeTab].desc)}
            </Text>
          </View>
        ) : (
          filtered.map((notif) => {
            const iconKey = resolveNotifIconKey(notif);
            const config = ICONS[iconKey] ?? ICONS.system!;
            const display = parseNotificationDisplay(notif);
            const scenario = notif.data?.scenario as string | undefined;
            const isMessageTab = notif.type === 'message' || notif.type === 'room_invite';
            const isAdminInbox = isSystemNotification(notif);
            const ModIcon = scenario ? MODERATION_ICONS[scenario] : undefined;
            const IconComp = ModIcon ?? config!.Icon;
            const senderName =
              notif.fromName
              ?? (isAdminInbox
                ? t('notifications.adminSender')
                : notif.type === 'system'
                  ? t('notifications.systemSender')
                  : '');
            const preview = isMessageTab ? messagePreviewText(notif) : notif.message;
            const avatarUri = resolveNotificationAvatar(notif, fetchedAvatars);
            const showUserAvatar = !isAdminInbox && !!avatarUri;

            return (
              <Pressable
                key={notif.id}
                onPress={() => void handlePress(notif)}
                android_ripple={{ color: 'rgba(225, 20, 20,0.08)', borderless: false }}
                style={[
                  styles.notifCard,
                  !notif.isRead && styles.notifCardUnread,
                  isMessageTab && styles.notifCardMessage,
                  isAdminInbox && styles.notifCardSystem,
                  isRTL && styles.notifCardRTL,
                ]}
              >
                {!notif.isRead ? <View style={styles.unreadDot} /> : null}

                <View style={styles.iconSection}>
                  {showUserAvatar ? (
                    <View style={styles.avatarWrap}>
                      <Image
                        source={{ uri: avatarUri }}
                        style={styles.avatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={avatarUri}
                        transition={150}
                      />
                      <View style={[styles.typeIconBadge, { backgroundColor: config!.color }]}>
                        <config.Icon size={10} color={colors.white} strokeWidth={2.5} />
                      </View>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={isAdminInbox ? ['#FF3340', '#B00E0E'] : [config!.bg, config!.bg]}
                      style={styles.systemIcon}
                    >
                      <IconComp size={22} color={isAdminInbox ? '#fff' : config!.color} strokeWidth={2.5} />
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.contentSection}>
                  <View style={styles.titleRow}>
                    <Text variant="bodySmall" weight="bold" numberOfLines={1} style={styles.senderName}>
                      {senderName || display.title}
                    </Text>
                    <Text variant="caption" color={colors.text.tertiary} style={styles.notifTimeInline}>
                      {timeAgo(notif.createdAt, t, lang)}
                    </Text>
                  </View>

                  {isAdminInbox ? (
                    <>
                      {display.title && senderName ? (
                        <Text variant="bodySmall" weight="semibold" style={styles.notifTitle}>
                          {display.title}
                        </Text>
                      ) : null}
                      <Text
                        variant="bodySmall"
                        color={colors.text.secondary}
                        style={styles.notifBody}
                        numberOfLines={3}
                      >
                        {display.body || display.title}
                      </Text>
                    </>
                  ) : isMessageTab ? (
                    <View style={styles.messageBubble}>
                      <Text
                        variant="bodySmall"
                        color={lu.colors.ink}
                        style={styles.messagePreview}
                        numberOfLines={2}
                      >
                        {preview}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      variant="bodySmall"
                      color={colors.text.secondary}
                      style={styles.notifBody}
                      numberOfLines={3}
                    >
                      {preview}
                    </Text>
                  )}
                </View>

                {notif.type === 'gift' && (
                  <View style={styles.giftSparkle}>
                    <Sparkles size={18} color={lu.colors.gold2} fill={lu.colors.gold2} strokeWidth={0} />
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#FBEAEA',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerSide: {
    width: 44,
    alignItems: 'flex-start',
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  headerSidePlaceholder: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: lu.colors.ink,
  },
  markTabBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    paddingBottom: 12,
    paddingHorizontal: 2,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FBEAEA',
    borderWidth: 1,
    borderColor: '#FBEAEA',
  },
  tabPillActive: {
    backgroundColor: lu.colors.purple,
    borderColor: lu.colors.purple,
  },
  tabLabel: {
    fontSize: 13,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: '#fff',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  tabBadgeTextActive: {
    color: lu.colors.purple,
  },

  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    backgroundColor: '#FCFAFA',
    flexGrow: 1,
  },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingStart: 16,
    backgroundColor: colors.white,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F2E9E9',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#1B1B22',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 0,
      },
      default: {},
    }),
  },
  notifCardRTL: {
    flexDirection: 'row-reverse',
  },
  notifCardUnread: {
    backgroundColor: '#FFF8F8',
    borderColor: '#FECACA',
  },
  notifCardMessage: {
    borderColor: '#FEE2E2',
  },
  notifCardSystem: {
    borderColor: '#FBD5D5',
    backgroundColor: '#FFFBFB',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    start: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: lu.colors.pink,
  },
  iconSection: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.md,
    flexShrink: 0,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: lu.colors.card2,
  },
  typeIconBadge: {
    position: 'absolute',
    bottom: -4,
    end: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  systemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentSection: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    paddingTop: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  senderName: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 20,
    color: lu.colors.ink,
    textAlignVertical: 'top',
  },
  notifTimeInline: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 16,
    textAlignVertical: 'top',
    marginTop: 1,
  },
  messageBubble: {
    marginTop: 2,
    alignSelf: 'stretch',
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    borderTopStartRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messagePreview: {
    lineHeight: 22,
    textAlignVertical: 'top',
    flexShrink: 1,
  },
  notifTitle: {
    marginTop: 2,
    lineHeight: 22,
    color: lu.colors.ink,
    textAlignVertical: 'top',
    flexShrink: 1,
  },
  notifBody: {
    marginTop: 3,
    lineHeight: 22,
    textAlignVertical: 'top',
    flexShrink: 1,
    width: '100%',
  },
  giftSparkle: {
    marginStart: spacing.sm,
    paddingTop: 14,
    flexShrink: 0,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
