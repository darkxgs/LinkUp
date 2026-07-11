/**
 * LinkUp App — شاشة المحادثة الداخلية
 * رسائل حية من Firestore
 */

import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Text as RNText,
  Animated,
  PanResponder,
  I18nManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Images,
  Camera,
  Video,
  Sparkles,
  X,
  Ban,
  Phone,
} from 'lucide-react-native';

import {
  LuMoreIcon,
  LuEmojiIcon,
  LuSendIcon,
  LuGiftIcon,
  LuFileAttachIcon,
  LuVolumeIcon,
  LuVideoCallIcon,
} from '@/components/icons/LuDesignIcons';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import { ChatProfileCard } from '@/components/chat/ChatProfileCard';
import { AgencyRoomJoinBanner } from '@/components/chat/AgencyRoomJoinBanner';
import { AgencyRoomJoinModal } from '@/components/chat/AgencyRoomJoinModal';
import {
  subscribeToUserPresence,
  isTrackableAgencyPresence,
  type UserPresence,
} from '@/services/roomFeatures';
import { ChatGiftPickerModal } from '@/components/chat/ChatGiftPickerModal';
import { ChatBackgroundLayer } from '@/components/chat/ChatBackgroundLayer';
import { ChatBackgroundPickerModal } from '@/components/chat/ChatBackgroundPickerModal';
import {
  resolveChatBackgroundId,
  isChatBackgroundUnlocked,
  getChatBackground,
} from '@/constants/chatBackgrounds';
import { ChatGiftBubble } from '@/components/chat/ChatGiftBubble';
import { ChatCallBubble } from '@/components/chat/ChatCallBubble';

import { Text, EmojiPicker, VoiceRecorder, useAlert, GiftAnimation, BackChevron, ForwardChevron } from '@/components/ui';
import { useConfig } from '@/contexts/ConfigContext';
import { buyAndSendGift, type Gift as GiftType } from '@/services/firebase/shop';
import { useAuth } from '@/hooks/useAuth';
import {
  canMakeRelationshipLevelCall,
  canUserMakeCalls,
  getRequiredBondLevelForChatCall,
} from '@/utils/genderAccess';
import { usePresenceForUids } from '@/hooks/usePresence';
import {
  formatLastSeenTime,
  isUserOnline,
  resolveLastSeenMs,
} from '@/utils/presence';
import { isOnlineHidden } from '@/services/firebase/svipPerks';
import { getUser, subscribeToUserProfile, UserDoc } from '@/services/firebase/users';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import {
  getOrCreateConversation,
  sendChatMessage,
  sendGiftChatMessage,
  sendImageMessage,
  sendVoiceMessage,
  subscribeToMessages,
  subscribeToConversation,
  markConversationAsRead,
  deleteChatMessage,
  hideConversationForUser,
  archiveConversation,
  setConversationChatBackground,
  resolveConversationChatBackgroundId,
  ChatMessage,
  buildReplySnapshot,
} from '@/services/firebase/chat';
import { resolveGiftAnimationPayload } from '@/components/ui/giftUtils';
import { isOfficialSystemAccount, isSupportAccount, isOfficialHiddenInChatList, SUPPORT_UID, SUPPORT_CHAT_DISPLAY_NAME, AGENCY_SUPPORT_HINT } from '@/services/supportAccount';
import { isBlockedBetween, isBlocked, blockUser, unblockUser } from '@/services/firebase/blocks';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { getMessageReportPath } from '@/services/firebase/reports';
import { sendLockedMediaMessage, resolveLockedMessagePrice, type LockedMediaType } from '@/services/lockedMedia';
import { MediaOptionsModal, type MediaSendOptions } from '@/components/chat/MediaOptionsModal';
import { LockedMediaBubble } from '@/components/chat/LockedMediaBubble';
import { ChatInviteCard } from '@/components/chat/ChatInviteCard';
import { ChatGameInviteCard } from '@/components/chat/ChatGameInviteCard';
import { ChatReplyComposerBar, ChatReplyQuote } from '@/components/chat/ChatReply';
import * as ImagePicker from 'expo-image-picker';
import {
  getOrCreateRelationship,
  addRelationshipPoints,
  RELATIONSHIP_LEVELS,
  type Relationship,
} from '@/services/firebase/social';
import { ringUser } from '@/services/incomingCalls';
import { startCall } from '@/services/firebase/rtc';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { resolveDisplayName } from '@/utils/displayName';
import { SupportChatScreen } from '@/components/support/SupportChatScreen';
import { getChatMessagePrice, getMinutePrice } from '@/services/firebase/callPricingConfig';
import { isAgencyAgent } from '@/services/firebase/hostTasks';
import { navigateToRoom } from '@/utils/navigateToRoom';

function getMessagePreviewText(
  item: ChatMessage,
  t: (key: string) => string,
): string {
  if (item.type === 'text') return item.text?.trim() ?? '';
  if (item.type === 'image') return t('chat.messagePreviewImage');
  if (item.type === 'voice') return t('chat.messagePreviewVoice');
  if (item.type === 'video') return t('chat.messagePreviewVideo');
  if (item.type === 'gift') return t('chat.messagePreviewGift');
  if (item.type === 'file') return item.fileName?.trim() || t('chat.messagePreviewFile');
  if (item.type === 'room_invite') return item.text?.trim() || t('chat.messagePreviewRoomInvite');
  if (item.type === 'agency_invite') return item.text?.trim() || t('chat.messagePreviewAgencyInvite');
  if (item.type === 'party_invite') return item.text?.trim() || t('chat.messagePreviewPartyInvite');
  if (item.type === 'game_invite') return item.text?.trim() || t('chat.messagePreviewGameInvite');
  if (item.type === 'post_share') return item.text?.trim() || t('chat.messagePreviewPostShare');
  return '';
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const uid = userId ?? '';
  if (isOfficialHiddenInChatList(uid)) {
    return <SupportChatScreen officialUid={SUPPORT_UID} />;
  }
  if (isOfficialSystemAccount(uid)) {
    return <SupportChatScreen officialUid={uid} />;
  }
  return <PersonalChatScreen userId={uid} />;
}

const SWIPE_REPLY_TRIGGER = 56;
const SWIPE_REPLY_MAX = 72;

function ChatMsgAvatar({
  avatarUri,
}: {
  avatarUri?: string;
}) {
  // Profile/message frames are live-room only — 1:1 chat uses plain avatars.
  if (avatarUri) {
    return (
      <Image
        source={{ uri: avatarUri }}
        style={styles.msgAvatar}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={avatarUri}
      />
    );
  }
  return <View style={styles.msgAvatarSpacer} />;
}

