/**
 * محادثة خاصة كاملة داخل شاشة الروم — نفس امتيازات app/chat/[userId].tsx
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  I18nManager,
  Platform,
  Text as RNText,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  X,
  MessageCircle,
  Send,
  ChevronLeft,
  Camera,
  Images,
  Video,
  Plus,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { Text, VoiceRecorder, useAlert } from '@/components/ui';
import { FramedAvatar, getFramedAvatarContainerSize } from '@/components/ui/FramedAvatar';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { usePresenceForUids } from '@/hooks/usePresence';
import { lu } from '@/theme/lu-brand';
import { colors, radius } from '@/theme';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import { ChatProfileCard } from '@/components/chat/ChatProfileCard';
import { AgencyRoomJoinBanner } from '@/components/chat/AgencyRoomJoinBanner';
import { LockedMediaBubble } from '@/components/chat/LockedMediaBubble';
import { ChatGiftBubble } from '@/components/chat/ChatGiftBubble';
import { ChatCallBubble } from '@/components/chat/ChatCallBubble';
import { ChatInviteCard } from '@/components/chat/ChatInviteCard';
import { ChatGameInviteCard } from '@/components/chat/ChatGameInviteCard';
import { ChatReplyQuote } from '@/components/chat/ChatReply';
import { MediaOptionsModal, type MediaSendOptions } from '@/components/chat/MediaOptionsModal';
import { LuSendIcon } from '@/components/icons/LuDesignIcons';
import {
  getOrCreateConversation,
  markConversationAsRead,
  sendChatMessage,
  sendImageMessage,
  sendVoiceMessage,
  subscribeToConversation,
  subscribeToMessages,
  type ChatMessage,
  type Conversation,
} from '@/services/firebase/chat';
import { sendLockedMediaMessage, resolveLockedMessagePrice } from '@/services/lockedMedia';
import { isBlockedBetween } from '@/services/firebase/blocks';
import { getUser, subscribeToUserProfile, type UserDoc } from '@/services/firebase/users';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import { getOrCreateRelationship, type Relationship } from '@/services/firebase/social';
import {
  subscribeToUserPresence,
  isTrackableAgencyPresence,
  type UserPresence,
} from '@/services/roomFeatures';
import { isSupportAccount } from '@/services/supportAccount';
import { resolveDisplayName } from '@/utils/displayName';
import {
  formatLastSeenTime,
  isUserOnline,
  resolveLastSeenMs,
} from '@/utils/presence';
import { isOnlineHidden } from '@/services/firebase/svipPerks';

const RTL = I18nManager.isRTL;
const CHAT_MSG_AVATAR_SIZE = 24;

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

function MessageReadTicks({ isRead }: { isRead: boolean }) {
  const tickColor = isRead ? '#EC4444' : 'rgba(255,255,255,0.6)';
  return (
    <RNText style={{ fontSize: 12, color: tickColor, fontWeight: '800', letterSpacing: -3 }}>
      {isRead ? '✓✓' : '✓'}
    </RNText>
  );
}

function FullVideoPlayer({ uri }: { uri: string }) {
  const [AV, setAV] = useState<typeof import('expo-av') | null>(null);
  useEffect(() => {
    void import('expo-av').then(setAV).catch(() => {});
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

function ChatMsgAvatar({
  avatarUri,
  frameUri,
  fallbackLetter,
}: {
  avatarUri?: string;
  frameUri?: string;
  fallbackLetter?: string;
}) {
  if (frameUri) {
    return (
      <FramedAvatar
        avatarUri={avatarUri}
        frameUri={frameUri}
        avatarSize={CHAT_MSG_AVATAR_SIZE}
        fallbackLetter={fallbackLetter}
      />
    );
  }
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

type MediaDraft = {
  type: 'image' | 'voice' | 'video';
  uri: string;
  duration?: number;
  thumbnailUri?: string;
  dimensions?: { width: number; height: number };
};

type CatalogGift = NonNullable<React.ComponentProps<typeof ChatGiftBubble>['gift']>;

type ThreadRowProps = {
  item: ChatMessage;
  isMe: boolean;
  isPendingUpload: boolean;
  showAvatar: boolean;
  avatarUri?: string;
  frameUri?: string;
  fallbackLetter: string;
  avatarSpacerWidth: number;
  timeLocale: string;
  isRead: boolean;
  myUid?: string;
  peerDisplayName: string;
  replyLabels: { you: string; replyingTo: string; deletedMessage?: string };
  /** الرسالة الأصلية للاقتباس محذوفة — نعرض «رسالة محذوفة» */
  replyDeleted?: boolean;
  catalogGifts: CatalogGift[];
  onOpenFullImage: (url: string) => void;
  onOpenVideo: (url: string) => void;
};

