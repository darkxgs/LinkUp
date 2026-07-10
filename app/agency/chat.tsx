/**
 * دردشة الوكالة الخاصة — رسائل + صور + تسجيلات صوتية (بدون مكالمات)
 * المدير يتحكم بالأعضاء (إضافة بالـ ID / حذف).
 * متجاوبة على كل المقاسات (هاتف صغير → جهاز لوحي) ومطابقة لهوية LinkUp.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
  Modal, Alert, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { onAuthStateChanged } from '@firebase/auth';
import { Send, ImagePlus, Users as UsersIcon, UserPlus, Trash2, X, Crown, MessageCircle } from 'lucide-react-native';

import { Text, VoiceRecorder } from '@/components/ui';
import { VoiceMessagePlayer } from '@/components/ui/VoiceMessagePlayer';
import { BackChevron } from '@/components/ui/RtlChevron';
import { auth } from '@/services/firebase';
import {
  openAgencyChat, subscribeToAgencyChat, subscribeToAgencyChatMessages,
  sendAgencyText, sendAgencyImage, sendAgencyVoice,
  addAgencyChatMemberById, removeAgencyChatMember, updateAgencyChatName, deleteAgencyChatCompletely,
  type AgencyChatMeta, type AgencyChatMessage,
} from '@/services/firebase/agencyChat';
import { lu } from '@/theme/lu-brand';

const CONTENT_MAX = 680; // أقصى عرض للمحتوى على الأجهزة اللوحية

export default function AgencyChatScreen() {
  const { agencyId } = useLocalSearchParams<{ agencyId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const myUid = auth.currentUser?.uid ?? '';
  const listRef = useRef<FlatList>(null);

  // ===== مقاسات متجاوبة =====
  const isSmall = W < 360;
  const isTablet = W >= 700;
  const gutter = isSmall ? 10 : isTablet ? 20 : 14;
  const av = isSmall ? 30 : 34;
  const bubbleMax = isTablet ? 460 : W * 0.76;

  const [chat, setChat] = useState<AgencyChatMeta | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [messages, setMessages] = useState<AgencyChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    if (!agencyId) return;
    let unsubChat: (() => void) | undefined;
    let unsubMsgs: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const start = async () => {
      try {
        const { chat: c, isManager: mgr } = await openAgencyChat(agencyId);
        if (cancelled) return;
        setChat(c);
        setIsManager(mgr);
        unsubChat = subscribeToAgencyChat(agencyId, (fresh) => fresh && setChat(fresh));
        unsubMsgs = subscribeToAgencyChatMessages(agencyId, setMessages);
      } catch (e: any) {
        if (!cancelled) {
          const code = e?.code ?? '';
          setError(
            code.includes('unauthenticated') || e?.message === 'unauthenticated'
              ? 'يجب تسجيل الدخول لفتح دردشة الوكالة'
              : (e?.message ?? 'تعذّر فتح الدردشة'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (auth.currentUser) {
      start();
    } else {
      unsubAuth = onAuthStateChanged(auth, (u: any) => {
        if (u && !cancelled) { unsubAuth?.(); start(); }
      });
      timer = setTimeout(() => {
        if (!auth.currentUser && !cancelled) {
          setError('يجب تسجيل الدخول لفتح دردشة الوكالة');
          setLoading(false);
        }
      }, 6000);
    }

    return () => {
      cancelled = true;
      unsubAuth?.(); unsubChat?.(); unsubMsgs?.();
      if (timer) clearTimeout(timer);
    };
  }, [agencyId]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const handleSend = async () => {
    const t = input.trim();
    if (!t || sending) return;
    setInput('');
    setSending(true);
    try { await sendAgencyText(agencyId!, t); }
    catch (e: any) { Alert.alert('خطأ', e?.message ?? 'فشل الإرسال'); setInput(t); }
    finally { setSending(false); }
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('تنبيه', 'يلزم إذن الوصول للصور');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setSending(true);
    try { await sendAgencyImage(agencyId!, res.assets[0].uri); }
    catch (e: any) { Alert.alert('خطأ', e?.message ?? 'فشل رفع الصورة'); }
    finally { setSending(false); }
  };

  const handleSendVoice = async (uri: string, durationSec: number) => {
    setSending(true);
    try { await sendAgencyVoice(agencyId!, uri, durationSec); }
    catch (e: any) { Alert.alert('خطأ', e?.message ?? 'فشل إرسال الصوت'); }
    finally { setSending(false); }
  };

  const renderMessage = useCallback(({ item }: { item: AgencyChatMessage }) => {
    const mine = item.fromUid === myUid;
    // Message/profile frames are live-room only — agency chat uses plain bubbles.
    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowOther]}>
        {!mine && (
          item.fromAvatar
            ? <Image source={{ uri: item.fromAvatar }} style={[styles.msgAvatar, { width: av, height: av, borderRadius: av / 2 }]} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.fromUid} />
            : <View style={[styles.msgAvatar, styles.msgAvatarEmpty, { width: av, height: av, borderRadius: av / 2 }]}><Text style={styles.msgAvatarLetter}>{(item.fromName ?? '?').charAt(0)}</Text></View>
        )}
        <View style={[styles.bubble, { maxWidth: bubbleMax }, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!mine && <Text weight="bold" style={styles.senderName} numberOfLines={1}>{item.fromName}</Text>}
          {item.type === 'text' && (
            <Text style={[styles.msgText, mine && styles.msgTextMine]}>{item.text}</Text>
          )}
          {item.type === 'image' && item.imageUrl && (
            <Pressable onPress={() => setFullImage(item.imageUrl!)}>
              <Image source={{ uri: item.imageUrl }} style={styles.msgImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.imageUrl} />
            </Pressable>
          )}
          {item.type === 'voice' && item.voiceUrl && (
            <VoiceMessagePlayer voiceUrl={item.voiceUrl} duration={item.voiceDuration ?? 0} isMine={mine} />
          )}
        </View>
      </View>
    );
  }, [myUid, av, bubbleMax]);

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LinearGradient colors={lu.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
            <BackChevron color="#fff" size={22} />
          </Pressable>
          <View style={styles.headCenter}>
            <View style={styles.headAvatarWrap}>
              {chat?.avatar
                ? <Image source={{ uri: chat.avatar }} style={styles.headAvatar} contentFit="cover" />
                : <UsersIcon size={18} color="#fff" strokeWidth={2.2} />}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text weight="bold" style={styles.headTitle} numberOfLines={1}>{chat?.name ?? 'دردشة الوكالة'}</Text>
              <Text style={styles.headSub}>{chat?.members?.length ?? 0} عضو</Text>
            </View>
          </View>
          {isManager ? (
            <Pressable onPress={() => setShowManage(true)} style={styles.headBtn} hitSlop={10}>
              <UsersIcon color="#fff" size={20} />
            </Pressable>
          ) : <View style={styles.headBtn} />}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={lu.colors.purple} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errIcon}><MessageCircle size={30} color={lu.colors.muted} strokeWidth={1.8} /></View>
          <Text color={lu.colors.ink2} weight="semibold" style={{ textAlign: 'center', marginTop: 10 }}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 8}>
          <View style={styles.contentWrap}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderMessage}
              contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 14, paddingBottom: 18 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={14}
              maxToRenderPerBatch={12}
              windowSize={9}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIcon}><MessageCircle size={34} color={lu.colors.purple} strokeWidth={1.8} /></View>
                  <Text weight="bold" style={styles.emptyTitle}>ابدأ المحادثة</Text>
                  <Text color={lu.colors.muted} style={styles.emptySub}>شارك أعضاء وكالتك الرسائل والصور والتسجيلات</Text>
                </View>
              }
            />

            <View style={[styles.inputBar, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 8 }]}>
              <Pressable onPress={handlePickImage} style={styles.iconBtn} disabled={sending} hitSlop={6}>
                <ImagePlus size={22} color={lu.colors.purple} strokeWidth={2} />
              </Pressable>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="اكتب رسالة..."
                placeholderTextColor={lu.colors.muted}
                multiline
                maxLength={500}
              />
              {input.trim() ? (
                <Pressable onPress={handleSend} disabled={sending} style={styles.sendBtn}>
                  <LinearGradient colors={lu.gradients.purple} style={StyleSheet.absoluteFill} />
                  {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" strokeWidth={2.5} />}
                </Pressable>
              ) : (
                <VoiceRecorder onRecorded={handleSendVoice} color={lu.colors.purple} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* عارض الصورة كامل الحجم */}
      <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}>
        <Pressable style={styles.fullImageBg} onPress={() => setFullImage(null)}>
          {fullImage && <Image source={{ uri: fullImage }} style={styles.fullImage} contentFit="contain" />}
        </Pressable>
      </Modal>

      {chat && (
        <ManageMembersModal
          visible={showManage}
          chat={chat}
          myUid={myUid}
          onClose={() => setShowManage(false)}
          onChatDeleted={() => router.back()}
        />
      )}
    </View>
  );
}