function PersonalChatScreen({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const timeLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const canMakeCalls = canUserMakeCalls(user);
  const { gifts: catalogGifts, giftCategories, settings, chatBackgrounds, callPricing, vipSystem } = useConfig();
  const { presenceMap, now: presenceNow } = usePresenceForUids(userId ? [userId] : []);
  const [peerRoom, setPeerRoom] = useState<UserPresence | null>(null);
  const [joinRoomModalVisible, setJoinRoomModalVisible] = useState(false);

  const [otherUser, setOtherUser] = useState<UserDoc | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // رسائل تفاؤلية (نصية) تظهر فوراً قبل اكتمال الإرسال/الخصم — تُزال تلقائياً عند وصول الحقيقية
  const [pendingSends, setPendingSends] = useState<ChatMessage[]>([]);
  /** وسائط قيد الرفع — تظهر في القائمة مع مؤشر تحميل دون حجب الكيبورد */
  const [pendingMediaUploads, setPendingMediaUploads] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);

  // ميزات جديدة: إيموجي + صور + صوت
  const [showEmoji, setShowEmoji] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const { showAlert, showActionSheet, showToast } = useAlert();

  // الوسائط المقفلة/المؤقتة
  const [mediaOptions, setMediaOptions] = useState<{
    type: LockedMediaType;
    uri: string;
    duration?: number;
    dimensions?: { width: number; height: number };
    thumbnailUri?: string;
  } | null>(null);
  const [fullVideo, setFullVideo] = useState<string | null>(null);

  // Relationship state
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [levelUpAnimation, setLevelUpAnimation] = useState<number | null>(null);
  const [chatBlocked, setChatBlocked] = useState(false);
  // هل أنا من حظر الطرف الآخر؟ — لعرض «إلغاء الحظر» بدل «حظر المستخدم»
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);
  const [chatBackgroundId, setChatBackgroundId] = useState<string | undefined>();
  const [sendingGift, setSendingGift] = useState(false);
  const [giftAnimation, setGiftAnimation] = useState<{
    iconName: string;
    iconColor: string;
    imageUrl?: string;
    animationUrl?: string;
    soundUrl?: string;
    videoUrl?: string;
    videoUrlMp4?: string;
    giftName: string;
    senderName: string;
    recipientName?: string;
    quantity: number;
    price?: number;
    key: number;
  } | null>(null);

  const listRef = useRef<FlatList>(null);
  const lastGiftMsgIdRef = useRef<string | null>(null);
  // مفاتيح ثابتة للقائمة — الرسالة الحقيقية ترث مفتاح نسختها التفاؤلية فلا يُعاد
  // بناء الفقاعة (remount) لحظة وصولها من Firestore (كان يسبب وميضاً/قفزة بالقائمة)
  const pendingKeyByRealIdRef = useRef(new Map<string, string>());
  const pendingInitialScrollRef = useRef(true);
  const stickToBottomRef = useRef(true);
  // يُنفّذ بعد اكتمال إغلاق مودال اختيار الوسائط (مهم على iOS: لا يمكن فتح المعرض
  // أثناء إغلاق مودال آخر، فكان المعرض/الفيديو لا يفتحان).
  const pendingMediaActionRef = useRef<(() => void) | null>(null);

  const runPendingMediaAction = () => {
    const action = pendingMediaActionRef.current;
    pendingMediaActionRef.current = null;
    action?.();
  };

  const scrollToLatest = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  // عند فتح الكيبورد يتقلّص ارتفاع القائمة (adjustResize على أندرويد) بلا تغيّر في
  // حجم المحتوى، فلا يُطلق onContentSizeChange وتبقى آخر رسالة مخفية تحت الحقل.
  // نستمع لظهور الكيبورد ونمرّر للأسفل صراحةً ليظهر آخر ما وصل — على iOS وأندرويد معاً:
  //  • keyboardWillShow (iOS فقط): يتزامن مع أنيميشن الظهور فيبدو التمرير سلساً.
  //  • keyboardDidShow (المنصّتان): يضمن التمرير بعد استقرار الارتفاع فعلياً.
  useEffect(() => {
    const onKeyboardShow = () => {
      stickToBottomRef.current = true;
      scrollToLatest(true);
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', onKeyboardShow),
      Keyboard.addListener('keyboardDidShow', onKeyboardShow),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [scrollToLatest]);

  const chooseMedia = (action: () => void) => {
    pendingMediaActionRef.current = action;
    setShowMediaPicker(false);
    // أندرويد لا يستدعي Modal.onDismiss → ننفّذ بعد انتهاء الأنميشن
    if (Platform.OS !== 'ios') {
      setTimeout(runPendingMediaAction, 280);
    }
  };

  // Setup
  useEffect(() => {
    if (!userId) {
      setPeerRoom(null);
      return;
    }
    return subscribeToUserPresence(userId, (presence) => {
      setPeerRoom(isTrackableAgencyPresence(presence) ? presence : null);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToUserProfile(userId, ({ lastSeen, avatar }) => {
      setOtherUser((prev) =>
        prev ? { ...prev, lastSeen, avatar: avatar || prev.avatar } : prev,
      );
    });
  }, [userId]);

  useEffect(() => {
    const setup = async () => {
      if (!userId || !user) return;
      try {
        // ⚡ معرّف المحادثة حتمي (uid_uid مرتّبة) — نثبّته فوراً قبل أي رحلة شبكة
        // فيشترك مستمع الرسائل مباشرة وتظهر الرسائل من الكاش/أول snapshot.
        // كان الفتح ينتظر getUser ثم getOrCreateConversation + العلاقة متسلسلةً
        // (٣+ رحلات شبكة) فيصل التأخير ٤٠ ثانية على الشبكات الضعيفة.
        const sortedUids = [user.uid, userId].sort();
        setConversationId(`${sortedUids[0]}_${sortedUids[1]}`);
        // ضمان وجود وثيقة المحادثة وتحديث الأسماء/الصور — في الخلفية، لا يحجب الفتح
        void getOrCreateConversation(userId, '', '').catch(() => {});

        // ⚡ فحص الحظر بالتوازي مع جلب المستخدم — كانا متسلسلين فيتأخر فتح الشاشة
        const blocksPromise: Promise<readonly [boolean, boolean]> =
          !isSupportAccount(userId)
            ? Promise.all([
                isBlockedBetween(user.uid, userId),
                isBlocked(user.uid, userId),
              ])
            : Promise.resolve([false, false] as const);

        // 1. Load other user
        let other = await getUser(userId);
        if (!other) {
          // Demo user fallback
          other = {
            uid: userId,
            phoneNumber: '',
            displayName: t('rooms.userFallback'),
            avatar: 'https://i.pravatar.cc/200',
            gender: 'male',
            birthYear: 1990,
            country: 'PS',
            coins: 0,
            pearls: 0,
            casinoCoins: 0,
            level: 1,
            xp: 0,
            followers: 0,
            following: 0,
            visitors: 0,
            totalRoomsCreated: 0,
            createdAt: Date.now(),
          };
        }
        const resolvedName = resolveDisplayName({
          displayName: other.displayName,
          email: other.email,
        });
        const resolvedAvatar = resolveUserDocAvatar(other as unknown as Record<string, unknown>, userId);
        setOtherUser({ ...other, displayName: resolvedName, avatar: resolvedAvatar });

        // ⚡ الشاشة تُعرض فور جلب بيانات الطرف الآخر — الرسائل تصل من المستمع
        // المشترك أعلاه؛ لا ننتظر وثيقة المحادثة ولا العلاقة (كانتا تحجبان الفتح)
        setLoading(false);

        // العلاقة (شارة المستوى/الخلفيات) — في الخلفية، لا تحجب الفتح
        void getOrCreateRelationship(userId, resolvedName, resolvedAvatar)
          .then(setRelationship)
          .catch((e) => console.warn('relationship load:', e));

        const [blocked, mineBlocked] = await blocksPromise;
        setChatBlocked(blocked);
        setBlockedByMe(mineBlocked);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    setup();
  }, [userId, user]);

  // Subscribe to messages — وصفّر العدّاد عند الفتح وعند وصول رسالة جديدة
  useEffect(() => {
    if (!conversationId) return;
    pendingInitialScrollRef.current = true;
    stickToBottomRef.current = true;
    lastGiftMsgIdRef.current = null;
    pendingKeyByRealIdRef.current.clear();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    // تصفير فوري عند فتح الشاشة
    markConversationAsRead(conversationId, userId).catch(() => {});
    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);

      const giftMsgs = msgs.filter((m) => m.type === 'gift');
      const latestGift = giftMsgs[giftMsgs.length - 1];
      if (latestGift && latestGift.id !== lastGiftMsgIdRef.current) {
        const hadPriorGift = lastGiftMsgIdRef.current !== null;
        lastGiftMsgIdRef.current = latestGift.id;
        const isReceived = latestGift.fromUid !== user?.uid;
        const shouldOpen =
          isReceived &&
          (hadPriorGift || latestGift.isRead !== true);
        if (shouldOpen) {
          const payload = resolveGiftAnimationPayload(catalogGifts, latestGift);
          if (payload) {
            setGiftAnimation({
              ...payload,
              senderName: otherUser?.displayName ?? t('rooms.userFallback'),
              recipientName: user?.profile?.displayName,
              key: Date.now(),
            });
          }
        }
      } else if (latestGift && !lastGiftMsgIdRef.current) {
        lastGiftMsgIdRef.current = latestGift.id;
      }

      // ⚡ نصفّر فقط عند وجود وارد غير مقروء فعلاً — كان يُنفَّذ على كل snapshot
      // (حتى عند إرسالي أنا) = قراءة حتى 100 رسالة + كتابة batch مع كل تحديث،
      // وهو سبب رئيسي لبطء الدردشة الخاصة وتأخر علامتَي القراءة
      const hasUnreadIncoming = msgs.some(
        (m) => m.fromUid !== user?.uid && m.isRead !== true,
      );
      if (hasUnreadIncoming) {
        markConversationAsRead(conversationId, userId).catch(() => {});
      }
      if (pendingInitialScrollRef.current) {
        scrollToLatest(false);
      } else if (stickToBottomRef.current) {
        scrollToLatest(true);
      }
    });
    return unsub;
  }, [conversationId, user?.uid, catalogGifts, otherUser?.displayName, t, scrollToLatest]);

  // مطابقة الرسالة التفاؤلية مع الحقيقية — نافذة زمنية + استهلاك رسالة حقيقية
  // واحدة لكل تفاؤلية. (المطابقة بمفتاح المحتوى وحده كانت تُسقط النسختين معاً عند
  // إرسال رسالتين متتاليتين بنفس النص فتختفي الثانية وتعود = خلل/ركاكة بالإرسال)
  const filterStillPending = useCallback(
    (pending: ChatMessage[], real: ChatMessage[]) => {
      if (pending.length === 0) return pending;
      const consumed = new Set<string>();
      return pending.filter((p) => {
        const match = real.find(
          (m) =>
            !consumed.has(m.id)
            && !m.id.startsWith('temp-')
            && m.fromUid === p.fromUid
            && m.type === p.type
            && m.text === p.text
            && (m.createdAt ?? 0) >= p.createdAt - 15_000,
        );
        if (match) {
          consumed.add(match.id);
          pendingKeyByRealIdRef.current.set(match.id, p.id);
          return false;
        }
        return true;
      });
    },
    [],
  );

  // أزل الرسالة التفاؤلية بمجرد وصول الحقيقية المقابلة لها عبر onSnapshot
  useEffect(() => {
    if (pendingSends.length === 0) return;
    setPendingSends((prev) => {
      const next = filterStillPending(prev, messages);
      return next.length === prev.length ? prev : next;
    });
  }, [messages, filterStillPending, pendingSends.length]);

  // أزل وسائط قيد الرفع عند وصول الرسالة الحقيقية من Firestore
  useEffect(() => {
    if (pendingMediaUploads.length === 0) return;
    setPendingMediaUploads((prev) => {
      const next = prev.filter((pending) => {
        const real = messages.find(
          (m) =>
            !m.id.startsWith('temp-media-')
            && m.fromUid === pending.fromUid
            && m.type === pending.type
            && m.createdAt >= pending.createdAt - 3000,
        );
        if (real) {
          pendingKeyByRealIdRef.current.set(real.id, pending.id);
          return false;
        }
        return true;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [messages, pendingMediaUploads.length]);

  // القائمة المعروضة = الحقيقية + التفاؤلية (نص + وسائط)
  const displayMessages = useMemo(() => {
    let merged = messages;
    if (pendingSends.length > 0) {
      const stillPending = filterStillPending(pendingSends, messages);
      if (stillPending.length > 0) merged = [...merged, ...stillPending];
    }
    if (pendingMediaUploads.length > 0) {
      // نرتّب بساعة الخادم (sortAt) حيث توفّرت — الترتيب بساعة الجهاز وحدها كان
      // يعيد خلط الرسائل الحقيقية أثناء رفع الوسائط فتقفز الفقاعات والصورة الرمزية
      const sortKey = (m: ChatMessage) =>
        ((m as ChatMessage & { sortAt?: number }).sortAt || m.createdAt || 0);
      merged = [...merged, ...pendingMediaUploads].sort(
        (a, b) => sortKey(a) - sortKey(b),
      );
    }
    return merged;
  }, [messages, pendingSends, pendingMediaUploads, filterStillPending]);

  // معرّفات الرسائل المحمّلة — للكشف عن حذف الرسالة الأصلية في اقتباسات الرد
  const loadedMessageIds = useMemo(
    () => new Set(messages.map((m) => m.id)),
    [messages],
  );

  const invertedMessages = useMemo(() => {
    return [...displayMessages].reverse();
  }, [displayMessages]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const index = displayMessages.findIndex((m) => m.id === messageId);
      if (index < 0) return;
      const invertedIndex = displayMessages.length - 1 - index;
      try {
        listRef.current?.scrollToIndex({ index: invertedIndex, animated: true, viewPosition: 0.5 });
      } catch {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    },
    [displayMessages],
  );

  const replyLabels = useMemo(
    () => ({
      you: t('chat.replyYou'),
      replyingTo: t('chat.replyingTo'),
      deletedMessage: t('chat.replyDeletedMessage'),
    }),
    [t],
  );

  useEffect(() => {
    if (!conversationId || !userId) return;
    const unsub = subscribeToConversation(conversationId, (conv) => {
      setPeerLastReadAt(conv?.lastReadAt?.[userId] ?? 0);
      setChatBackgroundId(resolveConversationChatBackgroundId(conv, user?.uid));
    });
    return unsub;
  }, [conversationId, userId, user?.uid]);

  const bondLevel = relationship?.level ?? 1;
  const activeBackgroundId = resolveChatBackgroundId(chatBackgroundId, bondLevel, chatBackgrounds);
  const activeBackground = getChatBackground(activeBackgroundId, chatBackgrounds);

  const handleSelectChatBackground = async (backgroundId: string) => {
    if (!conversationId || savingBackground) return;
    if (!isChatBackgroundUnlocked(backgroundId, bondLevel, chatBackgrounds)) return;
    if (backgroundId === activeBackgroundId) {
      setShowBackgroundPicker(false);
      return;
    }
    setSavingBackground(true);
    try {
      await setConversationChatBackground(conversationId, backgroundId);
      setChatBackgroundId(backgroundId);
      setShowBackgroundPicker(false);
      showAlert({
        type: 'success',
        title: t('common.done'),
        message: t('chat.chatBackgroundApplied'),
      });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: e?.message ?? t('chat.chatBackgroundFailed'),
      });
    } finally {
      setSavingBackground(false);
    }
  };

  // useCallback — تُمرَّر لصفوف القائمة؛ ثباتها شرط لعدم إعادة رسم كل الفقاعات
  const isMessageReadByPeer = useCallback(
    (msg: ChatMessage) =>
      msg.isRead === true || (msg.createdAt > 0 && msg.createdAt <= peerLastReadAt),
    [peerLastReadAt],
  );

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !conversationId || !userId || !otherUser) return;
    const replyTarget = replyingTo;
    const replySnapshot = replyTarget ? buildReplySnapshot(replyTarget) : undefined;
    setInputText('');
    setReplyingTo(null);
    const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      fromUid: user?.uid ?? '',
      toUid: userId,
      text,
      type: 'text',
      createdAt: Date.now(),
      isRead: false,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    };
    setPendingSends((prev) => [...prev, optimistic]);
    stickToBottomRef.current = true;
    scrollToLatest(true);
    void (async () => {
      try {
        await sendChatMessage(conversationId, userId, text, replySnapshot);

        // نقاط العلاقة — في الخلفية، لا تُعطّل سرعة الإرسال
        addRelationshipPoints(userId, otherUser.displayName, otherAvatarUri, 5, 'message')
          .then((result) => {
            if (result?.levelUp) {
              setLevelUpAnimation(result.newLevel);
              setTimeout(() => setLevelUpAnimation(null), 3000);
              getOrCreateRelationship(userId, otherUser.displayName, otherAvatarUri)
                .then(setRelationship)
                .catch(() => {});
            }
          })
          .catch((e) => console.warn('relationship points:', e));
      } catch (e: any) {
        // عند الفشل: أزل الرسالة التفاؤلية وأعد النص إلى الحقل (إن لم يبدأ المستخدم بكتابة جديد)
        setPendingSends((prev) => prev.filter((p) => p.id !== tempId));
        setInputText((cur) => cur || text);
        if (replyTarget) setReplyingTo(replyTarget);
        const msg = e?.message ?? '';
        if (msg === 'BLOCKED') {
          setChatBlocked(true);
          Alert.alert(t('common.error'), t('chat.blockedNotice'));
        } else if (msg.includes('permission') || msg.includes('insufficient')) {
          Alert.alert(t('chat.firebaseRules'), t('chat.firebaseRulesDesc'));
        } else {
          Alert.alert(t('common.error'), msg || t('chat.messageSendFailed'));
        }
      }
    })();
  };

  // ============ اختيار صورة → فتح مودال الخيارات ============
  const handlePickImage = async (fromCamera: boolean) => {
    if (!conversationId || !userId) return;
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert({ type: 'warning', title: t('chat.permRequired'), message: t('chat.permAccess') });
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: false,
          });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // افتح مودال الخيارات
      setMediaOptions({
        type: 'image',
        uri: asset.uri,
        dimensions: { width: asset.width ?? 0, height: asset.height ?? 0 },
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('chat.sendFailed'), message: e?.message ?? t('chat.imagePickFailed') });
    }
  };

  // ============ اختيار فيديو → فتح مودال الخيارات ============
  const handlePickVideo = async () => {
    if (!conversationId || !userId) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert({ type: 'warning', title: t('chat.permRequired'), message: t('chat.permAccess') });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
        videoMaxDuration: 120,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // توليد thumbnail
      let thumbnailUri: string | undefined;
      try {
        const VT = await import('expo-video-thumbnails');
        const { uri } = await VT.getThumbnailAsync(asset.uri, { time: 1000 });
        thumbnailUri = uri;
      } catch {
        // اختياري
      }

      setMediaOptions({
        type: 'video',
        uri: asset.uri,
        duration: asset.duration ? asset.duration / 1000 : undefined,
        thumbnailUri,
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('chat.sendFailed'), message: e?.message ?? t('chat.videoPickFailed') });
    }
  };

  // ============ تسجيل صوت → فتح مودال الخيارات ============
  const handleSendVoice = async (uri: string, durationSec: number) => {
    if (!conversationId || !userId) return;
    setMediaOptions({
      type: 'voice',
      uri,
      duration: durationSec,
    });
  };

  // ============ الإرسال النهائي بعد اختيار الخيارات ============
  const handleSendMedia = (opts: MediaSendOptions) => {
    if (!mediaOptions || !conversationId || !userId || !user?.uid) return;

    const snapshot = { ...mediaOptions };
    setMediaOptions(null);

    const tempId = `temp-media-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const now = Date.now();
    const isSpecial = opts.isLocked || opts.enableTimer;

    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      fromUid: user.uid,
      toUid: userId,
      text: '',
      type: snapshot.type,
      createdAt: now,
      isRead: false,
      ...(snapshot.type === 'image'
        ? {
            imageUrl: snapshot.uri,
            imageWidth: snapshot.dimensions?.width,
            imageHeight: snapshot.dimensions?.height,
          }
        : snapshot.type === 'voice'
          ? {
              voiceUrl: snapshot.uri,
              voiceDuration: Math.round(snapshot.duration ?? 0),
            }
          : {
              videoUrl: snapshot.uri,
              videoThumbnail: snapshot.thumbnailUri ?? snapshot.uri,
              videoDuration: snapshot.duration,
            }),
      ...(isSpecial
        ? {
            isLocked: opts.isLocked,
            unlockPrice: opts.isLocked
              ? resolveLockedMessagePrice(opts.unlockPrice ?? settings?.lockedMessagePrice)
              : undefined,
            expireMode: opts.expireMode,
            viewDuration: opts.viewDuration,
          }
        : {}),
    };

    setPendingMediaUploads((prev) => [...prev, optimistic]);
    stickToBottomRef.current = true;
    scrollToLatest(true);

    void (async () => {
      try {
        if (!isSpecial) {
          if (snapshot.type === 'image') {
            await sendImageMessage(
              conversationId,
              userId,
              snapshot.uri,
              snapshot.dimensions,
            );
          } else if (snapshot.type === 'voice') {
            await sendVoiceMessage(
              conversationId,
              userId,
              snapshot.uri,
              snapshot.duration ?? 0,
            );
          } else {
            await sendLockedMediaMessage({
              conversationId,
              toUid: userId,
              localUri: snapshot.uri,
              mediaType: 'video',
              isLocked: false,
              enableTimer: false,
              duration: snapshot.duration,
              thumbnailUri: snapshot.thumbnailUri,
            });
          }
        } else {
          await sendLockedMediaMessage({
            conversationId,
            toUid: userId,
            localUri: snapshot.uri,
            mediaType: snapshot.type,
            isLocked: opts.isLocked,
            enableTimer: opts.enableTimer,
            expireMode: opts.expireMode,
            viewDuration: opts.viewDuration,
            unlockPrice: opts.isLocked
              ? resolveLockedMessagePrice(opts.unlockPrice ?? settings?.lockedMessagePrice)
              : undefined,
            duration: snapshot.duration,
            thumbnailUri: snapshot.thumbnailUri,
            dimensions: snapshot.dimensions,
          });
        }
        setPendingMediaUploads((prev) => prev.filter((m) => m.id !== tempId));
      } catch (e: any) {
        setPendingMediaUploads((prev) => prev.filter((m) => m.id !== tempId));
        const msg = e?.message ?? '';
        if (msg === 'BLOCKED') {
          setChatBlocked(true);
          showAlert({ type: 'error', title: t('common.error'), message: t('chat.blockedNotice') });
        } else {
          showAlert({ type: 'error', title: t('chat.sendFailed'), message: msg || t('chat.sendFailed') });
        }
      }
    })();
  };

  // إضافة إيموجي للنص
  const handleEmojiSelect = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };
  const handleCall = useCallback(async (type: 'voice' | 'video') => {
    if (!userId || !user?.uid || !otherUser) return;
    if (!canMakeCalls) {
      Alert.alert(
        t('common.error'),
        t('genderAccess.callsNeedVerification'),
        user?.profile?.gender === 'female'
          ? [{ text: t('common.ok'), onPress: () => router.push('/wallet/kyc' as any) }]
          : undefined,
      );
      return;
    }
    if (userId === user.uid) {
      Alert.alert(t('common.error'), t('profile.cannotCallSelf'));
      return;
    }
    const bondLevel = relationship?.level ?? 1;
    if (!canMakeRelationshipLevelCall(user, type, bondLevel)) {
      Alert.alert(
        t('common.error'),
        t('chat.callBondLevelRequired', {
          level: getRequiredBondLevelForChatCall(type),
          type: type === 'video' ? t('call.video') : t('chat.voice'),
        }),
      );
      return;
    }
    try {
      const channelName = `call_${user.uid}_${userId}_${Date.now()}`;
      // ⚡ رنّ الطرف الآخر فوراً — لا ننتظر startCall (Cloud Function بطيئة)
      const ringPromise = ringUser(userId, type, channelName);
      const sessionPromise = startCall(userId, type, channelName, 'chat');
      const [, session] = await Promise.all([ringPromise, sessionPromise]);
      // ادخل قناة المكالمة من جهتي (مع معرّف الجلسة لتفعيل الفوترة)
      const ch = encodeURIComponent(channelName);
      const sp = `?channel=${ch}&session=${encodeURIComponent(session.sessionId)}`;
      if (type === 'video') {
        router.push(`/call/video/${userId}${sp}` as any);
      } else {
        router.push(`/call/${userId}${sp}` as any);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('chat.callStartFailed'));
    }
  }, [userId, user, otherUser, canMakeCalls, relationship, router, t]);

  // ملاحظة: يجب أن تبقى كل الـ hooks قبل شروط الخروج المبكّر (loading / !otherUser)
  const playGiftAnimationFromMessage = useCallback(
    (msg: ChatMessage) => {
      if (!otherUser || !user) return;
      const payload = resolveGiftAnimationPayload(catalogGifts, msg);
      if (!payload) return;
      const isMine = msg.fromUid === user.uid;
      setGiftAnimation({
        ...payload,
        senderName: isMine
          ? (user.profile?.displayName ?? t('rooms.userFallback'))
          : (otherUser.displayName ?? t('rooms.userFallback')),
        recipientName: isMine
          ? otherUser.displayName
          : (user.profile?.displayName ?? undefined),
        key: Date.now(),
      });
    },
    [catalogGifts, otherUser, user, t],
  );

  // ⚡ قيَم مشتقة ثابتة الهوية — تُستخدم داخل renderItem؛ حسابها inline كان
  // يجعل كل ضغطة حرف بحقل الإدخال تعيد رسم كل فقاعات الرسائل المعروضة
  const otherAvatarUri = useMemo(
    () =>
      otherUser
        ? resolveUserDocAvatar(otherUser as unknown as Record<string, unknown>, userId)
        : '',
    [otherUser, userId],
  );
  const peerDisplayName = useMemo(
    () =>
      resolveDisplayName({
        displayName: isSupportAccount(userId ?? '')
          ? SUPPORT_CHAT_DISPLAY_NAME
          : otherUser?.displayName,
      }),
    [userId, otherUser?.displayName],
  );

  const handleMessageActions = useCallback((item: ChatMessage) => {
    const isMe = item.fromUid === user?.uid;
    const isPending = item.id.startsWith('temp-');
    const buttons: {
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }[] = [];

    const previewText = getMessagePreviewText(item, t);

    if (!isPending) {
      buttons.push({
        text: t('chat.replyToMessage'),
        onPress: () => setReplyingTo(item),
      });
    }

    if (item.type === 'text' && item.text?.trim()) {
      buttons.push({
        text: t('chat.copyMessage'),
        onPress: async () => {
          const ok = await copyToClipboard(item.text);
          if (ok) {
            showToast(t('chat.messageCopied'));
          }
        },
      });
    }

    if (!isMe) {
      buttons.push({
        text: t('chat.reportMessage'),
        onPress: () => {
          if (!conversationId) return;
          router.push(
            getMessageReportPath(item.fromUid, item.id, conversationId, {
              messageText: previewText,
              messageType: item.type,
            }) as any,
          );
        },
      });
    }

    buttons.push({
      text: t('chat.deleteMessage'),
      style: 'destructive',
      onPress: () => {
        const deleteButtons: {
          text: string;
          style?: 'default' | 'cancel' | 'destructive';
          onPress?: () => void;
        }[] = [
          {
            text: t('chat.deleteMessageForMe'),
            onPress: async () => {
              try {
                await deleteChatMessage(item.id, { forEveryone: false });
              } catch (e: any) {
                showAlert({
                  type: 'error',
                  title: t('common.error'),
                  message: e?.message ?? t('chat.deleteMessageFailed'),
                });
              }
            },
          },
        ];
        if (isMe) {
          deleteButtons.push({
            text: t('chat.deleteMessageForEveryone'),
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteChatMessage(item.id, { forEveryone: true });
              } catch (e: any) {
                showAlert({
                  type: 'error',
                  title: t('common.error'),
                  message: e?.message ?? t('chat.deleteMessageFailed'),
                });
              }
            },
          });
        }
        deleteButtons.push({ text: t('common.cancel'), style: 'cancel' });
        showActionSheet({
          title: t('chat.deleteMessage'),
          message: t('chat.deleteMessageConfirm'),
          buttons: deleteButtons,
        });
      },
    });

    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    showActionSheet({
      title: t('chat.messageActions'),
      message: previewText ? `"${previewText.slice(0, 80)}${previewText.length > 80 ? '…' : ''}"` : undefined,
      buttons,
    });
  }, [user?.uid, conversationId, t, router, showAlert, showToast, showActionSheet]);

  // ⚡ keyExtractor + renderItem بهوية ثابتة — CellRenderer في FlatList مكوّن
  // PureComponent، فثباتهما يمنع إعادة رسم كل الفقاعات مع كل ضغطة حرف/تغيير حالة
  const keyExtractor = useCallback(
    (item: ChatMessage) => pendingKeyByRealIdRef.current.get(item.id) ?? item.id,
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isMe = item.fromUid === user?.uid;
      const isPendingUpload = item.id.startsWith('temp-media-');
      const showAvatar =
        index === invertedMessages.length - 1 ||
        invertedMessages[index + 1]?.fromUid !== item.fromUid;
      const avatarUri = isMe ? user?.profile?.avatar : otherAvatarUri;
      return (
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && (
            showAvatar ? (
              <ChatMsgAvatar avatarUri={avatarUri} />
            ) : (
              <View style={styles.msgAvatarSpacer} />
            )
          )}
          {item.type === 'call' ? (
            <Pressable
              style={[styles.msgGiftContainer, isMe ? styles.msgGiftAlignEnd : styles.msgGiftAlignStart]}
            >
              <ChatCallBubble
                msg={item}
                isMine={isMe}
                onPress={() => handleCall(item.callType === 'video' ? 'video' : 'voice')}
              />
              <View style={styles.msgMetaRow}>
                <Text
                  variant="caption"
                  color={isMe ? lu.colors.muted : colors.text.tertiary}
                  style={{ fontSize: 10 }}
                >
                  {new Date(item.createdAt).toLocaleTimeString(timeLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {isMe ? (
                  <MessageReadTicks isRead={isMessageReadByPeer(item)} />
                ) : null}
              </View>
            </Pressable>
          ) : item.type === 'gift' ? (
            <Pressable
              onPress={() => playGiftAnimationFromMessage(item)}
              onLongPress={() => handleMessageActions(item)}
              delayLongPress={350}
              style={[styles.msgGiftContainer, isMe ? styles.msgGiftAlignEnd : styles.msgGiftAlignStart]}
            >
              <ChatGiftBubble
                msg={item}
                gift={catalogGifts.find((g) => g.id === item.giftId) ?? null}
                isMine={isMe}
              />
              <View style={styles.msgMetaRow}>
                <Text
                  variant="caption"
                  color={isMe ? lu.colors.muted : colors.text.tertiary}
                  style={{ fontSize: 10 }}
                >
                  {new Date(item.createdAt).toLocaleTimeString(timeLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {isMe ? (
                  <MessageReadTicks isRead={isMessageReadByPeer(item)} />
                ) : null}
              </View>
            </Pressable>
          ) : item.type === 'room_invite' || item.type === 'agency_invite' || item.type === 'party_invite' || item.type === 'post_share' ? (
            <View>
              <ChatInviteCard msg={item} isMine={isMe} />
              <View style={styles.msgMetaRow}>
                <Text
                  variant="caption"
                  color={isMe ? lu.colors.muted : colors.text.tertiary}
                  style={{ fontSize: 10 }}
                >
                  {new Date(item.createdAt).toLocaleTimeString(timeLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {isMe ? (
                  <MessageReadTicks isRead={isMessageReadByPeer(item)} />
                ) : null}
              </View>
            </View>
          ) : item.type === 'game_invite' ? (
            <View>
              <ChatGameInviteCard msg={item} isMine={isMe} />
              <View style={styles.msgMetaRow}>
                <Text
                  variant="caption"
                  color={isMe ? lu.colors.muted : colors.text.tertiary}
                  style={{ fontSize: 10 }}
                >
                  {new Date(item.createdAt).toLocaleTimeString(timeLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {isMe ? (
                  <MessageReadTicks isRead={isMessageReadByPeer(item)} />
                ) : null}
              </View>
            </View>
          ) : (
          <SwipeReplyable
            enabled={!isPendingUpload}
            isMine={isMe}
            onReply={() => setReplyingTo(item)}
          >
          <Pressable
            onPress={() => !isPendingUpload && handleMessageActions(item)}
            onLongPress={() => !isPendingUpload && handleMessageActions(item)}
            delayLongPress={350}
            disabled={isPendingUpload}
            style={[
              styles.msgBubble,
              isMe ? styles.msgBubbleMe : styles.msgBubbleOther,
              (item.type === 'image' || item.type === 'video') && { padding: 4 },
              isPendingUpload && styles.msgBubbleUploading,
            ]}
          >
            {(item.type === 'image' || item.type === 'voice' || item.type === 'video') ? (
              <LockedMediaBubble
                msg={item}
                myUid={user?.uid ?? ''}
                isMine={isMe}
                onOpenFullImage={(url) => setFullImage(url)}
                onOpenVideo={(url) => setFullVideo(url)}
              />
            ) : (
              <>
                {item.replyTo ? (
                  <ChatReplyQuote
                    replyTo={item.replyTo}
                    peerName={peerDisplayName}
                    myUid={user?.uid}
                    isMine={isMe}
                    labels={replyLabels}
                    // الأصلية حُذفت (حذف للجميع/لي) — نعرض «رسالة محذوفة» بدل الـ snapshot
                    deleted={!loadedMessageIds.has(item.replyTo.messageId)}
                    onPress={() => scrollToMessage(item.replyTo!.messageId)}
                  />
                ) : null}
                <Text
                  variant="bodySmall"
                  color={isMe ? '#FFFFFF' : lu.colors.ink}
                  style={{ lineHeight: 22, fontSize: 14 }}
                >
                  {item.text}
                </Text>
              </>
            )}
            <View style={styles.msgMetaRow}>
              <Text
                variant="caption"
                color={isMe ? 'rgba(255,255,255,0.7)' : colors.text.tertiary}
                style={{ fontSize: 10 }}
              >
                {new Date(item.createdAt).toLocaleTimeString(timeLocale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              {isMe ? (
                isPendingUpload ? (
                  <View style={styles.msgPendingTick}>
                    <ActivityIndicator size={10} color="rgba(255,255,255,0.85)" />
                  </View>
                ) : (
                  <MessageReadTicks isRead={isMessageReadByPeer(item)} />
                )
              ) : null}
            </View>
          </Pressable>
          </SwipeReplyable>
          )}
          {isMe && isPendingUpload ? (
            <View style={styles.mediaUploadIndicator}>
              <ActivityIndicator size="small" color={TAB_DESIGN.purple} />
            </View>
          ) : null}
          {isMe ? (
            showAvatar ? (
              <ChatMsgAvatar avatarUri={avatarUri} />
            ) : (
              // فاصل بعرض الصورة — بدونه فقاعات المجموعة الواحدة لا تصطفّ على
              // حافة واحدة فتبدو الصورة وكأنها «تقفز» مع كل رسالة جديدة
              <View style={styles.msgAvatarSpacer} />
            )
          ) : null}
        </View>
      );
    },
    [
      invertedMessages,
      user,
      otherAvatarUri,
      timeLocale,
      catalogGifts,
      handleCall,
      handleMessageActions,
      playGiftAnimationFromMessage,
      isMessageReadByPeer,
      peerDisplayName,
      replyLabels,
      loadedMessageIds,
      scrollToMessage,
    ],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (!otherUser) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="body">{t('chat.userNotFound')}</Text>
      </View>
    );
  }

  const lastSeenMs = resolveLastSeenMs(
    otherUser.lastSeen,
    userId ? presenceMap[userId] : undefined,
  );
  const peerHidesOnline = isOnlineHidden(
    otherUser as unknown as Record<string, unknown>,
    vipSystem,
  );
  const isOnline = !peerHidesOnline && isUserOnline(lastSeenMs, presenceNow);
  const presenceLabel = peerHidesOnline
    ? t('common.offline')
    : isOnline
      ? t('chat.onlineNow')
      : lastSeenMs
        ? t('chat.lastSeen', {
            time: formatLastSeenTime(lastSeenMs, i18n.language, t, presenceNow),
          })
        : t('common.offline');
  const userAge = otherUser.birthYear
    ? new Date().getFullYear() - otherUser.birthYear
    : null;
  // عضوا وكالة واحدة — الدردشة مجانية (نفس إعفاء chargeForChatMessage)
  const myAgencyId = String((user as unknown as { agencyId?: string | null })?.agencyId ?? '').trim();
  const peerAgencyId = String((otherUser as unknown as { agencyId?: string | null })?.agencyId ?? '').trim();
  const sameAgencyFreeChat = Boolean(myAgencyId) && myAgencyId === peerAgencyId;
  const handleMoreMenu = () => {
    if (!conversationId || !userId) return;
    showActionSheet({
      title: t('chat.more'),
      buttons: [
        {
          text: t('profile.viewProfile'),
          onPress: () => router.push(`/profile/${userId}` as any),
        },
        {
          text: t('chat.viewTasks'),
          onPress: () => router.push(`/relationships?userId=${userId}` as any),
        },
        {
          text: t('chat.chatBackground'),
          onPress: () => setShowBackgroundPicker(true),
        },
        {
          text: t('chat.archiveChat'),
          onPress: () => {
            archiveConversation(conversationId, true)
              .then(() => {
                showAlert({
                  type: 'success',
                  title: t('common.done'),
                  message: t('chat.archiveChat'),
                });
                router.back();
              })
              .catch((e: any) => {
                showAlert({
                  type: 'error',
                  title: t('common.error'),
                  message: e?.message ?? t('chat.archiveFailed'),
                });
              });
          },
        },
        {
          text: t('chat.reportUser'),
          onPress: () =>
            router.push(
              `/report?type=user&target=${userId}&source=chat&conversationId=${conversationId}` as any,
            ),
        },
        blockedByMe
          ? {
              text: t('chat.unblockUser'),
              onPress: () => {
                showAlert({
                  type: 'warning',
                  title: t('chat.unblockUser'),
                  message: t('chat.unblockUserConfirm'),
                  buttons: [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('chat.unblockUser'),
                      onPress: async () => {
                        try {
                          await unblockUser(userId);
                          setBlockedByMe(false);
                          // قد يبقى الشات محظوراً إن كان الطرف الآخر حاظرني
                          const stillBlocked = user
                            ? await isBlockedBetween(user.uid, userId)
                            : false;
                          setChatBlocked(stillBlocked);
                          showAlert({
                            type: 'success',
                            title: t('common.done'),
                            message: t('chat.unblockSuccess'),
                          });
                        } catch (e: any) {
                          showAlert({
                            type: 'error',
                            title: t('common.error'),
                            message: e?.message ?? t('chat.unblockFailed'),
                          });
                        }
                      },
                    },
                  ],
                });
              },
            }
          : {
              text: t('chat.blockUser'),
              style: 'destructive' as const,
              onPress: () => {
                showAlert({
                  type: 'warning',
                  title: t('chat.blockUser'),
                  message: t('chat.blockUserConfirm'),
                  buttons: [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('chat.blockUser'),
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await blockUser(userId);
                          setChatBlocked(true);
                          setBlockedByMe(true);
                          showAlert({
                            type: 'success',
                            title: t('common.done'),
                            message: t('profile.blockedSuccess'),
                          });
                        } catch (e: any) {
                          showAlert({
                            type: 'error',
                            title: t('common.error'),
                            message: e?.message ?? t('chat.blockFailed'),
                          });
                        }
                      },
                    },
                  ],
                });
              },
            },
        {
          text: t('chat.deleteChat'),
          style: 'destructive',
          onPress: () => {
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
                      await hideConversationForUser(conversationId);
                      router.back();
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
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  };

  const playGiftAnimation = (gift: GiftType, qty: number, asSender: boolean) => {
    if (!otherUser || !user) return;
    const payload = resolveGiftAnimationPayload([gift], {
      giftId: gift.id,
      giftName: gift.name,
      giftQuantity: qty,
      giftPrice: gift.price * qty,
      imageUrl: gift.imageUrl,
      animationUrl: gift.animationUrl,
      soundUrl: gift.soundUrl,
      videoUrl: gift.videoUrl,
    });
    if (!payload) return;
    setGiftAnimation({
      ...payload,
      senderName: asSender
        ? (user.profile?.displayName ?? t('rooms.userFallback'))
        : (otherUser.displayName ?? t('rooms.userFallback')),
      recipientName: asSender
        ? otherUser.displayName
        : (user.profile?.displayName ?? undefined),
      key: Date.now(),
    });
  };

  const handleSendGift = async (gift: GiftType, quantity: number) => {
    if (!conversationId || !userId || !otherUser || !user || sendingGift) return;
    const total = gift.price * quantity;
    if ((user.stats?.coins ?? 0) < total) {
      Alert.alert(t('chat.insufficientCoinsForGift'), t('gifts.insufficientCoins'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('wallet.recharge'), onPress: () => router.push('/wallet/recharge' as any) },
      ]);
      return;
    }

    setSendingGift(true);

    try {
      await buyAndSendGift(gift, userId, otherUser.displayName, undefined, quantity);
      await sendGiftChatMessage(conversationId, userId, gift, quantity);
      playGiftAnimation(gift, quantity, true);
      setShowGiftPicker(false);
      // الهدية وصلت والخصم تم — الزر يتوقف هنا؛ نقاط العلاقة تُحتسب بالخلفية
      // (كانت تُنتظر فيظل زر الإرسال يدور رغم وصول الهدية)
      setSendingGift(false);
      void refreshUser?.();

      void (async () => {
        try {
          const result = await addRelationshipPoints(
            userId,
            otherUser.displayName,
            otherAvatarUri,
            total,
            'gift',
          );
          if (result.levelUp) {
            setLevelUpAnimation(result.newLevel);
            setTimeout(() => setLevelUpAnimation(null), 3000);
            const updated = await getOrCreateRelationship(
              userId,
              otherUser.displayName,
              otherAvatarUri,
            );
            setRelationship(updated);
          }
        } catch {
          /* ignore */
        }
      })();
    } catch (e: any) {
      setGiftAnimation(null);
      console.warn('handleSendGift failed:', e);
      Alert.alert(t('common.error'), e?.message ?? t('chat.giftSendFailed'));
      setSendingGift(false);
    }
  };

  return (
    <View style={styles.container}>
      <ChatBackgroundLayer background={activeBackground} />
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex1}
    >
      {/* ===== Header ===== */}
      <View style={[styles.convHeader, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backPill} hitSlop={10}>
          <BackChevron size={18} color={lu.colors.ink} />
          {relationship ? (
            <LinearGradient
              colors={lu.gradients.blue}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.levelBadge}
            >
              <RNText style={styles.levelBadgeText}>{relationship.level}</RNText>
            </LinearGradient>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleMoreMenu} style={styles.circBtnWhite} hitSlop={10}>
          <LuMoreIcon size={20} color={lu.colors.ink} />
        </Pressable>
      </View>

      <ChatProfileCard
        displayName={isSupportAccount(userId ?? '') ? SUPPORT_CHAT_DISPLAY_NAME : otherUser.displayName}
        avatarUri={otherAvatarUri}
        points={relationship?.intimacyPoints ?? 0}
        countryCode={otherUser.country}
        age={userAge}
        gender={otherUser.gender}
        showVerified={!isSupportAccount(userId ?? '')}
        inVoiceRoom={Boolean(peerRoom?.currentRoomId)}
        onPressMain={() => router.push(`/profile/${userId}` as any)}
        onPressAvatarRoom={
          peerRoom?.currentRoomId
            ? () => void navigateToRoom(router, peerRoom.currentRoomId!)
            : undefined
        }
        onPressRocket={() => router.push(`/relationships?userId=${userId}` as any)}
      />

      {peerRoom?.currentRoomId ? (
        <AgencyRoomJoinBanner
          roomName={peerRoom.roomName || t('chat.agencyRoomFallback')}
          onPressJoin={() => setJoinRoomModalVisible(true)}
        />
      ) : null}

      {isSupportAccount(userId ?? '') && (
        <Pressable
          style={styles.agencySupportCard}
          onPress={() => router.push('/agency/apply?source=chat' as any)}
        >
          <Text weight="bold" style={{ fontSize: 13, color: lu.colors.purple, marginBottom: 6 }}>
            {t('agencyApply.openRequest')}
          </Text>
          <Text style={{ fontSize: 12, color: lu.colors.ink2, lineHeight: 18 }}>
            {AGENCY_SUPPORT_HINT.split('\n').slice(1, 4).join('\n')}
          </Text>
        </Pressable>
      )}

      {/* مكالمات سريعة — نفس الوظائف السابقة */}
      {!chatBlocked && !isSupportAccount(userId ?? '') && canMakeCalls ? (
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => handleCall('voice')}
            accessibilityLabel={t('chat.voice')}
            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] }]}
          >
            <LinearGradient
              colors={lu.gradients.blue}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.callCircle, { shadowColor: lu.colors.blue }]}
            >
              <Phone size={18} color="#fff" fill="#fff" strokeWidth={0} />
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={() => handleCall('video')}
            accessibilityLabel={t('call.video')}
            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] }]}
          >
            <LinearGradient
              colors={lu.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.callCircle, { shadowColor: lu.colors.purple }]}
            >
              <Video size={19} color="#fff" strokeWidth={2.3} />
            </LinearGradient>
          </Pressable>
          <View style={{ flex: 1 }} />
          <RNText style={[styles.onlineHint, isOnline && styles.onlineHintLive]}>
            {presenceLabel}
          </RNText>
        </View>
      ) : null}

      <AgencyRoomJoinModal
        visible={joinRoomModalVisible}
        peerName={resolveDisplayName({ displayName: otherUser.displayName })}
        roomName={peerRoom?.roomName || t('chat.agencyRoomFallback')}
        onClose={() => setJoinRoomModalVisible(false)}
        onJoin={() => {
          if (!peerRoom?.currentRoomId) return;
          setJoinRoomModalVisible(false);
          void navigateToRoom(router, peerRoom.currentRoomId);
        }}
      />

      {/* Level Up Animation */}
      {levelUpAnimation !== null && (
        <View style={styles.levelUpOverlay} pointerEvents="none">
          <View style={styles.levelUpCard}>
            <LinearGradient
              colors={[lu.colors.gold, lu.colors.gold2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Sparkles size={32} color={colors.white} fill={colors.white} strokeWidth={0} />
            <Text variant="h2" weight="bold" color={colors.white}>
              {t('chat.levelUpgrade')}
            </Text>
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('chat.levelReached', { level: levelUpAnimation })}
            </Text>
            <Text variant="bodySmall" color="rgba(255,255,255,0.95)" align="center">
              {RELATIONSHIP_LEVELS.find((l) => l.level === levelUpAnimation)?.title}
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={invertedMessages}
        // inverted فقط مع وجود رسائل — القائمة المقلوبة الفارغة تعكس مكوّن
        // «ابدأ المحادثة» بـ scaleY فتتكسّر الحروف العربية على أندرويد
        inverted={invertedMessages.length > 0}
        // مفتاح ثابت عبر انتقال «تفاؤلية → حقيقية» — يمنع إعادة بناء الفقاعة وقفزة الصورة
        keyExtractor={keyExtractor}
        onContentSizeChange={() => {
          if (displayMessages.length === 0) return;
          if (pendingInitialScrollRef.current) {
            pendingInitialScrollRef.current = false;
          } else if (stickToBottomRef.current) {
            scrollToLatest(true);
          }
        }}
        onScroll={(e) => {
          const { contentOffset } = e.nativeEvent;
          stickToBottomRef.current = contentOffset.y < 96;
        }}
        scrollEventThrottle={16}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.5,
            });
          }, 100);
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={11}
        removeClippedSubviews
        renderItem={renderItem}
        contentContainerStyle={styles.messagesContent}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyChatIcon}>
              <Sparkles size={32} color={lu.colors.purple} strokeWidth={2} />
            </View>
            <Text variant="body" weight="semibold" align="center" style={{ marginTop: spacing.base }}>
              {t('chat.startConversation')}
            </Text>
            <Text variant="caption" color={colors.text.secondary} align="center" style={{ marginTop: 4 }}>
              {t('chat.sayHello')}
            </Text>
          </View>
        }
      />

      {chatBlocked && !isSupportAccount(userId ?? '') ? (
        <View style={styles.blockedBanner}>
          <Ban size={16} color="#EF4444" strokeWidth={2.5} />
          <Text variant="caption" color="#B91C1C" weight="semibold" style={{ flex: 1 }}>
            {t('chat.blockedNotice')}
          </Text>
        </View>
      ) : null}

      {!chatBlocked && sameAgencyFreeChat ? (
        <View style={styles.pricingHint}>
          <Text variant="caption" color={lu.colors.muted} style={{ textAlign: 'center' }}>
            {t('chat.sameAgencyFreeHint', 'الدردشة مجانية — أنتما ضمن وكالة واحدة، لا تُخصم عملات على الرسائل')}
          </Text>
        </View>
      ) : null}

      {!chatBlocked && !isAgencyAgent(user) && !isAgencyAgent(otherUser) && !sameAgencyFreeChat ? (
        <View style={styles.pricingHint}>
          {callPricing.messages?.enabled ? (
            <Text variant="caption" color={lu.colors.muted} style={{ textAlign: 'center' }}>
              {t('chat.messagePricingHint', {
                text: getChatMessagePrice(callPricing, 'text'),
                voice: getChatMessagePrice(callPricing, 'voice'),
                image: getChatMessagePrice(callPricing, 'image'),
              })}
            </Text>
          ) : null}
          <Text
            variant="caption"
            color={lu.colors.muted}
            style={{ textAlign: 'center', marginTop: callPricing.messages?.enabled ? 4 : 0 }}
          >
            {t('chat.callPricingHint', {
              voice: getMinutePrice(callPricing, 'chat', 'voice', 0),
              videoFirst: getMinutePrice(callPricing, 'chat', 'video', 0),
              videoAfter: getMinutePrice(callPricing, 'chat', 'video', 1),
              defaultValue: 'مكالمات: صوت {{voice}}/د • فيديو {{videoFirst}} ثم {{videoAfter}}/د',
            })}
          </Text>
        </View>
      ) : null}

      {replyingTo && !chatBlocked ? (
        <ChatReplyComposerBar
          replyTo={buildReplySnapshot(replyingTo)}
          peerName={peerDisplayName}
          myUid={user?.uid}
          labels={replyLabels}
          onClose={() => setReplyingTo(null)}
        />
      ) : null}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }, voiceRecording && styles.inputBarRecording]}>
        {chatBlocked && !isSupportAccount(userId ?? '') ? (
          <View style={styles.uploadingBar}>
            <Text variant="caption" color={lu.colors.muted}>{t('chat.blockedNotice')}</Text>
          </View>
        ) : (
          <>
            {!voiceRecording && (
              <>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() => setShowGiftPicker(true)}
                >
                  <LuGiftIcon size={20} color={TAB_DESIGN.ink} />
                </Pressable>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() => setShowMediaPicker(true)}
                >
                  <LuFileAttachIcon size={20} color={TAB_DESIGN.ink} />
                </Pressable>

                <View style={styles.inputPill}>
                  <Pressable
                    style={styles.emojiBtn}
                    onPress={() => setShowEmoji((v) => !v)}
                  >
                    <LuEmojiIcon
                      size={20}
                      color={showEmoji ? TAB_DESIGN.purple : lu.colors.muted}
                    />
                  </Pressable>
                  <TextInput
                    style={styles.inputField}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={t('chat.saySomething')}
                    placeholderTextColor={lu.colors.muted}
                    multiline
                    maxLength={500}
                    onFocus={() => setShowEmoji(false)}
                  />
                </View>
              </>
            )}

            {inputText.trim() && !voiceRecording ? (
              <Pressable
                onPress={handleSend}
                style={styles.sendCircle}
              >
                <LinearGradient
                  colors={[...TAB_DESIGN.activeGrad]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LuSendIcon size={21} color="#fff" filled />
              </Pressable>
            ) : (
              <VoiceRecorder
                onRecorded={handleSendVoice}
                onRecordingChange={setVoiceRecording}
                variant={voiceRecording ? 'bar' : 'fab'}
                color={TAB_DESIGN.purple}
              />
            )}
          </>
        )}
      </View>

      {/* لوحة الإيموجي */}
      {showEmoji && (
        <View style={{ paddingBottom: insets.bottom }}>
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmoji(false)}
            variant="light"
            height={300}
          />
        </View>
      )}

      {/* عارض الصورة بالحجم الكامل */}
      <Modal
        visible={!!fullImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImage(null)}
      >
        <Pressable style={styles.fullImageBg} onPress={() => setFullImage(null)}>
          {fullImage && (
            <Image
              source={{ uri: fullImage }}
              style={styles.fullImage}
              contentFit="contain"
            />
          )}
        </Pressable>
      </Modal>

      {/* مودال اختيار نوع الوسائط — bottom sheet نظيف */}
      <Modal
        visible={showMediaPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMediaPicker(false)}
        onDismiss={runPendingMediaAction}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowMediaPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.pickerHandle} />

            <View style={styles.pickerHeader}>
              <Pressable
                onPress={() => setShowMediaPicker(false)}
                style={styles.pickerCloseBtn}
                hitSlop={10}
              >
                <X size={18} color={lu.colors.ink2} strokeWidth={2.4} />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text weight="bold" style={{ fontSize: 17, color: lu.colors.ink }}>
                  {t('chat.sendMedia')}
                </Text>
                <Text style={{ fontSize: 12, color: lu.colors.ink2, marginTop: 2 }}>
                  {t('chat.selectSource')}
                </Text>
              </View>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.pickerOptions}>
              <PickerOption
                icon={Camera}
                title={t('chat.camera')}
                subtitle={t('chat.cameraSubtitle')}
                tint={lu.colors.pink}
                bg={lu.colors.bgPink}
                onPress={() => chooseMedia(() => handlePickImage(true))}
              />
              <PickerOption
                icon={Images}
                title={t('chat.gallery')}
                subtitle={t('chat.gallerySubtitle')}
                tint={lu.colors.blue}
                bg={lu.colors.blueSoft}
                onPress={() => chooseMedia(() => handlePickImage(false))}
              />
              <PickerOption
                icon={Video}
                title={t('call.video')}
                subtitle={t('chat.videoSubtitle')}
                tint={lu.colors.purple}
                bg={lu.colors.bg2}
                onPress={() => chooseMedia(() => handlePickVideo())}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* مودال خيارات الوسائط (قفل + توقيت) */}
      {mediaOptions && (
        <MediaOptionsModal
          visible={!!mediaOptions}
          onClose={() => setMediaOptions(null)}
          mediaType={mediaOptions.type}
          mediaPreviewUri={mediaOptions.thumbnailUri ?? mediaOptions.uri}
          duration={mediaOptions.duration}
          onSend={handleSendMedia}
        />
      )}

      {/* عارض الفيديو بالحجم الكامل */}
      <Modal
        visible={!!fullVideo}
        transparent
        animationType="fade"
        onRequestClose={() => setFullVideo(null)}
      >
        <Pressable style={styles.fullImageBg} onPress={() => setFullVideo(null)}>
          {fullVideo && <FullVideoPlayer uri={fullVideo} />}
        </Pressable>
      </Modal>

      <ChatGiftPickerModal
        visible={showGiftPicker}
        gifts={catalogGifts}
        categories={giftCategories}
        balance={user?.stats?.coins ?? 0}
        sending={sendingGift}
        onClose={() => setShowGiftPicker(false)}
        onSend={handleSendGift}
        onRecharge={() => {
          setShowGiftPicker(false);
          router.push('/wallet/recharge' as any);
        }}
      />

      <ChatBackgroundPickerModal
        visible={showBackgroundPicker}
        bondLevel={bondLevel}
        selectedId={activeBackgroundId}
        backgrounds={chatBackgrounds}
        saving={savingBackground}
        onClose={() => setShowBackgroundPicker(false)}
        onSelect={handleSelectChatBackground}
      />

      {giftAnimation && (
        <GiftAnimation
          key={giftAnimation.key}
          iconName={giftAnimation.iconName}
          iconColor={giftAnimation.iconColor}
          imageUrl={giftAnimation.imageUrl}
          animationUrl={giftAnimation.animationUrl}
          soundUrl={giftAnimation.soundUrl}
          videoUrl={giftAnimation.videoUrl}
          videoUrlMp4={giftAnimation.videoUrlMp4}
          giftName={giftAnimation.giftName}
          senderName={giftAnimation.senderName}
          recipientName={giftAnimation.recipientName}
          quantity={giftAnimation.quantity}
          price={giftAnimation.price}
          showGiftName={false}
          giftOnly
          onComplete={() => setGiftAnimation(null)}
        />
      )}
    </KeyboardAvoidingView>
    </View>
  );
}

function SwipeReplyable({
  enabled,
  isMine,
  onReply,
  children,
}: {
  enabled: boolean;
  isMine: boolean;
  onReply: () => void;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyTriggeredRef = useRef(false);
  const direction = isMine
    ? (I18nManager.isRTL ? 1 : -1)
    : (I18nManager.isRTL ? -1 : 1);

  const resetPosition = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 230,
      mass: 0.5,
    }).start();
  }, [translateX]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (!enabled) return false;
        const primary = gesture.dx * direction;
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && primary > 8;
      },
      onPanResponderMove: (_, gesture) => {
        const primary = gesture.dx * direction;
        if (primary <= 0) {
          translateX.setValue(0);
          return;
        }
        const clamped = Math.min(primary, SWIPE_REPLY_MAX);
        translateX.setValue(clamped * direction);
      },
      onPanResponderRelease: (_, gesture) => {
        const primary = gesture.dx * direction;
        if (primary >= SWIPE_REPLY_TRIGGER && !replyTriggeredRef.current) {
          replyTriggeredRef.current = true;
          onReply();
          setTimeout(() => {
            replyTriggeredRef.current = false;
          }, 260);
        }
        resetPosition();
      },
      onPanResponderTerminate: resetPosition,
    }),
    [direction, enabled, onReply, resetPosition, translateX],
  );

  return (
    <Animated.View
      {...(enabled ? panResponder.panHandlers : {})}
      style={{ transform: [{ translateX }] }}
    >
      {children}
    </Animated.View>
  );
}

function MessageReadTicks({ isRead }: { isRead: boolean }) {
  const color = isRead ? '#EC4444' : 'rgba(255,255,255,0.6)';
  return (
    <RNText style={{ fontSize: 12, color, fontWeight: '800', letterSpacing: -3 }}>
      {isRead ? '✓✓' : '✓'}
    </RNText>
  );
}

// مشغّل فيديو بسيط بملء الشاشة
function FullVideoPlayer({ uri }: { uri: string }) {
  const [AV, setAV] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        setAV(await import('expo-av'));
      } catch {}
    })();
  }, []);
  if (!AV) return <ActivityIndicator color="#fff" size="large" />;
  const { Video, ResizeMode } = AV;
  return (
    <Video
      source={{ uri }}
      style={{ width: '100%', height: '70%' }}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay
    />
  );
}

// ============================================================
// PickerOption — صف اختيار في موديل اختيار الوسائط
// ============================================================
function PickerOption({
  icon: Icon,
  title,
  subtitle,
  tint,
  bg,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  tint: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.pickerOption}>
      <View style={[styles.pickerOptionIcon, { backgroundColor: bg }]}>
        <Icon size={22} color={tint} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="bold" style={{ fontSize: 14, color: lu.colors.ink }}>
          {title}
        </Text>
        <Text style={{ fontSize: 11.5, color: lu.colors.ink2, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <ForwardChevron size={16} color={lu.colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  fullImageBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  uploadingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lu.gradients.pageChat[0],
  },

  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  backPill: {
    height: 38,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingStart: 12,
    paddingEnd: 8,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  levelBadge: {
    minWidth: 24,
    height: 22,
    borderRadius: 99,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  circBtnWhite: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },

  // ===== Quick actions =====
  agencySupportCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: lu.colors.purpleSoft ?? '#FEE2E2',
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginTop: 4,
  },
  callCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lu.colors.line,
  },
  quickActionLabel: {
    fontSize: 10.5,
    color: TAB_DESIGN.purple,
  },
  onlineHint: {
    fontSize: 10.5,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
    textAlign: 'right',
    flexShrink: 1,
  },
  onlineHintLive: {
    color: '#16A34A',
    fontWeight: '600',
  },

  // Level Up Animation
  levelUpOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  levelUpCard: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 8,
    minWidth: 220,
  },

  // Messages
  messagesContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    gap: 4,
  },
  msgRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
    maxWidth: '85%',
  },
  msgRowMe: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    alignSelf: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lu.colors.bg,
  },
  msgAvatarSpacer: {
    width: 28,
  },
  msgBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    maxWidth: '100%',
  },
  msgBubbleMe: {
    backgroundColor: '#E11414',
    borderBottomEndRadius: 6,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  msgBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomStartRadius: 6,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  msgBubbleUploading: {
    opacity: 0.88,
  },
  mediaUploadIndicator: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  msgPendingTick: {
    width: 14,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgGiftContainer: {
    maxWidth: '82%',
    backgroundColor: 'transparent',
  },
  msgGiftAlignEnd: {
    alignItems: 'flex-end',
  },
  msgGiftAlignStart: {
    alignItems: 'flex-start',
  },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },

  // Empty
  emptyChat: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyChatIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input bar
  pricingHint: {
    paddingHorizontal: spacing.base,
    paddingVertical: 6,
    backgroundColor: 'rgba(225, 20, 20, 0.06)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(225, 20, 20, 0.12)',
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    backgroundColor: '#FEE2E2',
    borderTopWidth: 0.5,
    borderTopColor: '#FECACA',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  inputBarRecording: {
    alignItems: 'center',
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
  inputPill: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  inputField: {
    flex: 1,
    color: lu.colors.ink,
    fontSize: 14,
    fontFamily: lu.fonts.body,
    paddingVertical: 8,
    maxHeight: 100,
    // التطبيق عربي أولاً — الكتابة تبدأ من اليمين دائماً حتى على
    // الأجهزة التي لا يُفعَّل عليها وضع RTL للنظام
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emojiBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: TAB_DESIGN.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 2,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== Media Picker Sheet =====
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12,0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopStartRadius: 28,
    borderTopEndRadius: 28,
    paddingTop: 10,
    paddingBottom: 28,
  },
  pickerHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginBottom: 4,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pickerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: lu.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptions: {
    paddingHorizontal: 18,
    paddingTop: 6,
    gap: 10,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: lu.colors.line,
  },
  pickerOptionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
