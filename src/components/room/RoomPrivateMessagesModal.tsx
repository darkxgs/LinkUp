/**
 * موديل الرسائل الخاصة داخل شاشة الروم — قائمة + محادثة + رد بدون مغادرة الغرفة
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MessageCircle, Search } from 'lucide-react-native';
import { RoomEmbeddedChatThread } from '@/components/room/RoomEmbeddedChatThread';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';
import { radius, spacing } from '@/theme';
import {
  subscribeToConversations,
  type Conversation,
} from '@/services/firebase/chat';
import {
  SUPPORT_UID,
  resolveOfficialChatDisplayName,
  isSupportAccount,
} from '@/services/supportAccount';
import { resolveDisplayName } from '@/utils/displayName';

const RTL = I18nManager.isRTL;
const SHEET_LIST_H = 480;
const SHEET_THREAD_H = 620;

const GRAD_POOL: [string, string][] = [
  ['#F0A0A0', '#FBD5D5'],
  ['#FFB199', '#FF7A8A'],
  ['#E36A6A', '#B00E0E'],
  ['#FF5C7A', '#E02B2B'],
  ['#FFD86F', '#FF9A2E'],
  ['#36D1DC', '#E55B5B'],
];

function gradFor(uid: string): [string, string] {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h * 31) + uid.charCodeAt(i)) >>> 0;
  return GRAD_POOL[h % GRAD_POOL.length]!;
}

function formatChatTime(ts: number, lang: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(lang.startsWith('ar') ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60) return lang.startsWith('ar') ? `منذ ${mins} د` : `${mins}m ago`;
  if (hours < 24) return lang.startsWith('ar') ? `منذ ${hours} س` : `${hours}h ago`;
  if (days < 7) return lang.startsWith('ar') ? `منذ ${days} ي` : `${days}d ago`;
  return d.toLocaleDateString(lang.startsWith('ar') ? 'ar' : 'en');
}

export function sumPrivateUnreadCount(
  conversations: Conversation[],
  uid: string | undefined,
): number {
  if (!uid) return 0;
  // نفس حساب شارة تبويب الدردشة خارج الروم (unreadStore): مجموع unreadBy على
  // القائمة الواصلة من subscribeToConversations (مفلترة مسبقاً من المخفية/المحذوفة).
  // استثناء المؤرشفة هنا كان يجعل العدد داخل الروم مختلفاً عن الرقم الصحيح خارجه.
  return conversations.reduce((sum, c) => sum + (c.unreadBy?.[uid] ?? 0), 0);
}

type ActiveThread = {
  conv: Conversation;
  otherUid: string;
  otherName: string;
  otherAvatar?: string;
};

export type RoomPrivateChatTarget = {
  uid: string;
  name?: string;
  avatar?: string;
};

type Props = {
  visible: boolean;
  currentRoomId?: string;
  initialTarget?: RoomPrivateChatTarget | null;
  onClose: () => void;
};

export function RoomPrivateMessagesModal({
  visible,
  currentRoomId,
  initialTarget,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language ?? 'ar';
  const myUid = user?.uid;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null);
  const consumedTargetUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (!myUid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToConversations((list) => {
      setConversations(list);
      setLoading(false);
    });
    return unsub;
  }, [visible, myUid]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setActiveThread(null);
      consumedTargetUidRef.current = null;
    }
  }, [visible]);

  const sorted = useMemo(() => {
    if (!myUid) return [];
    return conversations
      .filter((c) => !c.archivedBy?.[myUid] && !c.hiddenBy?.[myUid])
      .sort((a, b) => {
        const aPin = a.pinnedBy?.[myUid] ? 1 : 0;
        const bPin = b.pinnedBy?.[myUid] ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        const aUnread = a.unreadBy?.[myUid] ?? 0;
        const bUnread = b.unreadBy?.[myUid] ?? 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
      });
  }, [conversations, myUid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const other = c.participants.find((p) => p !== myUid) ?? '';
      const name = (
        other === SUPPORT_UID
          ? resolveOfficialChatDisplayName(other)
          : resolveDisplayName({ displayName: c.participantNames?.[other] })
      )?.toLowerCase() ?? '';
      return name.includes(q);
    });
  }, [sorted, query, myUid]);

  const openConversation = (conv: Conversation) => {
    const otherUid = conv.participants.find((p) => p !== myUid);
    if (!otherUid) return;
    const isSupport = otherUid === SUPPORT_UID || isSupportAccount(otherUid);
    const otherName = isSupport
      ? resolveOfficialChatDisplayName(otherUid) ?? t('support.title')
      : resolveDisplayName({ displayName: conv.participantNames?.[otherUid] });
    setActiveThread({
      conv,
      otherUid,
      otherName,
      otherAvatar: conv.participantAvatars?.[otherUid],
    });
  };

  useEffect(() => {
    if (!visible || !initialTarget?.uid || !myUid || initialTarget.uid === myUid) return;
    if (consumedTargetUidRef.current === initialTarget.uid) return;
    consumedTargetUidRef.current = initialTarget.uid;

    const conv = conversations.find(
      (c) =>
        c.participants.includes(initialTarget.uid)
        && !c.archivedBy?.[myUid]
        && !c.hiddenBy?.[myUid],
    );
    if (conv) {
      openConversation(conv);
      return;
    }

    const otherName = initialTarget.name?.trim() || t('rooms.userFallback');
    setActiveThread({
      conv: {
        id: `pending-${initialTarget.uid}`,
        participants: [myUid, initialTarget.uid],
        participantNames: { [initialTarget.uid]: otherName },
        participantAvatars: initialTarget.avatar
          ? { [initialTarget.uid]: initialTarget.avatar }
          : {},
        lastMessageAt: 0,
        unreadBy: {},
      } as Conversation,
      otherUid: initialTarget.uid,
      otherName,
      otherAvatar: initialTarget.avatar,
    });
  }, [visible, initialTarget?.uid, initialTarget?.name, initialTarget?.avatar, conversations, myUid, t]);

  const handleOverlayPress = () => {
    if (activeThread) {
      setActiveThread(null);
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleOverlayPress}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleOverlayPress} />
        <View
          style={[
            styles.sheet,
            activeThread ? styles.sheetThread : styles.sheetList,
          ]}
        >
          <LinearGradient
            colors={[...ROOM_DESIGN.stageGradient]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheetContent}>
            {activeThread ? (
              <RoomEmbeddedChatThread
                thread={activeThread}
                currentRoomId={currentRoomId}
                onBack={() => setActiveThread(null)}
                onClose={onClose}
              />
            ) : (
              <>
                <View style={styles.handle} />

                <View style={styles.header}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h4" weight="bold" color="#fff">
                      {t('chat.messages')}
                    </Text>
                    <Text variant="caption" color="rgba(255,255,255,0.55)">
                      {t('room.privateMessagesHint')}
                    </Text>
                  </View>
                  <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                    <X size={18} color="#fff" />
                  </Pressable>
                </View>

                <View style={styles.searchRow}>
                  <Search size={16} color="rgba(255,255,255,0.45)" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('room.searchPrivateMessages')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.searchInput}
                  />
                </View>

                {loading ? (
                  <ActivityIndicator color={lu.colors.gold} style={{ marginVertical: 36 }} />
                ) : filtered.length === 0 ? (
                  <View style={styles.empty}>
                    <MessageCircle size={36} color="rgba(255,255,255,0.25)" />
                    <Text variant="caption" color="rgba(255,255,255,0.45)" style={{ marginTop: 8 }}>
                      {t('chat.noConversations')}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filtered}
                    keyExtractor={(c) => c.id}
                    style={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const otherUid = item.participants.find((p) => p !== myUid) ?? '';
                      const isSupport = otherUid === SUPPORT_UID;
                      const name = isSupport
                        ? resolveOfficialChatDisplayName(otherUid) ?? t('support.title')
                        : resolveDisplayName({ displayName: item.participantNames?.[otherUid] });
                      const avatar = item.participantAvatars?.[otherUid];
                      const unread = item.unreadBy?.[myUid ?? ''] ?? 0;
                      const grad = gradFor(otherUid || item.id);
                      const initial = (name ?? '?').trim().charAt(0) || '★';

                      return (
                        <Pressable
                          onPress={() => openConversation(item)}
                          style={({ pressed }) => [styles.row, pressed && { opacity: 0.82 }]}
                        >
                          <View style={styles.avatarWrap}>
                            <LinearGradient colors={grad} style={styles.avatarGrad}>
                              {avatar ? (
                                <Image
                                  source={{ uri: avatar }}
                                  style={styles.avatarImg}
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                />
                              ) : (
                                <Text style={styles.avatarLetter}>{initial}</Text>
                              )}
                            </LinearGradient>
                            {unread > 0 ? (
                              <View style={styles.rowUnreadBadge}>
                                <Text style={styles.rowUnreadText}>
                                  {unread > 99 ? '99+' : unread}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.rowBody}>
                            <View style={styles.rowTitleRow}>
                              <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                              <Text style={styles.rowTime}>
                                {formatChatTime(item.lastMessageAt, lang)}
                              </Text>
                            </View>
                            <Text
                              style={[styles.rowPreview, unread > 0 && styles.rowPreviewUnread]}
                              numberOfLines={1}
                            >
                              {item.lastMessage || t('chat.startConversation')}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetList: {
    height: SHEET_LIST_H,
    maxHeight: '82%',
  },
  sheetThread: {
    height: SHEET_THREAD_H,
    maxHeight: '92%',
  },
  sheetContent: {
    flex: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    zIndex: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
    fontFamily: lu.fonts.body,
    textAlign: RTL ? 'right' : 'left',
  },
  list: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarGrad: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  rowUnreadBadge: {
    position: 'absolute',
    top: -4,
    end: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF2E62',
    borderWidth: 1.5,
    borderColor: ROOM_DESIGN.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rowUnreadText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: lu.fonts.bodySemi,
  },
  rowTime: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontFamily: lu.fonts.body,
  },
  rowPreview: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: lu.fonts.body,
    textAlign: RTL ? 'right' : 'left',
  },
  rowPreviewUnread: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
    fontFamily: lu.fonts.bodySemi,
  },
});