// ==================== إدارة الأعضاء ====================
function ManageMembersModal({ visible, chat, myUid, onClose, onChatDeleted }: {
  visible: boolean; chat: AgencyChatMeta; myUid: string; onClose: () => void; onChatDeleted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const isTablet = W >= 700;
  const [newId, setNewId] = useState('');
  const [busy, setBusy] = useState(false);
  const [clanName, setClanName] = useState(chat.name);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setClanName(chat.name);
  }, [chat.name, visible]);

  const handleRename = async () => {
    const next = clanName.trim();
    if (!next || next === chat.name.trim() || renaming) return;
    setRenaming(true);
    try {
      await updateAgencyChatName(chat.agencyId, next);
      Alert.alert('تم', 'تم تحديث اسم العشيرة للجميع');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر حفظ الاسم');
    } finally {
      setRenaming(false);
    }
  };

  const handleAdd = async () => {
    const id = newId.trim();
    if (!id || busy) return;
    setBusy(true);
    try {
      const r = await addAgencyChatMemberById(chat.agencyId, id);
      setNewId('');
      Alert.alert('تمت الإضافة', `أُضيف ${r.name} للدردشة`);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّرت الإضافة');
    } finally { setBusy(false); }
  };

  const handleRemove = async (uid: string, name: string) => {
    if (uid === chat.ownerUid) return Alert.alert('غير مسموح', 'لا يمكن إزالة مالك الوكالة');
    // #3: تنفيذ مباشر بدون نافذة تأكيد — رسالة نتيجة فقط
    try {
      await removeAgencyChatMember(chat.agencyId, uid);
      Alert.alert('تم', `أُزيل "${name}" من الدردشة`);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّرت الإزالة');
    }
  };

  const handleDeleteChat = () => {
    Alert.alert(
      'حذف الدردشة نهائياً',
      'سيتم حذف جميع الرسائل والصور والتسجيلات من دردشة الوكالة عند الجميع. لا يمكن التراجع.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائياً',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAgencyChatCompletely(chat.agencyId);
              onClose();
              onChatDeleted();
            } catch (e: any) {
              Alert.alert('خطأ', e?.message ?? 'تعذّر حذف الدردشة');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxWidth: isTablet ? CONTENT_MAX : undefined, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text weight="bold" style={styles.sheetTitle}>أعضاء الدردشة ({chat.members.length})</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}><X size={20} color={lu.colors.ink} /></Pressable>
          </View>

          <Text style={styles.renameLabel}>اسم العشيرة</Text>
          <View style={styles.renameRow}>
            <TextInput
              style={styles.renameInput}
              value={clanName}
              onChangeText={setClanName}
              placeholder="اسم مجموعة الوكالة"
              placeholderTextColor={lu.colors.muted}
              maxLength={40}
            />
            <Pressable onPress={() => void handleRename()} disabled={renaming} style={styles.renameBtn}>
              {renaming ? <ActivityIndicator size="small" color="#fff" /> : <Text weight="bold" style={styles.renameBtnText}>حفظ</Text>}
            </Pressable>
          </View>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newId}
              onChangeText={setNewId}
              placeholder="أضف عضواً بالـ ID..."
              placeholderTextColor={lu.colors.muted}
              keyboardType="number-pad"
            />
            <Pressable onPress={handleAdd} disabled={busy} style={styles.addBtn}>
              <LinearGradient colors={lu.gradients.purple} style={StyleSheet.absoluteFill} />
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <UserPlus size={18} color="#fff" strokeWidth={2.2} />}
            </Pressable>
          </View>

          <FlatList
            data={chat.members}
            keyExtractor={(uid) => uid}
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: uid }) => {
              const name = chat.memberNames?.[uid] ?? 'عضو';
              const avatar = chat.memberAvatars?.[uid] ?? '';
              const isOwner = uid === chat.ownerUid;
              return (
                <View style={styles.memberRow}>
                  {avatar
                    ? <Image source={{ uri: avatar }} style={styles.memberAvatar} contentFit="cover" />
                    : <View style={[styles.memberAvatar, styles.msgAvatarEmpty]}><Text style={styles.msgAvatarLetter}>{name.charAt(0)}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" style={styles.memberName} numberOfLines={1}>
                      {name}{uid === myUid ? ' (أنت)' : ''}
                    </Text>
                    {isOwner && <Text style={styles.ownerTag}>مدير الوكالة</Text>}
                  </View>
                  {isOwner ? (
                    <Crown size={18} color={lu.colors.gold2} />
                  ) : (
                    <Pressable onPress={() => handleRemove(uid, name)} hitSlop={8} style={styles.removeBtn}>
                      <Trash2 size={18} color={lu.colors.live} />
                    </Pressable>
                  )}
                </View>
              );
            }}
          />

          <Pressable onPress={handleDeleteChat} disabled={busy} style={styles.deleteChatBtn}>
            <Trash2 size={18} color={lu.colors.live} strokeWidth={2.2} />
            <Text weight="semibold" style={styles.deleteChatText}>حذف الدردشة نهائياً للجميع</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: lu.colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: lu.colors.card2,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { paddingBottom: 14, borderBottomLeftRadius: lu.radius.lg, borderBottomRightRadius: lu.radius.lg, ...lu.shadows.card },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  headBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  headAvatarWrap: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  headAvatar: { width: '100%', height: '100%' },
  headTitle: { fontSize: 17, color: '#fff' },
  headSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  contentWrap: { flex: 1, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' },

  msgRow: { flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgAvatar: {},
  msgAvatarEmpty: { backgroundColor: lu.colors.purple, alignItems: 'center', justifyContent: 'center' },
  msgAvatarLetter: { color: '#fff', fontSize: 13, fontFamily: lu.fonts.displayHeavy, includeFontPadding: false },
  bubble: { borderRadius: lu.radius.base, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: lu.colors.purple, borderBottomRightRadius: 5, ...lu.shadows.card, shadowOpacity: 0.12 },
  bubbleOther: { backgroundColor: lu.colors.card, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: lu.colors.line },
  senderName: { fontSize: 11.5, color: lu.colors.purple, marginBottom: 3 },
  msgText: { fontSize: 14.5, color: lu.colors.ink, lineHeight: 21 },
  msgTextMine: { color: '#fff' },
  msgImage: { width: 200, height: 200, borderRadius: lu.radius.sm },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: lu.colors.purpleSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, color: lu.colors.ink },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8,
    backgroundColor: lu.colors.card, borderTopWidth: 1, borderTopColor: lu.colors.line,
  },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, maxHeight: 120, minHeight: 42, backgroundColor: lu.colors.bg2,
    borderRadius: lu.radius.pill, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 14.5, color: lu.colors.ink, fontFamily: lu.fonts.body,
    borderWidth: 1, borderColor: lu.colors.line,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...lu.shadows.grad, shadowOpacity: 0.3 },

  fullImageBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '80%' },

  sheetBg: { flex: 1, backgroundColor: 'rgba(40, 10, 10, 0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: lu.colors.bg, borderTopLeftRadius: lu.radius.xl, borderTopRightRadius: lu.radius.xl, padding: 18, ...lu.shadows.pop },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: lu.colors.line, alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 16, color: lu.colors.ink },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: lu.colors.card2, alignItems: 'center', justifyContent: 'center' },
  renameLabel: { fontSize: 12, color: lu.colors.muted, marginBottom: 6 },
  renameRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  renameInput: {
    flex: 1, height: 46, backgroundColor: lu.colors.card, borderRadius: lu.radius.sm,
    paddingHorizontal: 14, fontSize: 14, color: lu.colors.ink, fontFamily: lu.fonts.body,
    borderWidth: 1, borderColor: lu.colors.line,
  },
  renameBtn: {
    minWidth: 64, height: 46, borderRadius: lu.radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: lu.colors.purple, paddingHorizontal: 12,
  },
  renameBtnText: { color: '#fff', fontSize: 13 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  addInput: {
    flex: 1, height: 46, backgroundColor: lu.colors.card, borderRadius: lu.radius.sm,
    paddingHorizontal: 14, fontSize: 14, color: lu.colors.ink, fontFamily: lu.fonts.body,
    borderWidth: 1, borderColor: lu.colors.line,
  },
  addBtn: { width: 50, height: 46, borderRadius: lu.radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: lu.colors.line },
  memberAvatar: { width: 42, height: 42, borderRadius: 21 },
  memberName: { fontSize: 14, color: lu.colors.ink },
  ownerTag: { fontSize: 11, color: lu.colors.gold2, marginTop: 1 },
  removeBtn: { padding: 6 },
  deleteChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, borderRadius: lu.radius.sm,
    backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.25)',
  },
  deleteChatText: { fontSize: 14, color: lu.colors.live },
});