/**
 * فقاعة رسالة memoized — لا يُعاد رندرها مع كل حرف في حقل الإدخال
 * ولا مع إعادة رندر شاشة الروم خلف المحادثة
 */
const ThreadMessageRow = React.memo(function ThreadMessageRow({
  item,
  isMe,
  isPendingUpload,
  showAvatar,
  avatarUri,
  frameUri,
  fallbackLetter,
  avatarSpacerWidth,
  timeLocale,
  isRead,
  myUid,
  peerDisplayName,
  replyLabels,
  replyDeleted = false,
  catalogGifts,
  onOpenFullImage,
  onOpenVideo,
}: ThreadRowProps) {
  const timeStr = new Date(item.createdAt).toLocaleTimeString(timeLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const meta = (
    <View style={styles.msgMetaRow}>
      <Text variant="caption" color="rgba(255,255,255,0.55)" style={{ fontSize: 10 }}>
        {timeStr}
      </Text>
      {isMe ? (
        isPendingUpload ? (
          <ActivityIndicator size={10} color="rgba(255,255,255,0.85)" />
        ) : (
          <MessageReadTicks isRead={isRead} />
        )
      ) : null}
    </View>
  );

  return (
    <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
      {!isMe && (
        showAvatar ? (
          <ChatMsgAvatar
            avatarUri={avatarUri}
            frameUri={frameUri}
            fallbackLetter={fallbackLetter}
          />
        ) : (
          <View style={[styles.msgAvatarSpacer, { width: avatarSpacerWidth }]} />
        )
      )}

      {item.type === 'call' ? (
        <View style={[styles.msgGiftContainer, isMe ? styles.msgGiftAlignEnd : styles.msgGiftAlignStart]}>
          <ChatCallBubble msg={item} isMine={isMe} onPress={() => {}} />
          {meta}
        </View>
      ) : item.type === 'gift' ? (
        <View style={[styles.msgGiftContainer, isMe ? styles.msgGiftAlignEnd : styles.msgGiftAlignStart]}>
          <ChatGiftBubble
            msg={item}
            gift={catalogGifts.find((g) => g.id === item.giftId) ?? null}
            isMine={isMe}
          />
          {meta}
        </View>
      ) : item.type === 'room_invite' || item.type === 'agency_invite' || item.type === 'party_invite' ? (
        <View>
          <ChatInviteCard msg={item} isMine={isMe} />
          {meta}
        </View>
      ) : item.type === 'game_invite' ? (
        <View>
          <ChatGameInviteCard msg={item} isMine={isMe} />
          {meta}
        </View>
      ) : (
        <Pressable
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
              myUid={myUid ?? ''}
              isMine={isMe}
              onOpenFullImage={onOpenFullImage}
              onOpenVideo={onOpenVideo}
            />
          ) : (
            <>
              {item.replyTo ? (
                <ChatReplyQuote
                  replyTo={item.replyTo}
                  peerName={peerDisplayName}
                  myUid={myUid}
                  isMine={isMe}
                  labels={replyLabels}
                  deleted={replyDeleted}
                />
              ) : null}
              <Text
                variant="bodySmall"
                color={isMe ? '#FFFFFF' : 'rgba(255,255,255,0.92)'}
                style={{ lineHeight: 22, fontSize: 14 }}
              >
                {item.text}
              </Text>
            </>
          )}
          {meta}
        </Pressable>
      )}

      {isMe && showAvatar ? (
        <ChatMsgAvatar
          avatarUri={avatarUri}
          frameUri={frameUri}
          fallbackLetter={fallbackLetter}
        />
      ) : null}
    </View>
  );
});

