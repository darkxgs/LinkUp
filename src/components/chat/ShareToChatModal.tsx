/**
 * مشاركة دعوة غرفة/وكالة عبر المحادثات داخل التطبيق
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
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Share2, Search, MessageCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';

import { Text, useAlert } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import {
  subscribeToConversations,
  type Conversation,
} from '@/services/firebase/chat';
import {
  sendRoomInviteChatMessage,
  sendAgencyInviteChatMessage,
  sendPartyInviteChatMessage,
} from '@/services/firebase/chatInvites';
import { inviteUserToAgency } from '@/services/agencyService';
import {
  createRoomShareMessage,
  createPartyShareMessage,
  getLocalRoomShareFallback,
  getLocalPartyShareFallback,
} from '@/services/firebase/shareLinks';
import { auth } from '@/services/firebase';

export type ShareInviteItem =
  | { kind: 'room'; roomId: string; roomName: string }
  | { kind: 'agency'; agencyId: string; agencyName: string }
  | {
      kind: 'party';
      partyId: string;
      roomId: string;
      partyTitle: string;
      agencyName?: string;
    };

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  invites: ShareInviteItem[];
}

export function ShareToChatModal({ visible, onClose, title, invites }: Props) {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const myUid = auth.currentUser?.uid;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const unsub = subscribeToConversations((list) => {
      setConversations(list);
      setLoading(false);
    });
    return unsub;
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const other = c.participants.find((p) => p !== myUid) ?? '';
      const name = (c.participantNames?.[other] ?? '').toLowerCase();
      return name.includes(q);
    });
  }, [conversations, query, myUid]);

  const handleSend = async (conv: Conversation) => {
    if (!myUid || sendingId) return;
    const toUid = conv.participants.find((p) => p !== myUid);
    if (!toUid) return;

    setSendingId(conv.id);
    try {
      for (const inv of invites) {
        if (inv.kind === 'room') {
          await sendRoomInviteChatMessage(conv.id, toUid, {
            roomId: inv.roomId,
            roomName: inv.roomName,
          });
        } else if (inv.kind === 'agency') {
          await sendAgencyInviteChatMessage(conv.id, toUid, {
            agencyId: inv.agencyId,
            agencyName: inv.agencyName,
          });
          try {
            await inviteUserToAgency(toUid);
          } catch {
            // الدعوة في الشات كافية إن كان المستخدم في وكالة
          }
        } else if (inv.kind === 'party') {
          await sendPartyInviteChatMessage(conv.id, toUid, {
            partyId: inv.partyId,
            roomId: inv.roomId,
            partyTitle: inv.partyTitle,
            agencyName: inv.agencyName,
          });
        }
      }
      showAlert({
        type: 'success',
        title: t('common.done'),
        message: 'أُرسلت الدعوة في المحادثة',
      });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('room.shareFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setSendingId(null);
    }
  };

  const handleExternalShare = async () => {
    const partyInv = invites.find((i) => i.kind === 'party');
    if (partyInv && partyInv.kind === 'party') {
      try {
        let text: string;
        try {
          const share = await createPartyShareMessage(
            partyInv.partyId,
            partyInv.partyTitle,
            partyInv.agencyName,
          );
          text = share.text;
        } catch {
          text = getLocalPartyShareFallback(
            partyInv.partyId,
            partyInv.partyTitle,
            partyInv.roomId,
          ).text;
        }
        await Share.share({ message: text, title: partyInv.partyTitle });
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'User did not share') return;
        showAlert({ type: 'error', title: t('common.error'), message: t('room.shareFailed') });
      }
      return;
    }

    const roomInv = invites.find((i) => i.kind === 'room');
    if (!roomInv || roomInv.kind !== 'room') return;
    try {
      let text: string;
      try {
        const share = await createRoomShareMessage(roomInv.roomId, roomInv.roomName);
        text = share.text;
      } catch {
        text = getLocalRoomShareFallback(roomInv.roomId, roomInv.roomName).text;
      }
      await Share.share({ message: text, title: roomInv.roomName });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'User did not share') return;
      showAlert({ type: 'error', title: t('common.error'), message: t('room.shareFailed') });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#fff', '#F8FAFC']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.header}>
            <Text variant="h4" weight="bold" color={lu.colors.ink}>
              {title ?? 'إرسال دعوة عبر المحادثات'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={lu.colors.ink} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Search size={16} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث في المحادثات..."
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
                لا توجد محادثات بعد
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const otherUid = item.participants.find((p) => p !== myUid) ?? '';
                const name = item.participantNames?.[otherUid] ?? 'مستخدم';
                const avatar = item.participantAvatars?.[otherUid];
                const busy = sendingId === item.id;
                return (
                  <Pressable
                    onPress={() => void handleSend(item)}
                    disabled={!!sendingId}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} transition={150} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text variant="button" color={lu.colors.purple}>
                          {name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text variant="button" weight="semibold" color={lu.colors.ink} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text variant="caption" color="#94A3B8" numberOfLines={1}>
                        {item.lastMessage || 'بدء محادثة'}
                      </Text>
                    </View>
                    {busy ? (
                      <ActivityIndicator size="small" color={lu.colors.purple} />
                    ) : (
                      <Text variant="caption" weight="bold" color={lu.colors.pink}>
                        إرسال
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )}

          {invites.some((i) => i.kind === 'room' || i.kind === 'party') ? (
            <Pressable onPress={() => void handleExternalShare()} style={styles.externalBtn}>
              <Share2 size={16} color={lu.colors.purple} />
              <Text variant="caption" weight="bold" color={lu.colors.purple}>
                {invites.some((i) => i.kind === 'party')
                  ? 'مشاركة على السوشيال (Deep Link)'
                  : 'مشاركة خارج التطبيق'}
              </Text>
            </Pressable>
          ) : null}
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
    maxHeight: '78%',
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
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
