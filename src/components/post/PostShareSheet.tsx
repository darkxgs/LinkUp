/**
 * شيت مشاركة المنشور — إرسال عبر المحادثات أو لمن تتابعهم فقط
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Search, MessageCircle, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, useAlert } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import { recordPostShare, type PostShareInput } from '@/utils/postShare';
import {
  subscribeToConversations,
  getOrCreateConversation,
  type Conversation,
} from '@/services/firebase/chat';
import { sendPostShareChatMessage } from '@/services/firebase/chatInvites';
import { subscribeToMyFollowingIds } from '@/services/firebase/follow';
import { getUsers } from '@/services/firebase/users';
import { auth } from '@/services/firebase';

type ShareTab = 'chats' | 'following';

type ShareTarget = {
  uid: string;
  name: string;
  avatar?: string;
  conversationId?: string;
  subtitle?: string;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  post: PostShareInput | null;
  onShared?: (postId: string) => void;
}

export function PostShareSheet({ visible, onClose, post, onShared }: Props) {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const myUid = auth.currentUser?.uid;

  const [tab, setTab] = useState<ShareTab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingProfiles, setFollowingProfiles] = useState<Map<string, { name: string; avatar?: string }>>(
    new Map(),
  );
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [sendingUid, setSendingUid] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setTab('chats');
      return;
    }
    setLoadingChats(true);
    const unsub = subscribeToConversations((list) => {
      setConversations(list);
      setLoadingChats(false);
    });
    return unsub;
  }, [visible]);

  useEffect(() => {
    if (!visible || !myUid) {
      setFollowingIds(new Set());
      setFollowingProfiles(new Map());
      setLoadingFollowing(false);
      return;
    }
    setLoadingFollowing(true);
    return subscribeToMyFollowingIds(myUid, (ids) => {
      setFollowingIds(ids);
      const list = [...ids].filter((id) => id !== myUid);
      if (list.length === 0) {
        setFollowingProfiles(new Map());
        setLoadingFollowing(false);
        return;
      }
      void getUsers(list).then((map) => {
        const profiles = new Map<string, { name: string; avatar?: string }>();
        for (const uid of list) {
          const u = map.get(uid);
          profiles.set(uid, {
            name: u?.displayName?.trim() || t('rooms.userFallback'),
            avatar: u?.avatar,
          });
        }
        setFollowingProfiles(profiles);
        setLoadingFollowing(false);
      });
    });
  }, [visible, myUid, t]);

  const chatTargets = useMemo((): ShareTarget[] => {
    if (!myUid) return [];
    const out: ShareTarget[] = [];
    for (const c of conversations) {
      const uid = c.participants.find((p) => p !== myUid) ?? '';
      if (!uid) continue;
      out.push({
        uid,
        name: c.participantNames?.[uid] ?? t('rooms.userFallback'),
        avatar: c.participantAvatars?.[uid],
        conversationId: c.id,
        subtitle: c.lastMessage || t('feed.sharePostStartChat'),
      });
    }
    return out;
  }, [conversations, myUid, t]);

  const followingTargets = useMemo((): ShareTarget[] => {
    const chatUids = new Set(chatTargets.map((c) => c.uid));
    return [...followingIds]
      .filter((uid) => uid !== myUid && !chatUids.has(uid))
      .map((uid) => {
        const profile = followingProfiles.get(uid);
        const conv = conversations.find((c) => c.participants.includes(uid));
        return {
          uid,
          name: profile?.name ?? t('rooms.userFallback'),
          avatar: profile?.avatar,
          conversationId: conv?.id,
          subtitle: t('feed.sharePostFollowing'),
        };
      });
  }, [followingIds, followingProfiles, chatTargets, conversations, myUid, t]);

  const activeList = tab === 'chats' ? chatTargets : [...chatTargets, ...followingTargets];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeList, query]);

  const loading = tab === 'chats' ? loadingChats : loadingChats || loadingFollowing;

  const handleSend = async (target: ShareTarget) => {
    if (!post || !myUid || sendingUid) return;
    setSendingUid(target.uid);
    try {
      const convId =
        target.conversationId
        ?? await getOrCreateConversation(target.uid, target.name, target.avatar ?? '');
      await sendPostShareChatMessage(convId, target.uid, {
        postId: post.id,
        authorName: post.authorName,
        preview: post.text,
      });
      void recordPostShare(post.id).then((added) => {
        if (added) onShared?.(post.id);
      });
      showAlert({
        type: 'success',
        title: t('common.done'),
        message: t('feed.sharePostSent'),
      });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('feed.shareFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setSendingUid(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={['#fff', '#F8FAFC']} style={StyleSheet.absoluteFill} />
          <View style={styles.header}>
            <Text variant="h4" weight="bold" color={lu.colors.ink}>
              {t('feed.sharePost')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={lu.colors.ink} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            <Pressable
              onPress={() => setTab('chats')}
              style={[styles.tabBtn, tab === 'chats' && styles.tabBtnActive]}
            >
              <MessageCircle size={14} color={tab === 'chats' ? lu.colors.purple : '#94A3B8'} />
              <Text
                variant="caption"
                weight="bold"
                color={tab === 'chats' ? lu.colors.purple : '#94A3B8'}
              >
                {t('feed.shareToChats')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('following')}
              style={[styles.tabBtn, tab === 'following' && styles.tabBtnActive]}
            >
              <Users size={14} color={tab === 'following' ? lu.colors.purple : '#94A3B8'} />
              <Text
                variant="caption"
                weight="bold"
                color={tab === 'following' ? lu.colors.purple : '#94A3B8'}
              >
                {t('feed.shareToFollowing')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Search size={16} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('feed.sharePostSearch')}
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 32 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <MessageCircle size={36} color="#CBD5E1" />
              <Text variant="caption" color="#94A3B8" style={{ marginTop: 8 }}>
                {tab === 'chats' ? t('feed.sharePostEmptyChats') : t('feed.sharePostEmptyFollowing')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.uid}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => {
                const busy = sendingUid === item.uid;
                return (
                  <Pressable
                    onPress={() => void handleSend(item)}
                    disabled={!!sendingUid}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
                  >
                    {item.avatar ? (
                      <Image
                        source={{ uri: item.avatar }}
                        style={styles.avatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={item.uid}
                        transition={150}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text variant="button" color={lu.colors.purple}>
                          {item.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text variant="button" weight="semibold" color={lu.colors.ink} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text variant="caption" color="#94A3B8" numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                    {busy ? (
                      <ActivityIndicator size="small" color={lu.colors.purple} />
                    ) : (
                      <Text variant="caption" weight="bold" color={lu.colors.pink}>
                        {t('feed.sharePostSend')}
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: lu.colors.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