export type RoomChatThread = {
  conv: Conversation;
  otherUid: string;
  otherName: string;
  otherAvatar?: string;
};

type Props = {
  thread: RoomChatThread;
  currentRoomId?: string;
  onBack: () => void;
  onClose: () => void;
};

export function RoomEmbeddedChatThread({
  thread,
  currentRoomId,
  onBack,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const { gifts: catalogGifts, settings, vipSystem } = useConfig();
  const lang = i18n.language ?? 'ar';
  const timeLocale = lang.startsWith('ar') ? 'ar-SA' : 'en-US';
  const myUid = user?.uid;
  const otherUid = thread.otherUid;

  const myFrameUrl = useEquippedFrameUrl(myUid);
  const otherFrameUrl = useEquippedFrameUrl(otherUid);
  const { presenceMap, now: presenceNow } = usePresenceForUids(otherUid ? [otherUid] : []);

  const [conversationId, setConversationId] = useState<string | null>(thread.conv.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherUser, setOtherUser] = useState<UserDoc | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [peerRoom, setPeerRoom] = useState<UserPresence | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingSends, setPendingSends] = useState<ChatMessage[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [fullVideo, setFullVideo] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaOptions, setMediaOptions] = useState<MediaDraft | null>(null);
  const [pendingMediaUploads, setPendingMediaUploads] = useState<ChatMessage[]>([]);
  const [pendingMediaAction, setPendingMediaAction] = useState<(() => void) | null>(null);

  const listRef = useRef<FlatList>(null);
  const stickToBottomRef = useRef(true);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setInputText('');
    // ⚡ معرّف المحادثة حتمي (uid_uid مرتّبة) — يُثبَّت فوراً فيشترك مستمع الرسائل
    // مباشرة. كان الفتح ينتظر ٤ رحلات شبكة متسلسلة (الحظر ← المستخدم ← المحادثة
    // ← العلاقة) فتصل «صفحة التحميل» ٤٠ ثانية على الشبكات الضعيفة.
    const deterministicId =
      myUid && otherUid ? [myUid, otherUid].sort().join('_') : thread.conv.id;
    setConversationId(deterministicId);
    setOtherUser(null);
    setRelationship(null);

    void (async () => {
      try {
        // ضمان وجود وثيقة المحادثة + جلب العلاقة — في الخلفية، لا يحجبان الفتح
        void getOrCreateConversation(otherUid, thread.otherName, thread.otherAvatar ?? '')
          .catch(() => {});
        void getOrCreateRelationship(otherUid, thread.otherName, thread.otherAvatar ?? '')
          .then((rel) => {
            if (!cancelled) setRelationship(rel);
          })
          .catch(() => {});

        // ⚡ فحص الحظر وجلب المستخدم بالتوازي — كانا متسلسلين
        const [isBlocked, other] = await Promise.all([
          myUid ? isBlockedBetween(myUid, otherUid) : Promise.resolve(false),
          getUser(otherUid),
        ]);
        if (!cancelled) setBlocked(isBlocked);
        if (!cancelled && other) {
          const resolvedName = resolveDisplayName({ displayName: other.displayName, email: other.email });
          const resolvedAvatar = resolveUserDocAvatar(other as unknown as Record<string, unknown>, otherUid);
          setOtherUser({ ...other, displayName: resolvedName, avatar: resolvedAvatar });
        }
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [thread, myUid, otherUid]);

  useEffect(() => {
    if (!otherUid) return;
    return subscribeToUserPresence(otherUid, (presence) => {
      setPeerRoom(isTrackableAgencyPresence(presence) ? presence : null);
    });
  }, [otherUid]);

  useEffect(() => {
    if (!otherUid) return;
    return subscribeToUserProfile(otherUid, ({ lastSeen, avatar }) => {
      setOtherUser((prev) =>
        prev ? { ...prev, lastSeen, avatar: avatar || prev.avatar } : prev,
      );
    });
  }, [otherUid]);

  useEffect(() => {
    if (!conversationId || !otherUid) return;
    const unsub = subscribeToConversation(conversationId, (conv) => {
      setPeerLastReadAt(conv?.lastReadAt?.[otherUid] ?? 0);
    });
    return unsub;
  }, [conversationId, otherUid]);

  useEffect(() => {
    if (!conversationId) return;
    markConversationAsRead(conversationId, otherUid).catch(() => {});
    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      markConversationAsRead(conversationId, otherUid).catch(() => {});
      if (stickToBottomRef.current) scrollToLatest(false);
    });
    return unsub;
  }, [conversationId, otherUid, scrollToLatest]);

  useEffect(() => {
    if (pendingMediaUploads.length === 0) return;
    setPendingMediaUploads((prev) => {
      const next = prev.filter((pending) =>
        !messages.some(
          (m) =>
            !m.id.startsWith('temp-media-')
            && m.fromUid === pending.fromUid
            && m.type === pending.type
            && m.createdAt >= pending.createdAt - 3000,
        ),
      );
      return next.length === prev.length ? prev : next;
    });
  }, [messages, pendingMediaUploads.length]);

  // مطابقة التفاؤلية مع الحقيقية — نافذة زمنية + استهلاك رسالة حقيقية واحدة لكل
  // تفاؤلية (نفس إصلاح شاشة الشات الرئيسية: المطابقة بمفتاح المحتوى وحده كانت
  // تُسقط النسختين معاً عند إرسال رسالتين متتاليتين بنفس النص فيهتزّ الثريد)
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
          return false;
        }
        return true;
      });
    },
    [],
  );

  // أزل النصوص التفاؤلية بمجرد وصول الرسالة الحقيقية المقابلة عبر onSnapshot
  useEffect(() => {
    if (pendingSends.length === 0) return;
    setPendingSends((prev) => {
      const next = filterStillPending(prev, messages);
      return next.length === prev.length ? prev : next;
    });
  }, [messages, filterStillPending, pendingSends.length]);

  const displayMessages = useMemo(() => {
    let merged = messages;
    if (pendingSends.length > 0) {
      const stillPending = filterStillPending(pendingSends, messages);
      if (stillPending.length > 0) merged = [...merged, ...stillPending];
    }
    if (pendingMediaUploads.length > 0) {
      // ساعة الخادم (sortAt) حيث توفّرت — الترتيب بساعة الجهاز كان يخلط الرسائل
      const sortKey = (m: ChatMessage) =>
        ((m as ChatMessage & { sortAt?: number }).sortAt || m.createdAt || 0);
      merged = [...merged, ...pendingMediaUploads].sort((a, b) => sortKey(a) - sortKey(b));
    }
    return merged;
  }, [messages, pendingSends, pendingMediaUploads, filterStillPending]);

  // معرّفات الرسائل المحمّلة — اقتباس الرد يعرض «رسالة محذوفة» إذا حُذفت الأصلية
  const loadedMessageIds = useMemo(
    () => new Set(messages.map((m) => m.id)),
    [messages],
  );

  const isMessageReadByPeer = useCallback(
    (msg: ChatMessage) =>
      msg.isRead === true || (msg.createdAt > 0 && msg.createdAt <= peerLastReadAt),
    [peerLastReadAt],
  );

  const otherAvatarUri = resolveUserDocAvatar(
    otherUser as unknown as Record<string, unknown>,
    otherUid,
  );
  const peerDisplayName = resolveDisplayName({ displayName: otherUser?.displayName ?? thread.otherName });
  const lastSeenMs = resolveLastSeenMs(otherUser?.lastSeen, presenceMap[otherUid]);
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
            time: formatLastSeenTime(lastSeenMs, lang, t, presenceNow),
          })
        : t('common.offline');
  const userAge = otherUser?.birthYear
    ? new Date().getFullYear() - otherUser.birthYear
    : null;

  const peerInSameRoom = Boolean(
    currentRoomId && peerRoom?.currentRoomId && peerRoom.currentRoomId === currentRoomId,
  );
  const peerInOtherRoom = Boolean(
    peerRoom?.currentRoomId && peerRoom.currentRoomId !== currentRoomId,
  );

  const handlePeerRoomPress = () => {
    if (!peerRoom?.currentRoomId) return;
    if (peerInSameRoom) return;
    if (currentRoomId) {
      showAlert({
        type: 'info',
        title: t('room.cannotJoinOtherRoomTitle'),
        message: t('room.cannotJoinOtherRoomWhileInRoom'),
      });
      return;
    }
    router.push(`/room/${peerRoom.currentRoomId}` as never);
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !conversationId || blocked || !myUid) return;
    setInputText('');

    // ⚡ إرسال تفاؤلي: الرسالة تظهر لحظياً والشبكة تعمل بالخلفية —
    // لا قفل للزر، فيمكن إرسال عدة رسائل متتالية بسرعة
    const tempId = `temp-send-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      fromUid: myUid,
      toUid: otherUid,
      text,
      type: 'text',
      createdAt: Date.now(),
      isRead: false,
    };
    setPendingSends((prev) => [...prev, optimistic]);
    stickToBottomRef.current = true;
    scrollToLatest(true);

    void (async () => {
      try {
        await sendChatMessage(conversationId, otherUid, text);
      } catch (e: unknown) {
        setPendingSends((prev) => prev.filter((m) => m.id !== tempId));
        setInputText((cur) => cur || text);
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'BLOCKED') {
          setBlocked(true);
          showAlert({ type: 'error', title: t('common.error'), message: t('chat.blockedNotice') });
        } else {
          showAlert({
            type: 'error',
            title: t('common.error'),
            message: msg || t('chat.messageSendFailed'),
          });
        }
      }
    })();
  };

  const runPendingMediaAction = () => {
    if (pendingMediaAction) {
      const action = pendingMediaAction;
      setPendingMediaAction(null);
      action();
    }
  };

  const chooseMedia = (action: () => void) => {
    setPendingMediaAction(() => action);
    setShowMediaPicker(false);
  };

  const handlePickImage = async (fromCamera: boolean) => {
    if (!conversationId) return;
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert({ type: 'warning', title: t('chat.permRequired'), message: t('chat.permAccess') });
        return;
      }
      // الحارس يمنع إفراغ المقعد أثناء فتح المعرض/الكاميرا (التطبيق يذهب للخلفية)
      const { withRoomMediaPickerGuard } = await import('@/utils/roomMediaPickerGuard');
      const result = await withRoomMediaPickerGuard(() =>
        fromCamera
          ? ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
          : ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
              allowsEditing: true,
            }),
      );
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setMediaOptions({
        type: 'image',
        uri: asset.uri,
        dimensions: { width: asset.width ?? 0, height: asset.height ?? 0 },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('chat.imagePickFailed');
      showAlert({ type: 'error', title: t('chat.sendFailed'), message: msg });
    }
  };

  const handlePickVideo = async () => {
    if (!conversationId) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert({ type: 'warning', title: t('chat.permRequired'), message: t('chat.permAccess') });
        return;
      }
      // الحارس يمنع إفراغ المقعد أثناء فتح المعرض (التطبيق يذهب للخلفية)
      const { withRoomMediaPickerGuard } = await import('@/utils/roomMediaPickerGuard');
      const result = await withRoomMediaPickerGuard(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 0.7,
          videoMaxDuration: 120,
        }),
      );
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      let thumbnailUri: string | undefined;
      try {
        const VT = await import('expo-video-thumbnails');
        const { uri } = await VT.getThumbnailAsync(asset.uri, { time: 1000 });
        thumbnailUri = uri;
      } catch {
        // optional
      }
      setMediaOptions({
        type: 'video',
        uri: asset.uri,
        duration: asset.duration ? asset.duration / 1000 : undefined,
        thumbnailUri,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('chat.videoPickFailed');
      showAlert({ type: 'error', title: t('chat.sendFailed'), message: msg });
    }
  };

  const handleSendVoice = (uri: string, durationSec: number) => {
    if (!conversationId) return;
    setMediaOptions({ type: 'voice', uri, duration: durationSec });
  };

  const handleSendMedia = (opts: MediaSendOptions) => {
    if (!mediaOptions || !conversationId || !myUid) return;
    const snapshot = { ...mediaOptions };
    setMediaOptions(null);

    const tempId = `temp-media-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const now = Date.now();
    const isSpecial = opts.isLocked || opts.enableTimer;

    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      fromUid: myUid,
      toUid: otherUid,
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
            await sendImageMessage(conversationId, otherUid, snapshot.uri, snapshot.dimensions);
          } else if (snapshot.type === 'voice') {
            await sendVoiceMessage(conversationId, otherUid, snapshot.uri, snapshot.duration ?? 0);
          } else {
            await sendLockedMediaMessage({
              conversationId,
              toUid: otherUid,
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
            toUid: otherUid,
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
      } catch (e: unknown) {
        setPendingMediaUploads((prev) => prev.filter((m) => m.id !== tempId));
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'BLOCKED') {
          setBlocked(true);
          showAlert({ type: 'error', title: t('common.error'), message: t('chat.blockedNotice') });
        } else {
          showAlert({
            type: 'error',
            title: t('common.error'),
            message: msg || t('chat.messageSendFailed'),
          });
        }
      }
    })();
  };

  const replyLabels = useMemo(
    () => ({
      you: t('chat.replyYou'),
      replyingTo: t('chat.replyingTo'),
      deletedMessage: t('chat.replyDeletedMessage'),
    }),
    [t],
  );

  const initial = (thread.otherName ?? '?').trim().charAt(0) || '★';
  const grad = gradFor(thread.otherUid);

  const listHeader = (
    <View style={styles.profileSection}>
      {otherUser && !isSupportAccount(otherUid) ? (
        <ChatProfileCard
          displayName={peerDisplayName}
          avatarUri={otherAvatarUri}
          points={relationship?.intimacyPoints ?? 0}
          countryCode={otherUser.country}
          age={userAge}
          gender={otherUser.gender}
          showVerified
          inVoiceRoom={Boolean(peerRoom?.currentRoomId)}
          onPressMain={() => router.push(`/profile/${otherUid}` as never)}
          onPressAvatarRoom={
            peerRoom?.currentRoomId ? handlePeerRoomPress : undefined
          }
          onPressRocket={() => router.push(`/relationships?userId=${otherUid}` as never)}
        />
      ) : null}

      {peerInSameRoom ? (
        <View style={styles.sameRoomPill}>
          <Text variant="caption" color="#86EFAC" weight="semibold">
            {t('room.peerInSameRoom')}
          </Text>
        </View>
      ) : peerInOtherRoom ? (
        <AgencyRoomJoinBanner
          roomName={peerRoom?.roomName || t('chat.agencyRoomFallback')}
          onPressJoin={handlePeerRoomPress}
        />
      ) : null}

      <RNText style={[styles.onlineHint, isOnline && styles.onlineHintLive]}>
        {presenceLabel}
      </RNText>
    </View>
  );

  return (
    <View style={styles.threadRoot}>
      <View style={styles.threadHeader}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}>
          <ChevronLeft
            size={20}
            color="#fff"
            style={RTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </Pressable>
        <View style={styles.threadHeaderCenter}>
          <LinearGradient colors={grad} style={styles.threadHeaderAvatar}>
            {thread.otherAvatar ? (
              <Image
                source={{ uri: thread.otherAvatar }}
                style={styles.threadHeaderAvatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={styles.avatarLetter}>{initial}</Text>
            )}
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.threadHeaderName} numberOfLines={1}>{thread.otherName}</Text>
            <Text style={styles.threadHeaderHint} numberOfLines={1}>
              {presenceLabel}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
          <X size={18} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={lu.colors.gold} style={{ marginVertical: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={displayMessages}
          keyExtractor={(m) => m.id}
          style={styles.threadList}
          contentContainerStyle={styles.threadListContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          onContentSizeChange={() => {
            if (stickToBottomRef.current) scrollToLatest(false);
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const distanceFromBottom =
              contentSize.height - layoutMeasurement.height - contentOffset.y;
            stickToBottomRef.current = distanceFromBottom < 80;
          }}
          scrollEventThrottle={32}
          removeClippedSubviews
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={7}
          renderItem={({ item, index }) => {
            const isMe = item.fromUid === myUid;
            const avatarFrameUrl = isMe ? myFrameUrl : otherFrameUrl;
            return (
              <ThreadMessageRow
                item={item}
                isMe={isMe}
                isPendingUpload={item.id.startsWith('temp-')}
                showAvatar={
                  index === 0 || displayMessages[index - 1]?.fromUid !== item.fromUid
                }
                avatarUri={isMe ? user?.profile.avatar : otherAvatarUri}
                frameUri={avatarFrameUrl}
                fallbackLetter={
                  isMe
                    ? (user?.profile.displayName ?? '?')
                    : (otherUser?.displayName ?? thread.otherName ?? '?')
                }
                avatarSpacerWidth={
                  avatarFrameUrl ? getFramedAvatarContainerSize(CHAT_MSG_AVATAR_SIZE) : 28
                }
                timeLocale={timeLocale}
                isRead={isMessageReadByPeer(item)}
                myUid={myUid}
                peerDisplayName={peerDisplayName}
                replyLabels={replyLabels}
                replyDeleted={
                  item.replyTo ? !loadedMessageIds.has(item.replyTo.messageId) : false
                }
                catalogGifts={catalogGifts}
                onOpenFullImage={setFullImage}
                onOpenVideo={setFullVideo}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.threadEmpty}>
              <MessageCircle size={32} color="rgba(255,255,255,0.25)" />
              <Text variant="caption" color="rgba(255,255,255,0.45)" style={{ marginTop: 8 }}>
                {t('chat.startConversation')}
              </Text>
            </View>
          }
        />
      )}

      {blocked ? (
        <View style={styles.blockedBanner}>
          <Text variant="caption" color="#FCA5A5" style={{ textAlign: 'center' }}>
            {t('chat.blockedNotice')}
          </Text>
        </View>
      ) : (
        <View style={styles.composer}>
          {!voiceRecording ? (
            <Pressable
              onPress={() => setShowMediaPicker(true)}
              style={styles.mediaBtn}
              hitSlop={6}
            >
              <Plus size={20} color="rgba(255,255,255,0.75)" strokeWidth={2.4} />
            </Pressable>
          ) : null}

          {!voiceRecording ? (
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('chat.typeMessage')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.composerInput}
              multiline
              maxLength={500}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {inputText.trim() && !voiceRecording ? (
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
            >
              <LuSendIcon size={20} color="#fff" filled />
            </Pressable>
          ) : (
            <VoiceRecorder
              onRecorded={handleSendVoice}
              onRecordingChange={setVoiceRecording}
              variant={voiceRecording ? 'bar' : 'fab'}
              color={TAB_DESIGN.purple}
            />
          )}
        </View>
      )}

      <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}>
        <Pressable style={styles.fullMediaBg} onPress={() => setFullImage(null)}>
          {fullImage ? (
            <Image source={{ uri: fullImage }} style={styles.fullImage} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={!!fullVideo} transparent animationType="fade" onRequestClose={() => setFullVideo(null)}>
        <Pressable style={styles.fullMediaBg} onPress={() => setFullVideo(null)}>
          {fullVideo ? <FullVideoPlayer uri={fullVideo} /> : null}
        </Pressable>
      </Modal>

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
            <Text weight="bold" style={{ fontSize: 16, color: lu.colors.ink, textAlign: 'center' }}>
              {t('chat.sendMedia')}
            </Text>
            <View style={styles.pickerOptions}>
              <Pressable style={styles.pickerOption} onPress={() => chooseMedia(() => void handlePickImage(true))}>
                <Camera size={22} color={lu.colors.pink} />
                <Text style={styles.pickerOptionText}>{t('chat.camera')}</Text>
              </Pressable>
              <Pressable style={styles.pickerOption} onPress={() => chooseMedia(() => void handlePickImage(false))}>
                <Images size={22} color={lu.colors.blue} />
                <Text style={styles.pickerOptionText}>{t('chat.gallery')}</Text>
              </Pressable>
              <Pressable style={styles.pickerOption} onPress={() => chooseMedia(() => void handlePickVideo())}>
                <Video size={22} color={lu.colors.purple} />
                <Text style={styles.pickerOptionText}>{t('call.video')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {mediaOptions ? (
        <MediaOptionsModal
          visible={!!mediaOptions}
          onClose={() => setMediaOptions(null)}
          mediaType={mediaOptions.type}
          mediaPreviewUri={mediaOptions.thumbnailUri ?? mediaOptions.uri}
          duration={mediaOptions.duration}
          onSend={handleSendMedia}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  threadRoot: { flex: 1 },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },
  threadHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  threadHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  threadHeaderAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  threadHeaderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: lu.fonts.bodySemi,
  },
  threadHeaderHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: lu.fonts.body,
    marginTop: 2,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    marginBottom: 12,
    gap: 8,
  },
  sameRoomPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  onlineHint: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: lu.fonts.body,
  },
  onlineHintLive: {
    color: '#86EFAC',
    fontWeight: '600',
  },
  threadList: { flex: 1 },
  threadListContent: { paddingVertical: 8, flexGrow: 1 },
  threadEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  msgRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: CHAT_MSG_AVATAR_SIZE,
    height: CHAT_MSG_AVATAR_SIZE,
    borderRadius: CHAT_MSG_AVATAR_SIZE / 2,
  },
  msgAvatarSpacer: {
    width: CHAT_MSG_AVATAR_SIZE,
    height: CHAT_MSG_AVATAR_SIZE,
  },
  msgBubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  msgBubbleMe: {
    backgroundColor: 'rgba(225, 20, 20, 0.85)',
    borderBottomStartRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomEndRadius: 4,
  },
  msgBubbleUploading: { opacity: 0.75 },
  msgGiftContainer: { maxWidth: '82%' },
  msgGiftAlignEnd: { alignSelf: 'flex-end' },
  msgGiftAlignStart: { alignSelf: 'flex-start' },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  blockedBanner: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  mediaBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: lu.fonts.body,
    textAlign: RTL ? 'right' : 'left',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullMediaBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: { width: '100%', height: '80%' },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 16,
    paddingBottom: 28,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: 12,
  },
  pickerOptions: { marginTop: 16, gap: 10 },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.background.secondary,
  },
  pickerOptionText: {
    fontSize: 15,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodySemi,
    fontWeight: '600',
  },
});
