/**
 * LinkUp App — Voice Room Screen v2
 * تصميم جديد يطابق Sada/Greedy:
 * - المضيف في الوسط
 * - 4-9 مقاعد حول
 * - Waveforms على الجوانب
 * - Bottom Sheet للأدوات
 * - مربوط بالكامل بـ Firebase
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeepAwake } from 'expo-keep-awake';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Modal,
  BackHandler,
  ActivityIndicator,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
  useWindowDimensions,
  InteractionManager,
  I18nManager,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as LucideIcons from 'lucide-react-native';
import {
  Mic,
  MicOff,
  Gift,
  Heart,
  Send,
  Power,
  Trophy,
  Crown,
  Sparkles,
  MessageCircle,
  Plus,
  Smile,
  Megaphone,
  Flame,
  Users,
  X,
  MoreHorizontal,
  ChevronLeft,
  Gamepad2,
  Share2,
  Music,
  Bell,
  Eraser,
  Award,
  ShoppingBag,
  Sticker,
  Mic2,
  Settings as SettingsIcon,
  Check,
} from 'lucide-react-native';

import { Text, RealCountryFlag, GiftAnimation, GiftVisual, RoomSeat, EmojiPicker } from '@/components/ui';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { RoomStageBackground } from '@/components/room/RoomStageBackground';
import { RoomLiveHeader } from '@/components/room/RoomLiveHeader';
import { RoomBottomToolbar, ROOM_TOOLBAR_ROW_H } from '@/components/room/RoomBottomToolbar';
import { sumPrivateUnreadCount } from '@/components/room/RoomPrivateMessagesModal';
import { RoomPartyIcon } from '@/components/room/RoomDesignIcons';
import {
  subscribeToConversations,
  type Conversation,
} from '@/services/firebase/chat';
import {
  RoomPkTypeSheet,
  RoomPkSetupSheet,
  RoomPkBattleOverlay,
  RoomPkMatchingSheet,
  RoomPkChallengePopup,
} from '@/components/room/RoomPk';
import {
  subscribeToRoomPk,
  startInRoomPK,
  endRoomPK,
  recordPKGift,
  isPkActive,
  getPkTeamForSeat,
  type RoomPkState,
  type PkDuration,
} from '@/services/firebase/roomPk';
import {
  startPkAgencyMatchSearch,
  cancelPkAgencyMatchSearch,
  subscribeToPkMatchRequest,
  subscribeToSentPkInvites,
  subscribeToPendingPkInvitePopup,
  type PkMatchRequest,
  type PkAgencyInvite,
} from '@/services/firebase/roomPkMatching';
import { BackChevron } from '@/components/ui/RtlChevron';
import { resolveDisplayName } from '@/utils/displayName';
import { getUserPrivacy } from '@/utils/privacyDisplay';
import { friendlyErrorMessage } from '@/utils/friendlyErrorMessage';
import { resolveOfficialUserAvatar } from '@/utils/userAvatar';
import { prefetchAvatarUris } from '@/utils/imageConfig';
import { resolveAgencyLogoImage } from '@/utils/agencyBubbleImage';
import {
  effectiveCanJoinHostSeat,
  effectiveCanOccupyHostSeat,
  staffCanReviewRoom,
  resolveRoomCountry,
} from '@/types/platformStaff';
import { useAuth } from '@/hooks/useAuth';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import {
  subscribeToRoom,
  subscribeToRoomMessages,
  subscribeToRooms,
  joinSeat,
  leaveSeat,
  ensureHostOnSeat,
  releaseRoomMembership,
  GUEST_MIC_MEMBERSHIP_REQUIRED,
  pinRoomSession,
  rebindRoomOnDisconnectHandlers,
  recoverRoomPresenceAfterRtdbReconnect,
  changeSeat,
  toggleMute,
  joinAudience,
  getMyRoomAudienceJoinedAt,
  derivePresenceCount,
  subscribeToAudience,
  subscribeToRoomAudienceUids,
  type RoomAudienceMember,
  leaveAudience,
  sendMessage,
  sendEmojiMessage,
  sendGiftInRoom,
  updateRoomGiftMessage,
  incrementRoomGiftTotal,
  clearRoomChatHistory,
  primeRoomSenderProfile,
  type RoomSenderProfile,
  endRoom,
  archiveRoom,
  isAgencyLiveRoom,
  isRoomLive,
  kickUserFromRoom,
  hostRemoveUserFromMic,
  hostToggleUserMicMute,
  hostToggleUserChatMuted,
  isRoomChatMuted,
  setSeatLocked,
  isSeatLocked,
  syncUserSeatLevelInRoom,
  SECOND_HOST_SEAT_INDEX,
  canOccupySecondHostSeat,
  type Room,
  type RoomMessage,
} from '@/services/firebase/rooms';
import {
  inviteUserToAgencyWithNotification,
  subscribeToAgencyMembers,
  subscribeToMyReceivedAgencyInvites,
  acceptDirectAgencyInvite,
  rejectDirectAgencyInvite,
  removeAgencyMember,
  userHasAgencyMembership,
  type AgencyMember,
  type AgencyInvite,
} from '@/services/agencyService';
import { RoomPasswordGateModal } from '@/components/room/RoomPasswordGateModal';
import {
  isRoomPasswordVerified,
  markRoomPasswordVerified,
  verifyRoomPassword,
} from '@/services/roomEntryGate';
import { enterAgencyRoomAndNavigate } from '@/utils/navigateToRoom';
import { getAgencies, type Agency } from '@/services/firebase/social';
import { getUserReportPath } from '@/services/firebase/reports';
import { RoomEntryWelcomeBanner } from '@/components/room/RoomEntryWelcomeBanner';
import { AgencyRoomEntryChatMessage } from '@/components/room/AgencyRoomEntryChatMessage';
import { AgencyEmptySeatSheet } from '@/components/room/AgencyEmptySeatSheet';
import { SeatInviteModal } from '@/components/room/SeatInviteModal';
import { RoomEntryVideoOverlay } from '@/components/room/RoomEntryVideoOverlay';
import { RoomVoiceSessionGuard } from '@/components/room/RoomVoiceSessionGuard';
import { RoomFlyingMessages } from '@/components/room/RoomFlyingMessages';
import { sendFlyingMessage } from '@/services/firebase/roomFlyingMessages';
import { resolveEntrySoundUrl } from '@/services/firebase/svipPerks';
import { configureSoundEffectsAudio, playGiftSound, warmGiftSoundEngine, preloadGiftSound, stopRoomSound, warmRoomSoundEffectsCatalog } from '@/utils/playRoomSound';
import { ROOM_SOUND_EFFECTS, type SoundEffectId } from '@/constants/roomSoundEffectsCatalog';
import { playSoundEffectLocal, triggerSoundEffect } from '@/services/roomSoundEffects';
import { ShareToChatModal, type ShareInviteItem } from '@/components/chat/ShareToChatModal';
import { type Gift as GiftType, buyAndSendGift } from '@/services/firebase/shop';
import { type GiftPickerRecipient } from '@/components/chat/ChatGiftPickerModal';
import { RoomGiftChatLine } from '@/components/room/RoomGiftChatLine';
import { RoomGiftPickerModal } from '@/components/room/RoomGiftPickerModal';
import {
  setUserInRoom,
  clearUserFromRoom,
  recordRoomVisit,
  notifyFollowersOfRoomEntry,
  favoriteRoom,
  unfavoriteRoom,
  isRoomFavorited,
} from '@/services/roomFeatures';
import { useConfig } from '@/contexts/ConfigContext';
import { hasVipPrivilege, resolveVipPrivilegeAsset, userHasVipFeature } from '@/services/firebase/vipSystem';
import { currentMonthKey } from '@/services/firebase/agencyPrinceSystem';
import { resolveGiftAnimationPayload } from '@/components/ui/giftUtils';
import { preloadVideoBackground } from '@/utils/videoCacheManager';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { useAlert } from '@/components/ui';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';

// === ميزات الفيديو + الرسائل المثبتة ===
import { RoomUserSheet, type RoomSeatUser } from '@/components/room/RoomUserSheet';
import { ConnectedUsersSheet, type ConnectedUserRow } from '@/components/room/ConnectedUsersSheet';
import { RoomInformationModal, type RoomInfoMemberRow } from '@/components/room/RoomInformationModal';
import { RoomSettingsSheet } from '@/components/room/RoomSettingsSheet';
import { RoomVideoPlayer } from '@/components/room/RoomVideoPlayer';
import { RoomMusicSheet } from '@/components/room/RoomMusicSheet';
import { RoomMusicPlaybackHost } from '@/components/room/RoomMusicPlaybackHost';
import { waitAfterSheetDismiss } from '@/services/roomMusicUpload';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { useRoomVideoUiStore } from '@/stores/roomVideoUiStore';
import { VideoAddModal } from '@/components/room/VideoAddModal';
import { RoomVideoApprovalModal } from '@/components/room/RoomVideoApprovalModal';
import { PinnedMessagesBanner, PinCustomMessageModal } from '@/components/room/PinnedMessagesBanner';
import {
  getAgencyRoomWelcomeBody,
  getAgencyRoomWelcomeTitle,
} from '@/constants/agencyRoomWelcome';
import { MessageActionSheet } from '@/components/room/MessageActionSheet';
import { subscribeToRoomVideo, type RoomVideo, isAgencyManagerForRoom } from '@/services/roomVideo';
import {
  subscribeToPendingVideoRequests,
  subscribeToMyLatestVideoRequest,
  type RoomVideoRequest,
} from '@/services/roomVideoRequests';
import { subscribeToRoomMusic, removeMusicFromRoom, type RoomMusic } from '@/services/roomMusic';
import { clearSessionMusicLibrary } from '@/services/roomMusicLibrary';
import { subscribeToPinnedMessages, type PinnedMessage } from '@/services/roomPins';
import { ThrowLuckyBagModal } from '@/components/room/ThrowLuckyBagModal';
import { LuckyBagPopup } from '@/components/room/LuckyBagPopup';
import { subscribeToLuckyBags, type LuckyBag } from '@/services/luckyBag';
import { RoomRocketModal } from '@/components/room/RoomRocketModal';
import { RoomRocketLaunchAnimation } from '@/components/room/RoomRocketLaunchAnimation';
import { RoomBottomSheet } from '@/components/room/RoomBottomSheet';
import {
  subscribeToRoomRocketLaunches,
  subscribeToRoomRocketProgress,
  recordRocketGiftContribution,
  isRocketLaunchActive,
  type RoomRocketLaunch,
  type RoomRocketProgress,
} from '@/services/roomRocket';
import { recordRoomGiftContribution, recordRoomGiftSupportReceived, subscribeToRoomSeatSupport } from '@/services/roomContributions';
import { RoomContributionsModal } from '@/components/room/RoomContributionsModal';
import { RoomThroneSeat } from '@/components/room/RoomThroneSeat';
import { RoomThroneModal } from '@/components/room/RoomThroneModal';
import {
  subscribeToRoomThrone,
  subscribeToMyThroneContribution,
  recordThroneGiftContribution,
  type RoomThroneState,
} from '@/services/roomThrone';
import { isAgencyRoomThroneActive, isAgencyRoomThroneUnlocked } from '@/services/firebase/roomThroneConfig';
import {
  syncAgencyPeriodLevelToRoom,
  subscribeToAgencyById,
  type Agency as LinkedAgency,
} from '@/services/agencyService';
import { AGENCY_THRONE_UNLOCK_LEVEL } from '@/services/agencyLevels';
import { SoundEffectsPlayer } from '@/components/room/SoundEffectsPanel';
import { VoiceMicPanel } from '@/components/room/VoiceMicModal';
import { RoomJoinMicModal } from '@/components/room/RoomJoinMicModal';
import { RoomEffectsModal } from '@/components/room/RoomEffectsModal';
import {
  subscribeToRoomEffectsSettings,
  loadPersonalEffectsPrefs,
  DEFAULT_ROOM_EFFECTS,
  DEFAULT_PERSONAL_EFFECTS,
  shouldPlayGiftAnimation,
  shouldPlayEntryAnimation,
  shouldPlayRoomSoundEffects,
  type RoomEffectsSettings,
  type PersonalEffectsPrefs,
} from '@/services/roomEffects';
import { RoomKickBanModal, type KickBanChoice } from '@/components/room/RoomKickBanModal';
import {
  useRoomSessionStore,
  isRoomSessionPinned,
} from '@/stores/roomSessionStore';
import { roomAudioSession, prefetchRoomAudio } from '@/services/roomAudioSession';
import { syncPinnedRoomListenAudio, resyncRoomAudioAfterResume } from '@/services/pinnedRoomAudio';
import { completeRoomLeave } from '@/services/roomLeave';
import { stopRoomMusicPlayback } from '@/services/roomMusicPlaybackManager';
import { cleanupRoomMediaOnLeave } from '@/services/roomMediaCleanup';
import { EndRoomModal } from '@/components/room/EndRoomModal';
import { ROOM_EMOJI_ON_SEAT_MS, ROOM_REACTION_CHAT_SIZE } from '@/constants/roomEmoji';
import { parseRoomReactionDisplay } from '@/utils/roomReactionValue';
import { RoomReactionDisplay } from '@/components/room/RoomReactionDisplay';
import { isFollowing } from '@/services/firebase/follow';
import { subscribeToRoomFrames, type RoomFrame } from '@/services/firebase/roomDecor';
import { fetchEquippedFrameUrlsForUsers } from '@/services/firebase/userFrames';
import { fetchChatUserMetaForUsers, type ChatUserMeta } from '@/services/firebase/userBubbles';
import { subscribeToStoreItems, storeItemMediaUrl, type StoreItem } from '@/services/firebase/storeConfig';
import { resolveRoomEntryForUser, isVideoMediaUrl, resolveStaffEntryBadgeUrl } from '@/services/firebase/userEntrances';
import { parseStaffFromUserData } from '@/types/platformStaff';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { FramedMessageBubble, prefetchMessageBubbleUris } from '@/components/chat/FramedMessageBubble';
import { RoomChatMessageText } from '@/components/room/RoomChatMessageText';
import { buildRoomMentionInsert, sanitizeMentionTextForSend, buildRoomMentionIndex } from '@/utils/mentions';
import { getUser, type UserDoc } from '@/services/firebase/users';
import { RoomToolsSheet, type RoomToolAction } from '@/components/room/RoomToolsSheet';
import { RoomResetMicSupportModal, type MicSupportResetMember } from '@/components/room/RoomResetMicSupportModal';
import { RoomFreeGameWebView } from '@/components/room/RoomFreeGameWebView';
import { RoomFreeGameStartSheet } from '@/components/room/RoomFreeGameStartSheet';
import { RoomGameInvitePopup } from '@/components/room/RoomGameInvitePopup';
import { RoomMicInvitePopup } from '@/components/room/RoomMicInvitePopup';
import { RoomAgencyInvitePopup } from '@/components/room/RoomAgencyInvitePopup';
import { RoomGameInviteChatCard } from '@/components/room/RoomGameInviteChatCard';
import { getRoomFreeGame, type RoomFreeGameId } from '@/constants/roomFreeGames';
import { createRoomGameSession, joinRoomGameSession } from '@/services/firebase/roomGameSessions';
import {
  subscribePendingRoomGameInvites,
  resolveRoomGameInvite,
  clearRoomGameInvite,
  type RoomGameInvite,
} from '@/services/firebase/roomGameInvites';
import {
  sendRoomMicInvite,
  subscribePendingRoomMicInvites,
  acceptRoomMicInvite,
  resolveRoomMicInvite,
  clearRoomMicInvite,
  type RoomMicInvite,
} from '@/services/firebase/roomMicInvites';
import {
  parseRoomPermissions,
  subscribeToRoomMemberRoles,
  resolveRoomAudienceKind,
  hasRoomFeaturePermission,
  canTakeMicSeat,
  resolveSupervisorPermissions,
  canUserManageRoomSettings,
  canUserManageRoomBlocks,
  canAgencyManageTarget,
  setRoomAgencyMemberRole,
  type RoomAgencyMemberRole,
} from '@/services/firebase/roomMemberRoles';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// ارتفاع شيت الإيموجي — نسبي وأصغر حتى لا يغطّي مقاعد المايك (يطفو فوق الشات فقط).
const EMOJI_SHEET_HEIGHT = Math.round(Math.min(320, SCREEN_H * 0.38));
const GIFT_SEND_CONCURRENCY = 2;

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx]!, idx);
    }
  });
  await Promise.all(workers);
}

export default function RoomScreen() {
  // #4: إبقاء الشاشة مضاءة طوال وجود المستخدم داخل الغرفة الصوتية
  useKeepAwake('room-active');
  // خلفية الغرفة داكنة — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t, i18n } = useTranslation();
  // اتجاه حسب اللغة: RTL للعربية (مقعد 1 على اليمين)، LTR للإنجليزية.
  const isAr = i18n.language?.startsWith('ar');
  const rowDir = ('row') as 'row' | 'row-reverse';
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigateAfterLeaveRoom = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  }, [router]);

  /** خروج من شاشة الروم مع إبقاء الجلسة عائمة (ابقَ في الروم) */
  const navigateAwayWhilePinned = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/home' as any);
  }, [router]);

  const { user, refreshUser } = useAuth();

  const performCompleteLeave = useCallback(async () => {
    if (!roomId || leavingRoomRef.current) return;
    leavingRoomRef.current = true;
    keepRoomAliveRef.current = false;
    await completeRoomLeave(roomId, user?.uid);
  }, [roomId, user?.uid]);

  const leaveRoomAndNavigate = useCallback(() => {
    if (!roomId || leavingRoomRef.current) return;
    leavingRoomRef.current = true;
    keepRoomAliveRef.current = false;
    // اقفل السماع فوراً قبل أي تنقّل حتى لا يتسرّب صوت الروم خارج الشاشة.
    useRoomSessionStore.getState().setListenMuted(true);
    roomAudioSession.setRemoteAudioMuted(true);
    void (async () => {
      await stopRoomMusicPlayback().catch(() => {});
      if (roomId && user?.uid) {
        const { clearSessionMusicLibrary } = await import('@/services/roomMusicLibrary');
        clearSessionMusicLibrary(roomId, user.uid);
      }
      navigateAfterLeaveRoom();
      await completeRoomLeave(roomId, user?.uid);
      leavingRoomRef.current = false;
    })();
  }, [roomId, user?.uid, navigateAfterLeaveRoom]);

  useFocusEffect(
    useCallback(() => {
      leavingRoomRef.current = false;
      return () => {
        // أغلق قائمة الأدوات عند مغادرة التركيز — مودالها الأصلي يطفو فوق أي
        // شاشة تالية (تعديل الروم مثلاً) ويعلق كطبقة لا تستجيب للمس.
        setShowTools(false);
        // لا نغادر الروم تلقائياً عند blur (مثل فتح مشاركة/وسائط/تنقّل مؤقت)
        // المغادرة الكاملة يجب أن تكون صريحة فقط (زر خروج/طرد/تبديل روم).
        if (!roomId) return;
        // عند "احتفظ" يجب استمرار السماع بدون كتم حتى لا يظهر تأخير/انقطاع صوت.
        if (keepRoomAliveRef.current) return;
        roomAudioSession.setRemoteAudioMuted(true);
      };
    }, [roomId]),
  );
  const insets = useSafeAreaInsets();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  const bottomBarHeight = useMemo(() => {
    if (toolbarHeight > 0) return toolbarHeight;
    const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 6);
    return spacing.sm + ROOM_TOOLBAR_ROW_H + safeBottom;
  }, [toolbarHeight, insets.bottom]);
  const toggleDockCollapsed = useCallback(() => {
    setDockCollapsed((prev) => {
      if (!prev) {
        setShowEmoji(false);
        setShowVoiceModal(false);
        chatInputRef.current?.blur();
      }
      return !prev;
    });
  }, []);
  const dismissChatInput = useCallback(() => {
    setShowEmoji(false);
    chatInputRef.current?.blur();
    Keyboard.dismiss();
    setChatInputFocused(false);
  }, []);
  const closeBottomPanels = useCallback(() => {
    setShowEmoji(false);
    setShowVoiceModal(false);
    dismissChatInput();
  }, [dismissChatInput]);
  const { showAlert, showToast } = useAlert();
  // كتالوج الهدايا الديناميكي (من Firestore عبر ConfigContext — قابل لتعديل الأدمن)
  const { gifts: GIFTS_CATALOG, giftCategories, roomThrone: throneConfig, agencyPrince, vipSystem, aristocracy, roomReactions } = useConfig();

  const [room, setRoom] = useState<Room | null>(null);
  const [agencyRoomBg, setAgencyRoomBg] = useState<string | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  /** لا يُعرض شات قبل وقت دخول المستخدم للغرفة */
  const [chatSinceMs, setChatSinceMs] = useState<number | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [giftInitialRecipientUid, setGiftInitialRecipientUid] = useState<string | null>(null);
  const [volumeMuted, setVolumeMuted] = useState(
    () => useRoomSessionStore.getState().listenMuted,
  );
  const setRoomVolumeMuted = useCallback((muted: boolean) => {
    setVolumeMuted(muted);
    useRoomSessionStore.getState().setListenMuted(muted);
    roomAudioSession.setRemoteAudioMuted(muted);
  }, []);
  const toggleRoomVolume = useCallback(() => {
    setRoomVolumeMuted(!volumeMuted);
  }, [volumeMuted, setRoomVolumeMuted]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [seatUser, setSeatUser] = useState<RoomSeatUser | null>(null);
  const [welcomeEntry, setWelcomeEntry] = useState<{
    name: string;
    key: number;
    isPrince?: boolean;
    isStaff?: boolean;
    entryImageUrl?: string | null;
  } | null>(null);
  const [entryVideo, setEntryVideo] = useState<{
    name: string;
    videoUrl: string;
    videoUrlMp4?: string;
    key: number;
  } | null>(null);
  const entryVideoQueueRef = useRef<Array<{
    name: string;
    videoUrl: string;
    videoUrlMp4?: string;
    key: number;
  }>>([]);
  const [showShareToChat, setShowShareToChat] = useState(false);
  const [agencyInviteCode, setAgencyInviteCode] = useState<string | undefined>();
  const [agencyCardFrameUrl, setAgencyCardFrameUrl] = useState<string | undefined>();
  const [linkedAgency, setLinkedAgency] = useState<LinkedAgency | null>(null);
  const audienceInitRef = useRef(false);
  const allSeatsRef = useRef<any[]>([]);
  const prevAudienceUidsRef = useRef<Set<string>>(new Set());
  /** uids شوهدت دخوليتها أو كانوا حاضرين قبل اكتمال التهيئة — لا تُعاد دخوليتهم */
  const entrySeenUidsRef = useRef<Set<string>>(new Set());
  const entryBootstrapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryOverlayKeyRef = useRef(0);
  const nextEntryOverlayKey = useCallback(() => {
    entryOverlayKeyRef.current += 1;
    return entryOverlayKeyRef.current;
  }, []);
  const enqueueEntryVideo = useCallback((item: {
    name: string;
    videoUrl: string;
    videoUrlMp4?: string;
    key: number;
  }) => {
    setEntryVideo((current) => {
      if (!current) return item;
      entryVideoQueueRef.current.push(item);
      if (entryVideoQueueRef.current.length > 2) {
        entryVideoQueueRef.current.shift();
      }
      return current;
    });
  }, []);
  const completeEntryVideo = useCallback(() => {
    const next = entryVideoQueueRef.current.shift();
    setEntryVideo(next ?? null);
  }, []);
  const chatInputRef = useRef<TextInput>(null);
  const chatIgnoreChangeRef = useRef(false);
  const [chatInputResetKey, setChatInputResetKey] = useState(0);
  // بوابة الدخول (كلمة مرور للمقفلة / متابِعين فقط للأصدقاء)
  const [gateOpen, setGateOpen] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [pwError, setPwError] = useState('');
  const gateResolvedRef = useRef(false);
  const [roomFrames, setRoomFrames] = useState<RoomFrame[]>([]);
  const [seatEmojiByUid, setSeatEmojiByUid] = useState<Record<string, string>>({});
  const seatEmojiTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [seatGiftByUid, setSeatGiftByUid] = useState<Record<string, GiftType>>({});
  const seatGiftTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [privateConversations, setPrivateConversations] = useState<Conversation[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showFollowSuccessModal, setShowFollowSuccessModal] = useState(false);
  type GiftAnimEntry = {
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
    recipientUid?: string;
    recipientAvatar?: string;
    isGroupGift?: boolean;
    recipientCount?: number;
    quantity: number;
    price?: number;
    key: number;
  };
  const [giftAnimation, setGiftAnimation] = useState<GiftAnimEntry | null>(null);
  const giftQueueRef = useRef<GiftAnimEntry[]>([]);
  const comboChatRef = useRef<{
    messageId: string;
    giftId: string;
    toUid: string;
    totalQuantity: number;
    totalValue: number;
    lastWrittenValue: number;
    createPromise?: Promise<string>;
  } | null>(null);
  const comboChatWriteRef = useRef<Promise<void>>(Promise.resolve());
  const comboAnimSessionRef = useRef<{ key: number; giftId: string; toUid?: string } | null>(null);

  const clearComboChatBucket = useCallback(() => {
    void comboChatWriteRef.current.finally(() => {
      comboChatRef.current = null;
      comboAnimSessionRef.current = null;
    });
  }, []);

  const enqueueGiftAnimation = useCallback((entry: GiftAnimEntry) => {
    InteractionManager.runAfterInteractions(() => {
      setGiftAnimation((current) => {
        if (!current) return entry;
        if (giftQueueRef.current.length < 5) {
          giftQueueRef.current.push(entry);
        }
        return current;
      });
    });
  }, []);

  const playOrBumpComboAnimation = useCallback((entry: GiftAnimEntry, isCombo?: boolean) => {
    const session = comboAnimSessionRef.current;

    if (isCombo && session) {
      setGiftAnimation((current) => {
        if (current && current.key === session.key) {
          return {
            ...current,
            quantity: entry.quantity,
            price: entry.price,
          };
        }
        return { ...entry, key: session.key };
      });
      return;
    }

    const key = Date.now();
    comboAnimSessionRef.current = {
      key,
      giftId: comboChatRef.current?.giftId ?? '',
      toUid: entry.recipientUid,
    };
    enqueueGiftAnimation({ ...entry, key });
  }, [enqueueGiftAnimation]);

  const completeGiftAnimation = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      const next = giftQueueRef.current.shift();
      setGiftAnimation(next ?? null);
    });
  }, []);
  const [showTools, setShowTools] = useState(false);
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [freeGame, setFreeGame] = useState<{
    gameId: RoomFreeGameId;
    sessionId: string;
    joinCode?: string;
    autoCreate?: boolean;
  } | null>(null);
  const [pendingFreeGameId, setPendingFreeGameId] = useState<RoomFreeGameId | null>(null);
  const [startingFreeGame, setStartingFreeGame] = useState(false);
  const [roomGameInvitePopup, setRoomGameInvitePopup] = useState<RoomGameInvite | null>(null);
  const [micInvitePopup, setMicInvitePopup] = useState<RoomMicInvite | null>(null);
  const [micInviteLoading, setMicInviteLoading] = useState(false);
  const [agencyInvitePopup, setAgencyInvitePopup] = useState<AgencyInvite | null>(null);
  const [agencyInviteLoading, setAgencyInviteLoading] = useState(false);
  const [joiningRoomGame, setJoiningRoomGame] = useState(false);
  const [roomPk, setRoomPk] = useState<RoomPkState>({ status: 'idle', blueScore: 0, redScore: 0 });
  const [showPkType, setShowPkType] = useState(false);
  const [showPkSetup, setShowPkSetup] = useState(false);
  const [showPkMatching, setShowPkMatching] = useState(false);
  const [showPkChallengePopup, setShowPkChallengePopup] = useState(false);
  const [pkFlow, setPkFlow] = useState<'in_room' | 'cross_room' | null>(null);
  const [pkStarting, setPkStarting] = useState(false);
  const [pkMatchRequest, setPkMatchRequest] = useState<PkMatchRequest | null>(null);
  const [pkSentInvites, setPkSentInvites] = useState<PkAgencyInvite[]>([]);
  const [pkPendingInvite, setPkPendingInvite] = useState<PkAgencyInvite | null>(null);
  const pkMatchNotifiedRef = useRef<string | null>(null);
  const pkFlowRef = useRef<'in_room' | 'cross_room' | null>(null);

  const activeRoomId = useMemo(
    () => (Array.isArray(roomId) ? roomId[0] : roomId) as string | undefined,
    [roomId],
  );
  const [musicBusy, setMusicBusy] = useState(false);
  const [showMoreRooms, setShowMoreRooms] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const [seatSupportByUid, setSeatSupportByUid] = useState<Record<string, number>>({});
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [emptySeatSheet, setEmptySeatSheet] = useState<{ seatIdx: number; locked: boolean } | null>(null);
  const [inviteSeatIdx, setInviteSeatIdx] = useState<number | null>(null);
  const [showSeatInviteModal, setShowSeatInviteModal] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [agencyMembersList, setAgencyMembersList] = useState<AgencyMember[]>([]);
  const [micBusyUid, setMicBusyUid] = useState<string | null>(null);
  const [connectedProfiles, setConnectedProfiles] = useState<Record<string, UserDoc | null>>({});
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const [otherAgencies, setOtherAgencies] = useState<Agency[]>([]);
  const [otherAgencyRooms, setOtherAgencyRooms] = useState<Record<string, Room>>({});
  const { height: windowH } = useWindowDimensions();
  const chatScrollRef = useRef<FlatList>(null);
  const chatBootstrappedRef = useRef(false);
  const lastChatTailIdRef = useRef<string | null>(null);
  const chatNearBottomRef = useRef(true);

  // === حالات الفيديو والـ Pins ===
  const [roomVideo, setRoomVideo] = useState<RoomVideo | null>(null);
  const [roomMusic, setRoomMusic] = useState<RoomMusic | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [pendingVideoRequests, setPendingVideoRequests] = useState<RoomVideoRequest[]>([]);
  const [showVideoApprovalModal, setShowVideoApprovalModal] = useState(false);
  const videoRequestNotifiedRef = useRef<Set<string>>(new Set());
  const prevMyVideoRequestRef = useRef<{ id: string; status: RoomVideoRequest['status'] } | null>(
    null,
  );
  const [showPinModal, setShowPinModal] = useState(false);
  const [actionSheetMsg, setActionSheetMsg] = useState<RoomMessage | null>(null);

  // === حقيبة الحظ ===
  const [luckyBags, setLuckyBags] = useState<LuckyBag[]>([]);
  const [showLuckyBagModal, setShowLuckyBagModal] = useState(false);
  const [luckyBagPromptId, setLuckyBagPromptId] = useState<string | null>(null);
  const lastLuckyBagAtRef = useRef(0);

  // === صاروخ الغرفة ===
  const [rocketLaunches, setRocketLaunches] = useState<RoomRocketLaunch[]>([]);
  const [rocketProgress, setRocketProgress] = useState<RoomRocketProgress>({
    cycleTotal: 0,
    maxLevelLaunched: 0,
    contributors: {},
    cycleStartedAt: Date.now(),
  });
  const [showRocketModal, setShowRocketModal] = useState(false);
  const [rocketViewLaunch, setRocketViewLaunch] = useState<RoomRocketLaunch | null>(null);
  const [rocketLaunchAnim, setRocketLaunchAnim] = useState<RoomRocketLaunch | null>(null);
  const lastRocketLaunchAtRef = useRef(0);

  // === عرش الغرفة ===
  const [roomThrone, setRoomThrone] = useState<RoomThroneState>({
    occupantUid: null,
    occupantName: '',
    occupantCoins: 0,
    updatedAt: Date.now(),
  });
  const [myThroneContribution, setMyThroneContribution] = useState(0);
  const [showThroneModal, setShowThroneModal] = useState(false);
  const keepRoomAliveRef = useRef(false);
  const leavingRoomRef = useRef(false);
  const audienceJoinedRef = useRef<string | null>(null);
  const onMicKeepAliveRef = useRef(false);
  const pendingPinnedAudioResumeRef = useRef(false);
  const visitTrackedRef = useRef(false);
  const lastGiftIdRef = useRef<string | null>(null);
  const lastGiftQtyRef = useRef<number>(0);
  const lastEmojiMsgIdRef = useRef<string | null>(null);
  const emojiSendLockRef = useRef(false);
  const [emojiSending, setEmojiSending] = useState(false);
  const [liveAudience, setLiveAudience] = useState<RoomAudienceMember[]>([]);
  const [audienceUidSet, setAudienceUidSet] = useState<Set<string>>(() => new Set());
  const [userFrameByUid, setUserFrameByUid] = useState<Record<string, string>>({});
  const [userChatMetaByUid, setUserChatMetaByUid] = useState<Record<string, ChatUserMeta>>({});
  const [storeBubbleCatalog, setStoreBubbleCatalog] = useState<StoreItem[]>([]);
  const [storeEntranceCatalog, setStoreEntranceCatalog] = useState<StoreItem[]>([]);

  // === المؤثرات الصوتية ===
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showEffectsModal, setShowEffectsModal] = useState(false);
  const [showResetMicSupportModal, setShowResetMicSupportModal] = useState(false);
  const [simpleScreen, setSimpleScreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [roomEffectsSettings, setRoomEffectsSettings] = useState<RoomEffectsSettings>(DEFAULT_ROOM_EFFECTS);
  const [personalEffects, setPersonalEffects] = useState<PersonalEffectsPrefs>(DEFAULT_PERSONAL_EFFECTS);

  // === طرد مستخدم بمدة ===
  const [kickTarget, setKickTarget] = useState<{ uid: string; name: string } | null>(null);
  const [kickLoading, setKickLoading] = useState(false);

  // === مودالات التأكيد (تصميم الهوية) ===
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEndRoomConfirm, setShowEndRoomConfirm] = useState(false);
  const [endRoomMode, setEndRoomMode] = useState<'archive' | 'end' | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showJoinMicModal, setShowJoinMicModal] = useState(false);
  const [pendingJoinSeatIdx, setPendingJoinSeatIdx] = useState<number | null>(null);
  const [joinMicFee, setJoinMicFee] = useState(0);
  const [joinMicLoading, setJoinMicLoading] = useState(false);
  const [myRoomMemberRole, setMyRoomMemberRole] = useState<RoomAgencyMemberRole | null>(null);
  const [roomMemberRoles, setRoomMemberRoles] = useState<Record<string, RoomAgencyMemberRole>>({});

  // Subscribe لحقائب الحظ
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToLuckyBags(roomId, setLuckyBags);
    return unsub;
  }, [roomId]);

  // Subscribe لصاروخ الغرفة
  useEffect(() => {
    if (!roomId) return;
    const unsubLaunches = subscribeToRoomRocketLaunches(roomId, setRocketLaunches);
    const unsubProgress = subscribeToRoomRocketProgress(roomId, setRocketProgress);
    return () => {
      unsubLaunches();
      unsubProgress();
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeToRoomSeatSupport(roomId, setSeatSupportByUid);
  }, [roomId]);

  useEffect(() => {
    loadPersonalEffectsPrefs().then(setPersonalEffects);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    primeRoomSenderProfile(
      resolveDisplayName(
        { displayName: user.profile?.displayName, email: user.email },
        t('rooms.userFallback'),
      ),
      user.profile?.avatar ?? '',
    );
  }, [user?.uid, user?.profile?.displayName, user?.profile?.avatar, user?.email, t]);

  // تحميل مسبق خفيف — أغلى 4 فيديوهات فقط بالخلفية (لا يُجمّد الواجهة)
  useEffect(() => {
    void warmGiftSoundEngine();
    void warmRoomSoundEffectsCatalog(ROOM_SOUND_EFFECTS);
    if (!GIFTS_CATALOG || GIFTS_CATALOG.length === 0) return;
    const topVideoGifts = [...GIFTS_CATALOG]
      .filter((g) => g.videoUrl?.trim() || g.videoUrlMp4?.trim())
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      .slice(0, 4);
    topVideoGifts.forEach((gift) => {
      if (gift.videoUrlMp4?.trim()) preloadVideoBackground(gift.videoUrlMp4.trim());
      else if (gift.videoUrl?.trim()) preloadVideoBackground(gift.videoUrl.trim());
    });
    GIFTS_CATALOG.forEach((gift) => {
      if (gift.soundUrl?.trim()) void preloadGiftSound(gift.soundUrl.trim());
    });
    return () => {
      void stopRoomSound();
    };
  }, [GIFTS_CATALOG]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeToRoomEffectsSettings(roomId, setRoomEffectsSettings);
  }, [roomId]);

  const giftAnimationsEnabled = useMemo(
    () => shouldPlayGiftAnimation(roomEffectsSettings, personalEffects),
    [roomEffectsSettings, personalEffects],
  );
  const entryAnimationsEnabled = useMemo(
    () => shouldPlayEntryAnimation(roomEffectsSettings, personalEffects),
    [roomEffectsSettings, personalEffects],
  );
  const roomSoundEffectsEnabled = useMemo(
    () => shouldPlayRoomSoundEffects(roomEffectsSettings, personalEffects),
    [roomEffectsSettings, personalEffects],
  );

  // Subscribe لفيديو الروم
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToRoomVideo(roomId, setRoomVideo);
    return unsub;
  }, [roomId]);

  // Subscribe لموسيقى الروم
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToRoomMusic(roomId, setRoomMusic);
    return unsub;
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !user?.uid) return;
    clearSessionMusicLibrary(roomId, user.uid);
  }, [roomId, user?.uid]);

  // Subscribe للرسائل المثبتة (غير وكالات — الوكالات تستخدم رسالة ترحيب ثابتة)
  useEffect(() => {
    if (!roomId || isAgencyLiveRoom(room)) {
      setPinnedMessages([]);
      return;
    }
    const unsub = subscribeToPinnedMessages(roomId, setPinnedMessages);
    return unsub;
  }, [roomId, room?.agencyId, room?.isAgencyRoom]);

  // تحميل مسبق لـ LiveKit + توكني الاستماع والنشر فور معرفة الغرفة
  useEffect(() => {
    if (!roomId) return;
    const roomName = `room_${roomId}`;
    prefetchRoomAudio(roomName, false);
    prefetchRoomAudio(roomName, true);
  }, [roomId]);

  // Subscribe to room data
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToRoom(roomId, (data) => {
      setRoom(data);
    });
    return unsub;
  }, [roomId]);

  // خلفية الوكالة — تحديث فوري من Firestore (احتياطي + مزامنة مع بطاقة الهوم)
  useEffect(() => {
    const agencyId = room?.agencyId;
    if (!agencyId) {
      setAgencyRoomBg(null);
      return;
    }
    const unsub = onSnapshot(doc(firestore, 'agencies', agencyId), (snap) => {
      const url = String(snap.data()?.roomBackgroundUrl ?? '');
      setAgencyRoomBg(url.startsWith('http') ? url : null);
    });
    return unsub;
  }, [room?.agencyId]);

  const stageBackgroundUri =
    room?.agencyId && agencyRoomBg ? agencyRoomBg : room?.background || agencyRoomBg || null;

  // كتالوج الإطارات — لعرض إطار المضيف المفعّل
  useEffect(() => {
    const unsub = subscribeToRoomFrames(setRoomFrames);
    return unsub;
  }, []);
  // ملاحظة: حُذفت simulatedSpeakers الوهمية — الآن نعتمد على LiveKit isSpeaking الحقيقي

  const showSeatEmoji = useCallback((uid: string, emoji: string) => {
    if (!uid || !emoji?.trim()) return;
    setSeatEmojiByUid((prev) => ({ ...prev, [uid]: emoji }));
    const prevTimer = seatEmojiTimersRef.current[uid];
    if (prevTimer) clearTimeout(prevTimer);
    seatEmojiTimersRef.current[uid] = setTimeout(() => {
      setSeatEmojiByUid((prev) => {
        if (prev[uid] !== emoji) return prev;
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      delete seatEmojiTimersRef.current[uid];
    }, ROOM_EMOJI_ON_SEAT_MS);
  }, []);

  const ROOM_GIFT_ON_SEAT_MS = 4000;

  const showSeatGift = useCallback((uid: string, gift: GiftType) => {
    if (!uid || !gift?.id) return;
    setSeatGiftByUid((prev) => ({ ...prev, [uid]: gift }));
    const prevTimer = seatGiftTimersRef.current[uid];
    if (prevTimer) clearTimeout(prevTimer);
    seatGiftTimersRef.current[uid] = setTimeout(() => {
      setSeatGiftByUid((prev) => {
        if (prev[uid]?.id !== gift.id) return prev;
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      delete seatGiftTimersRef.current[uid];
    }, ROOM_GIFT_ON_SEAT_MS);
  }, []);

  const showGroupGiftOnSeats = useCallback(
    (gift: GiftType, seatUids: string[]) => {
      for (const uid of seatUids) {
        if (uid) showSeatGift(uid, gift);
      }
    },
    [showSeatGift],
  );

  useEffect(() => {
    return () => {
      Object.values(seatEmojiTimersRef.current).forEach(clearTimeout);
      seatEmojiTimersRef.current = {};
      Object.values(seatGiftTimersRef.current).forEach(clearTimeout);
      seatGiftTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    lastGiftIdRef.current = null;
    lastGiftQtyRef.current = 0;
    chatBootstrappedRef.current = false;
    lastChatTailIdRef.current = null;
    chatNearBottomRef.current = true;
    setChatSinceMs(null);
    setMessages([]);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || chatSinceMs == null) return;
    const unsub = subscribeToRoomMessages(
      roomId,
      (msgs) => {
      // كشف هدية جديدة وعرض الأنيميشن للجميع (نفس منطق الشات)
      const giftMessages = msgs.filter((m) => m.type === 'gift');
      const latestGift = giftMessages[giftMessages.length - 1];
      if (latestGift) {
        const latestQty = latestGift.giftQuantity ?? 1;

        if (!lastGiftIdRef.current) {
          lastGiftIdRef.current = latestGift.id;
          lastGiftQtyRef.current = latestQty;
        } else if (
          latestGift.id === lastGiftIdRef.current &&
          latestQty > lastGiftQtyRef.current
        ) {
          lastGiftQtyRef.current = latestQty;
          if (latestGift.uid !== user?.uid && giftAnimationsEnabled) {
            setGiftAnimation((cur) =>
              cur
                ? {
                    ...cur,
                    quantity: latestQty,
                    price: Math.max(0, Number(latestGift.giftValue) || cur.price || 0),
                  }
                : cur,
            );
          }
        } else if (latestGift.id !== lastGiftIdRef.current) {
          lastGiftIdRef.current = latestGift.id;
          lastGiftQtyRef.current = latestQty;
          const catalogGift = GIFTS_CATALOG.find((g) => g.id === latestGift.giftId);
          const seatGift: GiftType = catalogGift ?? {
            id: latestGift.giftId ?? '',
            name: latestGift.giftName ?? '',
            price: 0,
            category: '',
            iconName: 'Gift',
            iconColor: lu.colors.pink,
            rarity: 'common',
            imageUrl: latestGift.imageUrl,
            animationUrl: latestGift.animationUrl,
            soundUrl: latestGift.soundUrl,
            videoUrl: latestGift.videoUrl,
          };
          if (latestGift.isGroupGift) {
            const seatUids = allSeatsRef.current
              .map((s) => s?.uid)
              .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);
            showGroupGiftOnSeats(seatGift, seatUids);
          } else if (latestGift.toUid) {
            showSeatGift(latestGift.toUid, seatGift);
          }
          if (latestGift.uid !== user?.uid && giftAnimationsEnabled) {
            const payload = resolveGiftAnimationPayload(GIFTS_CATALOG, {
              giftId: latestGift.giftId,
              giftName: latestGift.giftName,
              giftQuantity: latestGift.giftQuantity,
              giftPrice: latestGift.giftValue,
              imageUrl: latestGift.imageUrl,
              animationUrl: latestGift.animationUrl,
              soundUrl: latestGift.soundUrl,
              videoUrl: latestGift.videoUrl,
            });
            if (payload) {
              const recipientSeat = latestGift.toUid
                ? allSeatsRef.current.find((s) => s?.uid === latestGift.toUid)
                : undefined;
              enqueueGiftAnimation({
                ...payload,
                senderName: latestGift.name ?? t('rooms.userFallback'),
                recipientName: latestGift.isGroupGift
                  ? t('room.sendToAll')
                  : latestGift.toName,
                recipientUid: latestGift.toUid,
                recipientAvatar: recipientSeat?.avatar,
                isGroupGift: latestGift.isGroupGift,
                recipientCount: latestGift.recipientCount,
                key: Date.now(),
              });
            }
          }
        }
      }

      const emojiMessages = msgs.filter((m) => m.type === 'emoji');
      const latestEmoji = emojiMessages[emojiMessages.length - 1];
      if (latestEmoji && latestEmoji.id !== lastEmojiMsgIdRef.current) {
        lastEmojiMsgIdRef.current = latestEmoji.id;
        const em = latestEmoji.emoji ?? latestEmoji.text ?? '✨';
        if (latestEmoji.uid && latestEmoji.uid !== user?.uid) {
          showSeatEmoji(latestEmoji.uid, em);
        }
      } else if (latestEmoji && !lastEmojiMsgIdRef.current) {
        lastEmojiMsgIdRef.current = latestEmoji.id;
      }

      // حدّ أعلى لعدد الرسائل المحفوظة في الذاكرة — يمنع تراكمها في المكالمات الطويلة
      const capped = msgs.length > 300 ? msgs.slice(-300) : msgs;
      setMessages((prev) => {
        const sig = (list: typeof capped) =>
          list
            .map((m) =>
              m.type === 'gift'
                ? `${m.id}:${m.giftQuantity ?? 1}:${m.giftValue ?? 0}`
                : m.id,
            )
            .join('|');
        if (prev.length === capped.length && sig(prev) === sig(capped)) {
          return prev;
        }
        return capped;
      });
      },
      { limit: 50, sinceMs: chatSinceMs },
    );
    return unsub;
  }, [roomId, chatSinceMs, user?.uid, showSeatEmoji, showSeatGift, showGroupGiftOnSeats, GIFTS_CATALOG, t]);

  // ملاحظة: مع FlatList المقلوبة (inverted) الأحدث دائماً في الأسفل تلقائياً،
  // فلا حاجة لـ scrollToEnd (الذي كان يسبّب قفز الشات لأعلى/أسفل مع الصور المتغيّرة الارتفاع).

  // وكالات أخرى — فقط عند فتح اللوحة (توفير الأداء)
  useEffect(() => {
    if (!showMoreRooms) return;
    let cancelled = false;
    void getAgencies().then((list) => {
      if (cancelled) return;
      const currentAgencyId = room?.agencyId;
      setOtherAgencies(
        list.filter((a) => a.id && a.id !== currentAgencyId).slice(0, 12),
      );
    });
    const unsub = subscribeToRooms((rooms) => {
      const map: Record<string, Room> = {};
      for (const r of rooms) {
        if (!r.agencyId) continue;
        const prev = map[r.agencyId];
        const aud = Number(r.audienceCount) || 0;
        const prevAud = prev ? Number(prev.audienceCount) || 0 : -1;
        if (!prev || isRoomLive(r) || aud > prevAud) {
          map[r.agencyId] = r;
        }
      }
      setOtherAgencyRooms(map);
    }, 30);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [roomId, showMoreRooms, room?.agencyId]);

  // دخول روم آخر أثناء تصغير روم سابق — مغادرة كاملة للروم القديم
  useEffect(() => {
    if (!roomId) return;
    const session = useRoomSessionStore.getState();
    if (session.isMinimized && session.roomId && session.roomId !== roomId) {
      const oldRoomId = session.roomId;
      keepRoomAliveRef.current = false;
      pendingPinnedAudioResumeRef.current = false;
      // دخول روم جديد يجب أن يقطع صوت الروم السابق فوراً (حتى لو كان "احتفظ").
      roomAudioSession.setRemoteAudioMuted(true);
      void roomAudioSession.disconnect().catch(() => {});
      useRoomSessionStore.getState().clear();
      // تنظيف عضوية/وسائط الروم السابق بدون فصل جلسة الصوت مرة ثانية.
      void completeRoomLeave(oldRoomId, user?.uid, { skipAudioDisconnect: true });
    }
  }, [roomId, user?.uid]);

  useEffect(() => {
    if (!roomId) return;
    if (!roomMusic) {
      useRoomMusicUiStore.getState().clearIfRoom(roomId);
    }
    return () => {
      if (!isRoomSessionPinned(roomId)) {
        useRoomMusicUiStore.getState().clearIfRoom(roomId);
      }
    };
  }, [roomId, roomMusic]);

  const userUid = user?.uid;

  // Join/leave audience — بعد فتح بوابة الدخول فقط
  useEffect(() => {
    if (!roomId || !userUid || !gateOpen) return;

    const session = useRoomSessionStore.getState();
    const resumingPinnedSession = isRoomSessionPinned(roomId);
    const applyChatSince = (ts: number) => setChatSinceMs(ts);

    if (resumingPinnedSession) {
      keepRoomAliveRef.current = true;
      audienceJoinedRef.current = roomId;
      pendingPinnedAudioResumeRef.current = true;
      if (session.isMinimized) {
        useRoomSessionStore.getState().expand();
      }
      void recoverRoomPresenceAfterRtdbReconnect()
        .then(() => rebindRoomOnDisconnectHandlers(roomId))
        .catch(() => {});
      void getMyRoomAudienceJoinedAt(roomId).then((ts) => {
        applyChatSince(ts ?? Date.now());
      });
    } else if (!keepRoomAliveRef.current && audienceJoinedRef.current !== roomId) {
      audienceJoinedRef.current = roomId;
      applyChatSince(Date.now());
      void joinAudience(roomId)
        .then(() => getMyRoomAudienceJoinedAt(roomId))
        .then((ts) => {
          if (ts != null) applyChatSince(ts);
        })
        .catch((e: any) => {
          const msg = String(e?.message ?? '');
          if (msg.includes('مطرود من الوكالة') || msg.includes('محظور من هذه الغرفة')) {
            Alert.alert('لا يمكنك الدخول', msg, [
              {
                text: 'حسناً',
                onPress: () => router.back(),
              },
            ]);
          }
        });
    }

    return () => {
      if (!isRoomSessionPinned(roomId)) {
        audienceJoinedRef.current = null;
        if (onMicKeepAliveRef.current) {
          keepRoomAliveRef.current = true;
          const snap = useRoomSessionStore.getState();
          useRoomSessionStore.getState().pinMembership({
            roomId,
            roomName: snap.roomName || 'LinkUp',
            canPublish: true,
            micSeatIndex: useRoomSessionStore.getState().micSeatIndex,
          });
          void pinRoomSession(roomId)
            .then(() => syncPinnedRoomListenAudio(roomId))
            .catch(() => {});
          return;
        }
        if (userUid) {
          void cleanupRoomMediaOnLeave(roomId, userUid);
        }
        releaseRoomMembership(roomId).catch(() => {});
      }
    };
  }, [roomId, userUid, gateOpen]);

  // حضور مباشر من roomAudience/{uid} — مستخدم واحد لكل uid
  useEffect(() => {
    if (!roomId) return;
    return subscribeToAudience(roomId, setLiveAudience);
  }, [roomId]);

  // uids الحضور الكاملة + إفراغ المقعد فور مغادرة أي شخص (ريل-تايم)
  useEffect(() => {
    if (!roomId) return;
    return subscribeToRoomAudienceUids(roomId, setAudienceUidSet);
  }, [roomId]);

  // Presence + visit tracking — منفصل حتى لا يُعيد تشغيل منطق join/leave
  useEffect(() => {
    if (!roomId || !room?.name) return;
    const inAgencyRoom = isAgencyLiveRoom(room);
    void setUserInRoom(roomId, room.name, {
      agencyId: room.agencyId,
      isAgencyRoom: inAgencyRoom,
    });
    return () => {
      if (!isRoomSessionPinned(roomId)) {
        void clearUserFromRoom();
      }
    };
  }, [roomId, room?.name, room?.agencyId, room?.isAgencyRoom]);

  // تسجيل الزيارة + إشعار المتابعين — مرة واحدة عند تحميل اسم الغرفة
  useEffect(() => {
    if (!roomId || !room?.name || !user || visitTrackedRef.current) return;
    if (isRoomSessionPinned(roomId)) return; // عودة من التصغير — لا تسجّل زيارة جديدة
    visitTrackedRef.current = true;
    recordRoomVisit(roomId, room.name, {
      hostAvatar: room.hostAvatar,
      agencyId: room.agencyId,
      isAgencyRoom: isAgencyLiveRoom(room),
    }).catch(() => {});
    notifyFollowersOfRoomEntry(roomId, room.name).catch(() => {});
  }, [roomId, room?.name, user]);

  const myUid = user?.uid;
  const mySeatAvatar = useMemo(() => {
    if (!user) return '';
    return resolveOfficialUserAvatar(user as unknown as Record<string, unknown>, user.uid);
  }, [user]);
  const isHost = room?.hostUid === myUid;
  const staffProfile = useMemo(
    () =>
      user
        ? {
            staffRole: user.staffRole ?? null,
            staffCountries: user.staffCountries,
            staffActive: user.staffActive,
          }
        : null,
    [user?.staffRole, user?.staffCountries, user?.staffActive],
  );
  const roomCountry = useMemo(
    () => resolveRoomCountry(room, room?.country),
    [room?.country, room?.agencyId],
  );
  const canUseHostSeat = useMemo(
    () => effectiveCanJoinHostSeat(room, myUid, staffProfile, roomCountry),
    [room?.hostUid, room?.agencyId, room?.isAgencyRoom, room?.coHosts, myUid, staffProfile, roomCountry],
  );
  const canTakeHostSeat = useMemo(
    () => effectiveCanOccupyHostSeat(room, myUid, staffProfile, roomCountry),
    [room?.hostUid, room?.agencyId, room?.isAgencyRoom, room?.coHosts, myUid, staffProfile, roomCountry],
  );
  const supervisorPerms = useMemo(
    () =>
      resolveSupervisorPermissions(
        room as Record<string, unknown> | null | undefined,
        myUid,
        staffProfile,
        roomCountry,
        roomMemberRoles,
      ),
    [room, myUid, staffProfile, roomCountry, roomMemberRoles, room?.permissions, room?.coHosts, room?.hostUid],
  );
  const canOpenRoomSettings = useMemo(
    () => canUserManageRoomSettings(room as Record<string, unknown> | null | undefined, myUid),
    [room, myUid, room?.permissions, room?.coHosts, room?.hostUid],
  );
  const canManageRoomBlocks = useMemo(
    () => canUserManageRoomBlocks(room as Record<string, unknown> | null | undefined, myUid),
    [room, myUid, room?.permissions, room?.coHosts, room?.hostUid],
  );
  const isAgencyRoom = isAgencyLiveRoom(room);
  const canManageAgencyParty = useMemo(
    () =>
      Boolean(
        isAgencyRoom &&
        room?.agencyId &&
        myUid &&
        isAgencyManagerForRoom(user, String(room.agencyId)),
      ),
    [isAgencyRoom, room?.agencyId, myUid, user],
  );
  const canReviewVideoRequests = useMemo(
    () =>
      isHost ||
      supervisorPerms.reviewVideo ||
      staffCanReviewRoom(staffProfile, roomCountry),
    [isHost, supervisorPerms.reviewVideo, staffProfile, roomCountry],
  );
  const canControlRoomVideo = useMemo(
    () => canReviewVideoRequests || canManageAgencyParty,
    [canReviewVideoRequests, canManageAgencyParty],
  );
  const canManageRoomMusic = useMemo(
    () => canReviewVideoRequests || canManageAgencyParty || isHost,
    [canReviewVideoRequests, canManageAgencyParty, isHost],
  );
  const canReviewPkInvites = canReviewVideoRequests;

  // طلبات فيديو معلّقة — للإشراف والوكالة
  useEffect(() => {
    if (!roomId || !canReviewVideoRequests) return;
    return subscribeToPendingVideoRequests(roomId, (requests) => {
      setPendingVideoRequests(requests);
      if (requests.length > 0) setShowVideoApprovalModal(true);
    });
  }, [roomId, canReviewVideoRequests]);

  // إشعار المرسل بنتيجة مراجعة الفيديو — مرة واحدة بعد الموافقة/الرفض (لا للمشرفين/مدير الوكالة)
  useEffect(() => {
    videoRequestNotifiedRef.current.clear();
    prevMyVideoRequestRef.current = null;
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !myUid || canReviewVideoRequests) return;
    return subscribeToMyLatestVideoRequest(roomId, myUid, (req) => {
      if (!req || req.status === 'pending') {
        if (req) prevMyVideoRequestRef.current = { id: req.id, status: req.status };
        return;
      }

      const key = `${req.id}:${req.status}`;
      if (videoRequestNotifiedRef.current.has(key)) {
        prevMyVideoRequestRef.current = { id: req.id, status: req.status };
        return;
      }

      const prev = prevMyVideoRequestRef.current;
      // req.status هنا مضمون غير pending (تمّت حراسته بالخروج المبكر أعلاه)
      const isLiveTransition = prev?.id === req.id && prev.status === 'pending';
      const isFreshReview =
        typeof req.reviewedAt === 'number' && Date.now() - req.reviewedAt < 25_000;

      prevMyVideoRequestRef.current = { id: req.id, status: req.status };

      // لا إشعار عند فتح الروم لطلب قديم — فقط عند انتقال pending→approved/rejected أو موافقة حديثة
      if (!isLiveTransition && !isFreshReview) return;

      videoRequestNotifiedRef.current.add(key);
      if (req.status === 'approved') {
        showAlert({
          type: 'success',
          title: t('room.videoRequestApprovedTitle'),
          message: t('room.videoRequestApprovedMsg'),
        });
      } else if (req.status === 'rejected') {
        showAlert({
          type: 'warning',
          title: t('room.videoRequestRejectedTitle'),
          message: t('room.videoRequestRejectedMsg'),
        });
      }
    });
  }, [roomId, myUid, canReviewVideoRequests, showAlert, t]);

  const agencyHeaderAvatar = useMemo(() => {
    if (!isAgencyRoom) return undefined;
    return resolveAgencyLogoImage(linkedAgency, { roomBanner: room?.banner });
  }, [isAgencyRoom, linkedAgency, room?.banner]);

  const agencyHeaderName = useMemo(() => {
    if (!isAgencyRoom) return undefined;
    return linkedAgency?.name?.trim() || room?.name;
  }, [isAgencyRoom, linkedAgency?.name, room?.name]);

  const isRoomMicMember = useMemo(
    () =>
      myRoomMemberRole === 'red_member' ||
      myRoomMemberRole === 'blue_supervisor' ||
      myRoomMemberRole === 'yellow_supervisor',
    [myRoomMemberRole],
  );
  const myChatMuted = useMemo(
    () => Boolean(myUid && isRoomChatMuted(room, myUid)),
    [room?.chatMutedUsers, myUid, room],
  );
  const seatUserMicMuted = useMemo(() => {
    if (!seatUser?.uid || !room?.seats) return false;
    const idx = seatUser.seatIndex;
    if (typeof idx === 'number') {
      return room.seats[`seat_${idx}`]?.isMuted === true;
    }
    for (const seat of Object.values(room.seats)) {
      if (seat?.uid === seatUser.uid) return seat.isMuted === true;
    }
    return false;
  }, [seatUser?.uid, seatUser?.seatIndex, room?.seats]);
  const seatUserChatMuted = useMemo(
    () => Boolean(seatUser?.uid && isRoomChatMuted(room, seatUser.uid)),
    [seatUser?.uid, room?.chatMutedUsers, room],
  );
  const throneActive = useMemo(
    () => isAgencyRoomThroneActive(room, throneConfig),
    [room?.isAgencyRoom, room?.agencyId, room?.throneEnabled, room?.agencyPeriodLevel, throneConfig],
  );
  const throneUnlockedByLevel = useMemo(
    () => isAgencyRoomThroneUnlocked(room, throneConfig),
    [room?.isAgencyRoom, room?.agencyId, room?.agencyPeriodLevel, throneConfig],
  );
  const showThroneTool = isAgencyRoom && throneConfig.enabled && throneUnlockedByLevel;

  useEffect(() => {
    if (!roomId || !isAgencyRoom || !room?.agencyId) return;
    void syncAgencyPeriodLevelToRoom(roomId).catch(() => {});
  }, [roomId, isAgencyRoom, room?.agencyId]);

  useEffect(() => {
    if (!isAgencyRoom || !room?.agencyId) {
      setAgencyInviteCode(undefined);
      setAgencyCardFrameUrl(undefined);
      setLinkedAgency(null);
      return;
    }
    return subscribeToAgencyById(room.agencyId, (agency) => {
      setLinkedAgency(agency);
      setAgencyInviteCode(agency?.inviteCode?.trim() || undefined);
      const frame = agency?.cardFrameUrl?.startsWith('http') ? agency.cardFrameUrl : undefined;
      setAgencyCardFrameUrl(frame);
    });
  }, [isAgencyRoom, room?.agencyId]);

  // Subscribe لعرش الغرفة (وكالات فقط + تفعيل من صاحب الوكالة)
  useEffect(() => {
    if (!roomId || !throneActive) return;
    const unsub = subscribeToRoomThrone(roomId, setRoomThrone);
    return unsub;
  }, [roomId, throneActive]);

  useEffect(() => {
    if (!roomId || !user?.uid || !throneActive) {
      setMyThroneContribution(0);
      return;
    }
    return subscribeToMyThroneContribution(roomId, user.uid, setMyThroneContribution);
  }, [roomId, user?.uid, throneActive]);

  useEffect(() => {
    if (!roomId || !myUid) {
      setMyRoomMemberRole(null);
      setRoomMemberRoles({});
      return;
    }
    return subscribeToRoomMemberRoles(roomId, (roles) => {
      setRoomMemberRoles(roles);
      setMyRoomMemberRole(roles[myUid] ?? null);
    });
  }, [roomId, myUid]);

  const canManageAgencyTarget = useCallback(
    (
      targetUid: string | undefined,
      action: 'kick' | 'block' | 'removeMic' | 'mute' | 'cancelMembership' | 'assignRole',
    ) => {
      if (!targetUid || !room || !myUid) return false;
      return canAgencyManageTarget(
        room as unknown as Record<string, unknown>,
        myUid,
        targetUid,
        action,
        roomMemberRoles,
        staffProfile,
        roomCountry,
      );
    },
    [room, myUid, roomMemberRoles, staffProfile, roomCountry],
  );

  // إظهار حقيبة الحظ لصاحب الوكالة / المضيف عند إرسالها في الروم
  useEffect(() => {
    if (!luckyBags.length || !myUid) return;
    const latest = luckyBags[0];
    if (!latest || latest.status !== 'active' || latest.remainingSlots <= 0) return;
    if (latest.createdAt <= lastLuckyBagAtRef.current) return;
    lastLuckyBagAtRef.current = latest.createdAt;
    if (supervisorPerms.manageLuckyBags || latest.senderUid === myUid) {
      setLuckyBagPromptId(latest.id);
    }
  }, [luckyBags, myUid, supervisorPerms.manageLuckyBags]);

  // مؤقّت خفيف يُعيد التقييم كل 30ث ليختفي الصاروخ تلقائياً بعد ساعة حتى بلا حدث جديد
  const [rocketNow, setRocketNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rocketLaunches.length) return;
    const iv = setInterval(() => setRocketNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, [rocketLaunches.length]);

  // الصاروخ المعروض = آخر إطلاق نشط فقط (لم تمرّ ساعة على إطلاقه)
  const latestRocketLaunch = useMemo(() => {
    const l = rocketLaunches[0] ?? null;
    return l && isRocketLaunchActive(l, rocketNow) ? l : null;
  }, [rocketLaunches, rocketNow]);

  const openRocketLaunchView = useCallback((launch?: RoomRocketLaunch | null) => {
    setRocketViewLaunch(launch ?? latestRocketLaunch);
    setShowRocketModal(true);
  }, [latestRocketLaunch]);

  const handleRocketLaunchAnimComplete = useCallback(() => {
    setRocketLaunchAnim(null);
  }, []);

  const openRocketTools = useCallback(() => {
    setRocketViewLaunch(null);
    setShowRocketModal(true);
  }, []);

  // إطلاق جديد: تجاهل الإطلاقات القديمة (>60 ثانية) عند فتح الروم — نعرض أنيميشن للجديد فقط
  useEffect(() => {
    if (!latestRocketLaunch) return;
    if (latestRocketLaunch.launchedAt <= lastRocketLaunchAtRef.current) return;
    lastRocketLaunchAtRef.current = latestRocketLaunch.launchedAt;
    const ageMs = Date.now() - latestRocketLaunch.launchedAt;
    if (ageMs > 60_000) return;
    setRocketLaunchAnim(latestRocketLaunch);
  }, [latestRocketLaunch]);

  useEffect(() => {
    if (!room?.agencyId || !isAgencyRoom) return;
    return subscribeToAgencyMembers(room.agencyId, setAgencyMembersList);
  }, [room?.agencyId, isAgencyRoom]);

  const agencyMemberDocByUid = useMemo(() => {
    const map = new Map<string, string>();
    agencyMembersList.forEach((m) => map.set(m.uid, m.id));
    return map;
  }, [agencyMembersList]);

  const isMyAgencyMember = useMemo(
    () => Boolean(myUid && agencyMemberDocByUid.has(myUid)),
    [myUid, agencyMemberDocByUid],
  );

  const roomPerms = useMemo(
    () => parseRoomPermissions(room as Record<string, unknown> | null | undefined),
    [room?.permissions, room],
  );

  const myRoomAudience = useMemo(
    () => resolveRoomAudienceKind(room, myUid, isMyAgencyMember),
    [room, myUid, isMyAgencyMember],
  );

  const canShareVideoPermission = useMemo(
    () => hasRoomFeaturePermission(roomPerms, 'shareVideo', myRoomAudience),
    [roomPerms, myRoomAudience],
  );
  const canShareMusicTool = useMemo(
    () => hasRoomFeaturePermission(roomPerms, 'shareMusic', myRoomAudience),
    [roomPerms, myRoomAudience],
  );
  const canSendRoomInviteTool = useMemo(
    () => hasRoomFeaturePermission(roomPerms, 'sendRoomInvite', myRoomAudience),
    [roomPerms, myRoomAudience],
  );
  const canInviteToMicTool = useMemo(
    () => hasRoomFeaturePermission(roomPerms, 'inviteToMic', myRoomAudience),
    [roomPerms, myRoomAudience],
  );
  const canInviteToAgencyTool = useMemo(
    () => hasRoomFeaturePermission(roomPerms, 'inviteToAgency', myRoomAudience),
    [roomPerms, myRoomAudience],
  );

  const showPermissionDenied = useCallback(
    (featureKey: string) => {
      showAlert({
        type: 'warning',
        title: t('room.permissionRequired'),
        message: t(featureKey),
      });
    },
    [showAlert, t],
  );

  const openRoomUserSheet = useCallback((u: RoomSeatUser) => {
    const memberDocId = u.agencyMemberDocId ?? agencyMemberDocByUid.get(u.uid);
    setSeatUser(memberDocId ? { ...u, agencyMemberDocId: memberDocId } : u);
  }, [agencyMemberDocByUid]);

  const canShowAgencyInviteForUser = useCallback(
    (uid: string | undefined) =>
      Boolean(
        isAgencyRoom &&
          isHost &&
          uid &&
          uid !== myUid &&
          !agencyMemberDocByUid.has(uid),
      ),
    [isAgencyRoom, isHost, myUid, agencyMemberDocByUid],
  );

  const handleInviteToAgencyFromRoom = useCallback(
    (uid: string, displayName?: string) => {
      const targetName = displayName?.trim() || t('rooms.userFallback');
      Alert.alert(
        t('room.inviteAgencyTitle'),
        t('room.inviteAgencyConfirm', { name: targetName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('room.inviteAgencySend'),
            onPress: () => {
              void (async () => {
                try {
                  const alreadyMember = await userHasAgencyMembership(uid);
                  if (alreadyMember) {
                    showAlert({
                      type: 'info',
                      title: t('room.inviteAgencyTitle'),
                      message: t('room.inviteAgencyAlreadyMember'),
                    });
                    return;
                  }
                  await inviteUserToAgencyWithNotification({
                    invitedUid: uid,
                    agencyId: room!.agencyId!,
                    agencyName: user?.agencyName ?? room?.name ?? t('roomSettings.defaultAgencyName'),
                    agentUid: myUid!,
                    agentName: resolveDisplayName({
                      displayName: user?.profile?.displayName,
                      email: user?.email,
                    }),
                    agentAvatar: user?.profile?.avatar || undefined,
                  });
                  setSeatUser(null);
                  showAlert({
                    type: 'success',
                    title: t('common.done'),
                    message: t('room.inviteAgencySent', { name: targetName }),
                  });
                } catch (e: any) {
                  const msg = String(e?.message ?? '');
                  showAlert({
                    type: 'error',
                    title: t('common.error'),
                    message: msg.includes('الدعوة موجودة')
                      ? t('room.inviteAgencyPending')
                      : msg || t('common.error'),
                  });
                }
              })();
            },
          },
        ],
      );
    },
    [myUid, room, showAlert, t, user?.agencyName, user?.profile?.avatar, user?.profile?.displayName, user?.email],
  );

  useEffect(() => {
    audienceInitRef.current = false;
    entrySeenUidsRef.current = new Set();
    prevAudienceUidsRef.current = new Set();
    if (entryBootstrapTimerRef.current) {
      clearTimeout(entryBootstrapTimerRef.current);
      entryBootstrapTimerRef.current = null;
    }
  }, [roomId]);

  // قبل اكتمال التهيئة — أي حضور/مقعد حالي يُسجَّل بدون دخولية (من كانوا بالروم قبلي)
  useEffect(() => {
    if (!gateOpen || audienceInitRef.current) return;
    for (const uid of audienceUidSet) entrySeenUidsRef.current.add(uid);
    for (const v of Object.values(room?.seats ?? {})) {
      const uid = (v as { uid?: string })?.uid;
      if (uid) entrySeenUidsRef.current.add(uid);
    }
  }, [gateOpen, audienceUidSet, room?.seats]);

  // بعد فتح البوابة — مهلة قصيرة لتحميل الحضور ثم تفعيل دخوليات الجدد فقط
  useEffect(() => {
    if (!gateOpen || audienceInitRef.current) return;
    if (entryBootstrapTimerRef.current) return;
    entryBootstrapTimerRef.current = setTimeout(() => {
      for (const uid of audienceUidSet) entrySeenUidsRef.current.add(uid);
      for (const v of Object.values(room?.seats ?? {})) {
        const uid = (v as { uid?: string })?.uid;
        if (uid) entrySeenUidsRef.current.add(uid);
      }
      prevAudienceUidsRef.current = new Set(entrySeenUidsRef.current);
      audienceInitRef.current = true;
      entryBootstrapTimerRef.current = null;
    }, 900);
    return () => {
      if (entryBootstrapTimerRef.current) {
        clearTimeout(entryBootstrapTimerRef.current);
        entryBootstrapTimerRef.current = null;
      }
    };
  }, [gateOpen, roomId]);

  useEffect(() => {
    if (!audienceInitRef.current) return;
    const currentUids = new Set(liveAudience.map((a) => a.uid).filter(Boolean) as string[]);
    for (const member of liveAudience) {
      if (!member.uid || member.uid === myUid) continue;
      if (prevAudienceUidsRef.current.has(member.uid)) continue;
      if (entrySeenUidsRef.current.has(member.uid)) {
        prevAudienceUidsRef.current.add(member.uid);
        continue;
      }
      // عودة لشاشة الروم وهو ما زال على المقعد — لا دخولية
      const onSeat = allSeatsRef.current.some((s) => s?.uid === member.uid);
      if (onSeat) {
        entrySeenUidsRef.current.add(member.uid);
        prevAudienceUidsRef.current.add(member.uid);
        continue;
      }

      entrySeenUidsRef.current.add(member.uid);
      prevAudienceUidsRef.current.add(member.uid);

      if (entryAnimationsEnabled) {
          const displayName = resolveDisplayName({ displayName: member.name });
          const holder = agencyPrince?.currentHolder;
          const monthKey = currentMonthKey();
          const isPrince = Boolean(
            isAgencyRoom &&
            agencyPrince?.enabled &&
            member.uid &&
            holder?.uid === member.uid &&
            holder.monthKey === monthKey,
          );

          void (async () => {
            // getUser مُخزَّن (TTL + منع تكرار) ويحفظ كل الحقول الخام عبر normalizeUserDoc
            const userData = (await getUser(member.uid!)) as unknown as Record<string, unknown> | null;
            const staffBadge = resolveStaffEntryBadgeUrl(userData ?? undefined);
            const isStaff = Boolean(parseStaffFromUserData(userData).staffRole);

            // امتياز SVIP «تأثير صوتي مميز» — صوت دخول
            void resolveEntrySoundUrl(member.uid).then((soundUrl) => {
              if (soundUrl) {
                void configureSoundEffectsAudio().then(() => playGiftSound(soundUrl)).catch(() => {});
              }
            });

            const svipEntry = await resolveRoomEntryForUser(
              member.uid,
              storeEntranceCatalog,
              vipSystem.privileges,
              vipSystem,
              aristocracy,
            );
            if (svipEntry?.videoUrl) {
              enqueueEntryVideo({
                name: displayName,
                videoUrl: svipEntry.videoUrl,
                videoUrlMp4: svipEntry.videoUrlMp4,
                key: nextEntryOverlayKey(),
              });
              if (isAgencyRoom) {
                setWelcomeEntry({
                  name: displayName,
                  key: nextEntryOverlayKey(),
                  isPrince,
                  isStaff,
                  entryImageUrl: isPrince
                    ? (agencyPrince?.entryImageUrl ?? null)
                    : staffBadge,
                });
              }
              return;
            }

            const princeVideoUrl = isPrince ? agencyPrince?.entryAnimationUrl?.trim() : '';
            if (princeVideoUrl && isVideoMediaUrl(princeVideoUrl)) {
              enqueueEntryVideo({
                name: displayName,
                videoUrl: princeVideoUrl,
                key: nextEntryOverlayKey(),
              });
              if (isAgencyRoom) {
                setWelcomeEntry({
                  name: displayName,
                  key: nextEntryOverlayKey(),
                  isPrince,
                  isStaff,
                  entryImageUrl: agencyPrince?.entryImageUrl ?? staffBadge,
                });
              }
              return;
            }

            if (isAgencyRoom) {
              setWelcomeEntry({
                name: displayName,
                key: nextEntryOverlayKey(),
                isPrince,
                isStaff,
                entryImageUrl: isPrince
                  ? (agencyPrince?.entryImageUrl ?? null)
                  : staffBadge,
              });
            }
          })();
        } else if (isAgencyRoom) {
          const displayName = resolveDisplayName({ displayName: member.name });
          const holder = agencyPrince?.currentHolder;
          const monthKey = currentMonthKey();
          const isPrince = Boolean(
            agencyPrince?.enabled &&
            member.uid &&
            holder?.uid === member.uid &&
            holder.monthKey === monthKey,
          );
          setWelcomeEntry({
            name: displayName,
            key: nextEntryOverlayKey(),
            isPrince,
            entryImageUrl: isPrince ? (agencyPrince?.entryImageUrl ?? null) : null,
          });
        }
        break;
    }
    prevAudienceUidsRef.current = currentUids;
  }, [
    liveAudience,
    myUid,
    isAgencyRoom,
    entryAnimationsEnabled,
    agencyPrince,
    storeEntranceCatalog,
    aristocracy,
    vipSystem.privileges,
    nextEntryOverlayKey,
    enqueueEntryVideo,
  ]);

  useEffect(() => {
    if (!roomId || !isHost || !canUseHostSeat) return;
    const task = InteractionManager.runAfterInteractions(() => {
      ensureHostOnSeat(roomId).catch(() => {});
    });
    return () => task.cancel?.();
  }, [roomId, isHost, canUseHostSeat, room?.hostUid]);

  useEffect(() => {
    gateResolvedRef.current = false;
    setGateOpen(false);
    setAskPassword(false);
    setPwError('');
  }, [roomId]);

  // بوابة الدخول: كلمة مرور للمقفلة (تُطلب من الخارج)، ومتابِعو المضيف فقط لوضع الأصدقاء
  useEffect(() => {
    if (!room || !roomId || !myUid || gateResolvedRef.current) return;
    if (isHost || isRoomPasswordVerified(roomId)) {
      gateResolvedRef.current = true;
      setGateOpen(true);
      return;
    }
    const m = room.mode ?? (room.isPrivate ? 'locked' : 'public');
    if (m === 'friend') {
      gateResolvedRef.current = true;
      isFollowing(room.hostUid)
        .then((following) => {
          if (following) setGateOpen(true);
          else void leaveRoomAndNavigate();
        })
        .catch(() => setGateOpen(true));
    } else if (m === 'locked' && room.password) {
      gateResolvedRef.current = true;
      setAskPassword(true);
    } else {
      gateResolvedRef.current = true;
      setGateOpen(true);
    }
  }, [room?.hostUid, room?.mode, room?.isPrivate, room?.password, isHost, myUid, roomId, leaveRoomAndNavigate]);

  const submitPassword = useCallback(
    (password: string) => {
      if (!room || !roomId) return;
      if (verifyRoomPassword(room, password)) {
        markRoomPasswordVerified(roomId);
        setAskPassword(false);
        setPwError('');
        setGateOpen(true);
      } else {
        setPwError(t('room.lockedRoomWrongPassword'));
      }
    },
    [room, roomId, t],
  );

  useEffect(() => {
    if (!activeRoomId) return;
    return subscribeToRoomPk(activeRoomId, setRoomPk);
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) return;
    return subscribeToPkMatchRequest(activeRoomId, (req) => {
      setPkMatchRequest(req);
      if (req?.status === 'searching') setShowPkMatching(true);
      if (req?.status === 'matched') {
        const key = `matched:${req.matchedAt ?? ''}`;
        if (pkMatchNotifiedRef.current !== key) {
          pkMatchNotifiedRef.current = key;
          showAlert({
            type: 'success',
            title: t('roomPk.matchFound'),
            message: t('roomPk.vsRoom', { name: req.matchedRoomName ?? '' }),
          });
          void sendMessage(activeRoomId, `⚔️ ${t('roomPk.started')}`).catch(() => {});
        }
        setTimeout(() => setShowPkMatching(false), 1500);
      }
    });
  }, [activeRoomId, showAlert, t]);

  useEffect(() => {
    if (!activeRoomId) return;
    return subscribeToSentPkInvites(activeRoomId, setPkSentInvites);
  }, [activeRoomId]);

  useEffect(() => {
    if (!roomId || !canReviewPkInvites) return;
    return subscribeToPendingPkInvitePopup(roomId, (invite) => {
      setPkPendingInvite(invite);
      if (invite) setShowPkChallengePopup(true);
    });
  }, [roomId, canReviewPkInvites]);

  // مقيّد بتركيز الشاشة — كان مسجَّلاً دائماً فيبتلع زر الرجوع حتى فوق
  // الشاشات المفتوحة من داخل الروم (بروفايل مستخدم مثلاً) فلا يعود الزر يعمل
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (showEndRoomConfirm) {
          setShowEndRoomConfirm(false);
          return true;
        }
        if (showMoreRooms) {
          setShowMoreRooms(false);
          return true;
        }
        setShowMoreRooms(true);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [showMoreRooms, showEndRoomConfirm]),
  );

  const pkLive = isPkActive(roomPk);

  // المضيف أو مشرف الإشراف (الأصفر) — كان حكراً على المضيف
  const canStartPk = isHost || myRoomMemberRole === 'yellow_supervisor';
  const openPkFlow = useCallback(() => {
    if (!canStartPk) {
      showAlert({
        type: 'warning',
        title: t('roomPk.title'),
        message: t('roomPk.hostOrSupervisorOnly', 'تحدي PK للمضيف أو مشرفي الإشراف فقط'),
      });
      return;
    }
    if (pkLive) return;
    setShowTools(false);
    setShowPkType(true);
  }, [canStartPk, pkLive, showAlert, t]);

  const confirmPendingFreeGame = useCallback(() => {
    if (!pendingFreeGameId || !activeRoomId) return;
    const def = getRoomFreeGame(pendingFreeGameId);
    if (!def?.ready) return;

    if (def.mode === 'native' && def.id === 'pk-battle') {
      setPendingFreeGameId(null);
      openPkFlow();
      return;
    }

    void (async () => {
      setStartingFreeGame(true);
      try {
        const hostName = resolveDisplayName(
          { displayName: user?.profile?.displayName, email: user?.email },
          t('rooms.userFallback'),
        );
        const session = await createRoomGameSession({
          gameId: def.id,
          roomId: activeRoomId,
          hostName,
          maxPlayers: def.maxPlayers,
        });
        setPendingFreeGameId(null);
        setFreeGame({
          gameId: def.id,
          sessionId: session.id,
          joinCode: session.joinCode,
          autoCreate: true,
        });
      } catch (e: any) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: e?.message ?? t('room.shareFailed'),
        });
      } finally {
        setStartingFreeGame(false);
      }
    })();
  }, [pendingFreeGameId, activeRoomId, user, t, showAlert, openPkFlow]);

  const handlePkEnded = useCallback(
    async (force = false) => {
      if (!roomId) return;
      try {
        const result = await endRoomPK(roomId, force);
        if (result?.winner) {
          const msg =
            result.winner === 'blue'
              ? t('roomPk.winnerBlue')
              : result.winner === 'red'
                ? t('roomPk.winnerRed')
                : t('roomPk.winnerDraw');
          await sendMessage(roomId, `🏁 ${t('roomPk.ended')}: ${msg}`).catch(() => {});
          showAlert({ type: 'success', title: t('roomPk.ended'), message: msg });
        }
      } catch (e: any) {
        showAlert({ type: 'error', title: t('common.error'), message: e?.message });
      }
    },
    [roomId, showAlert, t],
  );

  const handleStartPk = useCallback(
    async (duration: PkDuration, mode: 'in_room' | 'cross_room') => {
      const rid = activeRoomId;
      const flow = mode || pkFlowRef.current || pkFlow;
      if (!rid) {
        showAlert({ type: 'error', title: t('common.error'), message: t('room.actionFailed') });
        return;
      }
      if (!flow) {
        showAlert({ type: 'error', title: t('roomPk.title'), message: t('roomPk.startFailed') });
        return;
      }
      if (!isHost) {
        showAlert({ type: 'warning', title: t('roomPk.title'), message: t('roomPk.hostOnly') });
        return;
      }
      setPkStarting(true);
      try {
        if (flow === 'in_room') {
          await startInRoomPK(rid, duration);
          await sendMessage(rid, `⚔️ ${t('roomPk.started')}`).catch(() => {});
          setShowPkSetup(false);
          setPkFlow(null);
          pkFlowRef.current = null;
        } else if (flow === 'cross_room') {
          if (!isAgencyRoom) {
            throw new Error(t('roomPk.agencyOnly'));
          }
          await startPkAgencyMatchSearch(rid, duration);
          setShowPkSetup(false);
          setShowPkMatching(true);
        } else {
          throw new Error(t('roomPk.startFailed'));
        }
      } catch (e: unknown) {
        let msg = e instanceof Error ? e.message : t('room.actionFailed');
        if (/permission.?denied/i.test(msg) || msg.includes('PERMISSION_DENIED')) {
          msg = t('roomPk.permissionDenied');
        }
        console.warn('[PK] start failed:', msg, e);
        showAlert({ type: 'error', title: t('roomPk.title'), message: msg });
      } finally {
        setPkStarting(false);
      }
    },
    [activeRoomId, pkFlow, isHost, isAgencyRoom, showAlert, t],
  );

  const handleCancelPkMatch = useCallback(async () => {
    if (!activeRoomId) return;
    setPkStarting(true);
    try {
      await cancelPkAgencyMatchSearch(activeRoomId);
      setShowPkMatching(false);
      setPkFlow(null);
      pkFlowRef.current = null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.error');
      showAlert({ type: 'error', title: t('roomPk.title'), message: msg });
    } finally {
      setPkStarting(false);
    }
  }, [activeRoomId, showAlert, t]);

  // تحويل seats من record إلى array (محسّن بـ useMemo)
  // ⚡ مقعد تفاؤلي: يظهر المستخدم على المقعد فوراً عند الضغط قبل رجوع Firebase
  // (إحساس فوري بأخذ المايك) ثم يُمسح تلقائياً عند وصول البيانات الحقيقية أو بعد مهلة.
  const [optimisticSeat, setOptimisticSeat] = useState<number | null>(null);
  const optimisticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seatOpLockRef = useRef(false);
  const micSyncSuppressRef = useRef(0);
  const beginOptimisticSeat = useCallback((idx: number) => {
    setOptimisticSeat(idx);
    prefetchAvatarUris([mySeatAvatar]);
    if (optimisticTimerRef.current) clearTimeout(optimisticTimerRef.current);
    optimisticTimerRef.current = setTimeout(() => setOptimisticSeat(null), 5000);
  }, [mySeatAvatar]);
  const clearOptimisticSeat = useCallback(() => {
    if (optimisticTimerRef.current) {
      clearTimeout(optimisticTimerRef.current);
      optimisticTimerRef.current = null;
    }
    setOptimisticSeat(null);
  }, []);

  /** مقعد واحد لكل uid في العرض حتى مع تكرار مؤقت في RTDB */
  const dedupeSeatsForDisplay = useCallback((items: any[]): any[] => {
    const winnerByUid = new Map<string, any>();
    for (const s of items) {
      if (!s?.uid) continue;
      const prev = winnerByUid.get(s.uid);
      if (!prev || Number(s.joinedAt || 0) >= Number(prev.joinedAt || 0)) {
        winnerByUid.set(s.uid, s);
      }
    }
    return items.map((s) => {
      if (!s?.uid) return s;
      const winner = winnerByUid.get(s.uid);
      if (!winner || s.seatIndex === winner.seatIndex) return s;
      return { uid: '', seatIndex: s.seatIndex };
    });
  }, []);

  const allSeats: any[] = useMemo(() => {
    if (!room) return [];
    const base = Object.entries(room.seats ?? {}).map(([k, v]) => ({
      ...(v as any),
      seatIndex: parseInt(k.replace('seat_', ''), 10) || 0,
    }));

    const synced = dedupeSeatsForDisplay(base);

    if (optimisticSeat != null && myUid) {
      const alreadyThere = synced.some(
        (s) => s.seatIndex === optimisticSeat && s.uid === myUid,
      );
      if (!alreadyThere) {
        const mine = synced.find((s) => s.uid === myUid);
        const meSeat = mine
          ? { ...mine, seatIndex: optimisticSeat }
          : {
              uid: myUid,
              seatIndex: optimisticSeat,
              displayName: resolveDisplayName(
                { displayName: user?.profile?.displayName, email: user?.email },
                t('rooms.userFallback'),
              ),
              avatar: mySeatAvatar,
              isMuted: false,
              _optimistic: true,
            };
        return [
          ...synced.filter((s) => s.uid !== myUid && s.seatIndex !== optimisticSeat),
          meSeat,
        ];
      }
    }
    return synced;
  }, [
    room?.seats,
    optimisticSeat,
    myUid,
    user?.profile?.displayName,
    mySeatAvatar,
    user?.email,
    t,
    dedupeSeatsForDisplay,
  ]);

  // مسح المقعد التفاؤلي حالما تعكس البيانات الحقيقية وصول المستخدم للمقعد المطلوب
  useEffect(() => {
    if (optimisticSeat == null) return;
    const real = (room?.seats as any)?.[`seat_${optimisticSeat}`];
    if (real?.uid === myUid) clearOptimisticSeat();
  }, [room?.seats, optimisticSeat, myUid, clearOptimisticSeat]);

  useEffect(() => {
    allSeatsRef.current = allSeats;
  }, [allSeats]);

  const hostSeat = useMemo(
    () => allSeats.find((s) => s.seatIndex === 0 && s.uid),
    [allSeats],
  );

  const hostMicSeat = useMemo(
    () => allSeats.find((s) => s.uid === room?.hostUid),
    [allSeats, room?.hostUid],
  );

  const hostOnSeat = !!hostSeat?.uid;
  const hostDisplay = hostSeat ?? null;

  const micSupportResetCandidates = useMemo((): MicSupportResetMember[] => {
    return allSeats
      .filter((s) => s.uid && (seatSupportByUid[s.uid] ?? 0) > 0)
      .map((s) => ({
        uid: s.uid!,
        name: s.displayName ?? t('rooms.userFallback'),
        avatar: s.avatar,
        coins: seatSupportByUid[s.uid!] ?? 0,
        seatIndex: s.seatIndex,
      }))
      .sort((a, b) => (a.seatIndex ?? 99) - (b.seatIndex ?? 99));
  }, [allSeats, seatSupportByUid, t]);

  const regularSeats = useMemo(
    () =>
      allSeats
        .filter((s) => s.seatIndex !== 0 && s.seatIndex !== SECOND_HOST_SEAT_INDEX)
        .sort((a, b) => a.seatIndex - b.seatIndex),
    [allSeats],
  );

  // مقعد المدير الثاني (إن كان مُفعّلاً ومشغولاً)
  const secondHostEnabled = (room as any)?.secondHostMic === true;
  const canTakeSecondHostSeat = useMemo(
    () => canOccupySecondHostSeat(room as unknown as Record<string, unknown>, myUid, myRoomMemberRole, canUseHostSeat),
    [room, myUid, myRoomMemberRole, canUseHostSeat],
  );
  const secondHostSeat = useMemo(
    () => allSeats.find((s) => s.seatIndex === SECOND_HOST_SEAT_INDEX) ?? null,
    [allSeats],
  );

  // ⚡ خريطة المقاعد للوصول O(1) بدل .find() لكل مقعد في render
  const seatMap = useMemo(() => {
    const m = new Map<number, any>();
    regularSeats.forEach((s) => m.set(s.seatIndex, s));
    return m;
  }, [regularSeats]);

  const lockedSeatSet = useMemo(() => {
    const set = new Set<number>();
    Object.entries(room?.lockedSeats ?? {}).forEach(([key, val]) => {
      if (val !== true) return;
      const idx = parseInt(String(key).replace('seat_', ''), 10);
      if (!Number.isNaN(idx)) set.add(idx);
    });
    return set;
  }, [room?.lockedSeats]);

  // ⚡ قائمة أرقام المقاعد جاهزة (بدل Array.from كل render)
  const seatNumbers = useMemo(
    () => Array.from({ length: Number(room?.seatsCount ?? 9) - 1 }, (_, i) => i + 1),
    [room?.seatsCount],
  );

  const chatSenderUids = useMemo(
    () => [...new Set(messages.map((m) => m.uid).filter((uid): uid is string => !!uid))],
    [messages],
  );

  const frameLookupUids = useMemo(() => {
    const uids = new Set<string>();
    allSeats.forEach((s) => { if (s?.uid) uids.add(s.uid); });
    chatSenderUids.forEach((uid) => uids.add(uid));
    liveAudience.forEach((a) => { if (a.uid) uids.add(a.uid); });
    return [...uids];
  }, [allSeats, chatSenderUids, liveAudience]);

  // مفتاح مرتّب ثابت: يتغيّر فقط عند تغيّر مجموعة الـuids فعلاً (لا عند مجرد إعادة الترتيب)
  // فيمنع إعادة جلب الإطارات/الميتاداتا مع كل رسالة جديدة
  const frameLookupKey = useMemo(
    () => [...frameLookupUids].sort().join(','),
    [frameLookupUids],
  );

  const pinnedIdSet = useMemo(
    () => new Set(pinnedMessages.map((p) => p.messageId).filter(Boolean)),
    [pinnedMessages],
  );

  const canManagePinsMemo = useMemo(
    () => supervisorPerms.pinMessages,
    [supervisorPerms.pinMessages],
  );

  const handleMsgLongPress = useCallback(
    (msg: RoomMessage) => {
      if (canManagePinsMemo) {
        setActionSheetMsg(msg);
      }
    },
    [canManagePinsMemo],
  );

  const handleChatUserPress = useCallback(
    (msg: RoomMessage) => {
      if (!msg.uid || msg.uid === myUid) return;
      openRoomUserSheet({
        uid: msg.uid,
        displayName: msg.name,
        avatar: msg.avatar,
      });
    },
    [myUid, openRoomUserSheet],
  );

  const handleJoinRoomGame = useCallback(
    async (payload: { sessionId: string; gameId: RoomFreeGameId; joinCode?: string }) => {
      if (joiningRoomGame) return;
      const def = getRoomFreeGame(payload.gameId);
      if (!def?.ready || def.mode === 'native') return;
      setJoiningRoomGame(true);
      try {
        await joinRoomGameSession(payload.sessionId);
        setFreeGame({
          gameId: payload.gameId,
          sessionId: payload.sessionId,
          joinCode: payload.joinCode,
        });
        setRoomGameInvitePopup(null);
      } catch (e: any) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: e?.message ?? t('roomGameInvite.joinFailed'),
        });
      } finally {
        setJoiningRoomGame(false);
      }
    },
    [joiningRoomGame, showAlert, t],
  );

  // ⚡ مرايا (refs) لخرائط الإطار/الميتاداتا/التثبيت — تُبقي renderItem ثابت الهوية،
  //    فلا تُعاد بناء القائمة كاملةً عند وصول إطار/فقاعة لمستخدم (تحديثات أسرع وأخف).
  const chatMapsRef = useRef({
    frame: userFrameByUid,
    meta: userChatMetaByUid,
    pinned: pinnedIdSet,
    mentions: new Map(),
    onMentionPress: (_uid: string) => {},
  });

  // مُغلّف ثابت الهوية لدالة الانضمام للّعبة — يمنع كسر memo لصفوف الشات (كان arrow جديد كل رسم)
  const onJoinRoomGameCb = useCallback(
    (payload: Parameters<typeof handleJoinRoomGame>[0]) => void handleJoinRoomGame(payload),
    [handleJoinRoomGame],
  );

  const renderChatItem = useCallback(
    ({ item: msg }: { item: RoomMessage }) => {
      const maps = chatMapsRef.current;
      const m = msg.uid ? maps.meta[msg.uid] : undefined;
      return (
        <ChatMessageRow
          msg={msg}
          myUid={myUid}
          onJoinRoomGame={onJoinRoomGameCb}
          onLongPress={handleMsgLongPress}
          onUserPress={handleChatUserPress}
          isPinned={maps.pinned.has(msg.id)}
          giftsCatalog={GIFTS_CATALOG}
          frameUri={msg.uid ? maps.frame[msg.uid] : undefined}
          bubbleUri={m?.bubbleUrl}
          meta={m}
          mentionIndex={maps.mentions}
          onMentionPress={maps.onMentionPress}
        />
      );
    },
    [onJoinRoomGameCb, handleMsgLongPress, handleChatUserPress, GIFTS_CATALOG, myUid],
  );

  // رأس القائمة (رسالة الترحيب) ثابت — لا يُعاد إنشاؤه مع كل رسالة
  const chatHeaderEl = useMemo(
    () => (
      <View style={styles.systemMsg}>
        {isAgencyRoom ? (
          <>
            <Text style={styles.systemMsgTitle}>
              {getAgencyRoomWelcomeTitle(agencyHeaderName ?? room?.name ?? 'LinkUp')}
            </Text>
            <Text style={styles.systemMsgText}>
              {getAgencyRoomWelcomeBody()}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.systemMsgTitle}>
              {t('room.welcomeMessage', { name: room?.name ?? '' })}
            </Text>
            <Text style={styles.systemMsgText}>
              {(room as any)?.welcomeMessage ?? t('room.defaultWelcome')}
            </Text>
          </>
        )}
      </View>
    ),
    [isAgencyRoom, agencyHeaderName, room?.name, (room as any)?.welcomeMessage, t],
  );

  // قائمة مقلوبة (الأحدث أولاً) — تُستخدم مع FlatList inverted ليثبت الشات على آخر رسالة
  // تلقائياً ويظهر كل جديد فوراً (ريل-تايم) بلا scrollToEnd الذي كان يسبّب القفز.
  const invertedMessages = useMemo(() => {
    const arr = messages.slice();
    arr.reverse();
    return arr;
  }, [messages]);

  const keyExtractor = useCallback((m: RoomMessage) => m.id, []);

  // عدد الأعمدة المتكيّف: يختار التوزيع الأكثر تساوياً للصفوف حسب العدد وعرض الشاشة
  // مثال: 20 مقعداً → 5 أعمدة (4 صفوف متساوية) بدل 6 أعمدة (6،6،6،2 غير مرتّبة)
  const seatColumns = useMemo(() => {
    const n = seatNumbers.length;
    if (n < 4) return Math.max(1, n);
    // أقصى أعمدة حسب عرض الشاشة لإبقاء كل مقعد قابلاً للّمس
    const maxCols = Math.max(4, Math.min(6, Math.floor(SCREEN_W / 62)));
    let best = Math.min(maxCols, n);
    let bestScore = Infinity;
    for (let c = Math.min(maxCols, n); c >= 4; c--) {
      const remainder = (c - (n % c)) % c; // خلايا فارغة في الصف الأخير
      const score = remainder * 10 - c; // الأولوية: أقل فراغ، ثم أعمدة أكثر (أصغر حجماً = يتّسع أكثر)
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }, [seatNumbers.length]);

  const seatSize = useMemo<'xsmall' | 'small' | 'medium'>(() => {
    if (seatColumns >= 6) return 'xsmall';
    if (seatColumns === 5) return SCREEN_W < 360 ? 'xsmall' : 'small';
    return SCREEN_W < 360 ? 'small' : 'medium';
  }, [seatColumns]);

  // منصّة المقاعد تكبر للغرف ذات العدد الكبير (21 مقعداً) لإظهار صفوف أكثر بلا تمرير طويل
  const stageMaxHeight = SCREEN_H * (seatNumbers.length >= 16 ? 0.54 : 0.45);
  // تباعد رأسي يتقلّص كلما زاد عدد المقاعد → يبقى الشات واضحاً ولا تنزل الصفوف عليه
  const stageRowGap = seatNumbers.length >= 16 ? 4 : seatNumbers.length >= 10 ? 6 : 10;
  // كلما كثُرت الصفوف نرفع المنصّة للأعلى قليلاً ونقلّص الحشو السفلي لإفساح الشات
  const stageMarginTop = seatNumbers.length >= 16 ? -30 : seatNumbers.length >= 10 ? -27 : -24;
  const stagePaddingBottom = seatNumbers.length >= 10 ? 4 : 6;

  useEffect(() => {
    const unsub = subscribeToStoreItems((items) => {
      const bubbles = items.filter((i) => i.type === 'bubble');
      setStoreBubbleCatalog(bubbles);
      setStoreEntranceCatalog(items.filter((i) => i.type === 'entrance'));
      prefetchMessageBubbleUris(bubbles.map((i) => storeItemMediaUrl(i)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    prefetchMessageBubbleUris(
      Object.values(userChatMetaByUid).map((m) => m.bubbleUrl),
    );
  }, [userChatMetaByUid]);

  useEffect(() => {
    prefetchMessageBubbleUris(Object.values(userFrameByUid));
  }, [userFrameByUid]);

  const seatAvatarPrefetchKey = useMemo(
    () =>
      [
        ...allSeats.map((s) => `${s.uid ?? ''}:${s.avatar ?? ''}`),
        ...liveAudience.map((a) => `${a.uid ?? ''}:${a.avatar ?? ''}`),
        mySeatAvatar,
      ]
        .sort()
        .join('|'),
    [allSeats, liveAudience, mySeatAvatar],
  );

  useEffect(() => {
    prefetchAvatarUris([
      ...allSeats.map((s) => s.avatar),
      ...liveAudience.map((a) => a.avatar),
      mySeatAvatar,
      room?.hostAvatar,
    ]);
  }, [seatAvatarPrefetchKey, room?.hostAvatar]);

  useEffect(() => {
    if (!frameLookupUids.length || !roomFrames.length) {
      setUserFrameByUid({});
      return;
    }
    let cancelled = false;
    fetchEquippedFrameUrlsForUsers(frameLookupUids, roomFrames).then((map) => {
      if (!cancelled) setUserFrameByUid(map);
    });
    return () => { cancelled = true; };
  }, [frameLookupKey, roomFrames]);

  useEffect(() => {
    if (!frameLookupUids.length) return;
    let cancelled = false;
    // كاش دائم في الخدمة → المستخدمون المعروفون يعودون فوراً، والجدد فقط يُجلبون.
    // نَدمج النتائج تدريجياً حتى لا تختفي أوسمة/فقاعات من ظهروا سابقاً.
    fetchChatUserMetaForUsers(
      frameLookupUids,
      storeBubbleCatalog,
      vipSystem,
      aristocracy,
      agencyPrince,
    ).then((map) => {
      if (!cancelled) setUserChatMetaByUid((prev) => ({ ...prev, ...map }));
    });
    return () => { cancelled = true; };
  }, [frameLookupKey, storeBubbleCatalog, vipSystem.privileges, aristocracy, agencyPrince]);

  const mySeat = useMemo(
    () => allSeats.find((s) => s.uid === myUid),
    [allSeats, myUid],
  );

  // بعد إعلان mySeat — كان أعلى الملف فيقرأ mySeat قبل تعريفه (TS2448/undefined أول رندر)
  const canDjRoomMusic = useMemo(
    () => !!mySeat && (!roomMusic || roomMusic.addedBy === myUid),
    [mySeat, roomMusic, myUid],
  );

  useEffect(() => {
    onMicKeepAliveRef.current = !!mySeat;
    useRoomSessionStore.getState().setMicSeatIndex(mySeat?.seatIndex ?? null);
  }, [mySeat]);

  // عدّاد دقائق مهام مستوى الثروة اليومية — «البقاء في غرفة» و«وقت المايك».
  // كل دقيقة داخل الغرفة تُسجَّل، ومعها دقيقة مايك إن كنت على مقعد.
  const onSeatForXpRef = useRef(false);
  useEffect(() => {
    onSeatForXpRef.current = !!mySeat;
  }, [mySeat]);
  useEffect(() => {
    if (!roomId) return;
    const iv = setInterval(() => {
      void import('@/services/firebase/rewardsCenter')
        .then(({ trackRewardsRoomMinutes }) =>
          trackRewardsRoomMinutes(1, onSeatForXpRef.current ? 1 : 0),
        )
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, [roomId]);

  /** على المايك: تثبيت العضوية وإلغاء onDisconnect — يبقى المقعد عند واتساب/فيسبوك */
  useEffect(() => {
    if (!roomId || !gateOpen || !mySeat) return;
    keepRoomAliveRef.current = true;
    const session = useRoomSessionStore.getState();
    useRoomSessionStore.getState().pinMembership({
      roomId,
      roomName: session.roomName || room?.name || t('room.voiceRoom'),
      roomBanner: session.roomBanner,
      canPublish: true,
      micSeatIndex: mySeat.seatIndex,
    });
    void pinRoomSession(roomId);
  }, [roomId, gateOpen, mySeat?.seatIndex, room?.name, t]);

  /** مغادرة المقعد صراحةً — إعادة ربط onDisconnect للمستمع فقط */
  useEffect(() => {
    if (!roomId || !gateOpen || mySeat) return;
    const session = useRoomSessionStore.getState();
    if (session.roomId !== roomId || !session.canPublish) return;
    keepRoomAliveRef.current = false;
    useRoomSessionStore.getState().pinMembership({
      roomId,
      roomName: session.roomName,
      roomBanner: session.roomBanner,
      canPublish: false,
      micSeatIndex: null,
    });
    void rebindRoomOnDisconnectHandlers(roomId);
  }, [roomId, gateOpen, mySeat]);

  const roomGamePlayerName = useMemo(
    () =>
      resolveDisplayName(
        { displayName: user?.profile?.displayName, email: user?.email },
        mySeat?.displayName ?? t('rooms.userFallback'),
      ),
    [user?.profile?.displayName, user?.email, mySeat?.displayName, t],
  );

  // قائمة المتصلين — roomAudience المباشر فقط (بدون room.audience القديم)
  const audienceMembers = useMemo(() => {
    const liveByUid = new Map(
      liveAudience
        .filter((a) => a.uid && audienceUidSet.has(a.uid))
        .map((a) => [a.uid!, a]),
    );
    const members = new Map<string, {
      uid: string;
      name: string;
      avatar?: string;
      isVIP: boolean;
      vipLevel?: number;
      level: number;
      onSeat: boolean;
      seatIndex?: number;
    }>();

    allSeats
      .filter((s) => s?.uid)
      .forEach((s) => {
        const uid = String(s.uid);
        members.set(uid, {
          uid,
          name: resolveDisplayName({ displayName: s.displayName }, t('rooms.userFallback')),
          avatar: s.avatar,
          isVIP: Boolean(s.isVIP) || (s.level ?? 0) >= 10,
          vipLevel: s.vipLevel,
          level: s.level ?? 1,
          onSeat: true,
          seatIndex: s.seatIndex,
        });
      });

    for (const uid of audienceUidSet) {
      if (!uid || members.has(uid)) continue;
      const live = liveByUid.get(uid);
      // «إخفاء في الغرفة» — لا يظهر في قائمة المتصلين لأحد سواه
      if (live?.hiddenInRoom === true && uid !== myUid) continue;
      members.set(uid, {
        uid,
        name: resolveDisplayName({ displayName: live?.name }, t('rooms.userFallback')),
        avatar: live?.avatar,
        isVIP: Boolean(live?.isVIP) || (live?.level ?? 0) >= 10,
        vipLevel: live?.vipLevel,
        level: live?.level ?? 1,
        onSeat: false,
      });
    }

    return Array.from(members.values()).sort((a, b) => {
      if (a.isVIP !== b.isVIP) return a.isVIP ? -1 : 1;
      if (a.onSeat !== b.onSeat) return a.onSeat ? -1 : 1;
      if (a.level !== b.level) return b.level - a.level;
      return a.name.localeCompare(b.name);
    });
  }, [allSeats, liveAudience, audienceUidSet, myUid, t]);

  const roomMentionIndex = useMemo(() => {
    const members: Array<{ uid: string; name: string; publicAccountId?: string | number }> = [];
    for (const m of audienceMembers) {
      if (!m.uid) continue;
      members.push({
        uid: m.uid,
        name: m.name,
        publicAccountId: connectedProfiles[m.uid]?.publicAccountId,
      });
    }
    for (const s of allSeats) {
      if (!s.uid) continue;
      members.push({
        uid: s.uid,
        name: s.displayName ?? '',
        publicAccountId: connectedProfiles[s.uid]?.publicAccountId,
      });
    }
    if (room?.hostUid) {
      members.push({
        uid: room.hostUid,
        name: room.hostName ?? '',
        publicAccountId: connectedProfiles[room.hostUid]?.publicAccountId,
      });
    }
    return buildRoomMentionIndex(members);
  }, [audienceMembers, allSeats, room?.hostUid, room?.hostName, connectedProfiles]);

  const handleMentionPress = useCallback(
    (uid: string) => {
      if (!uid) return;
      router.push(`/profile/${uid}` as any);
    },
    [router],
  );

  useEffect(() => {
    chatMapsRef.current = {
      ...chatMapsRef.current,
      mentions: roomMentionIndex,
      onMentionPress: handleMentionPress,
    };
  }, [roomMentionIndex, handleMentionPress]);

  const chatExtraData = useMemo(
    () => ({
      frame: userFrameByUid,
      meta: userChatMetaByUid,
      pinned: pinnedIdSet,
      mentions: roomMentionIndex,
    }),
    [userFrameByUid, userChatMetaByUid, pinnedIdSet, roomMentionIndex],
  );

  const roomGamePickerMembers = useMemo(
    () =>
      audienceMembers.map((m) => ({
        uid: m.uid,
        name: m.name,
        avatar: m.avatar,
        onSeat: m.onSeat,
      })),
    [audienceMembers],
  );

  const enrichedAudienceMembers = useMemo((): ConnectedUserRow[] => {
    const ageFromBirthYear = (y?: number): number | null => {
      if (!y || y < 1900) return null;
      const age = new Date().getFullYear() - y;
      return age > 0 && age < 120 ? age : null;
    };
    const rows: ConnectedUserRow[] = [];
    for (const m of audienceMembers) {
      const p = connectedProfiles[m.uid];
      const privacy = p ? getUserPrivacy(p as unknown as Record<string, unknown>) : null;
      // «إخفاء في الغرفة» من إعدادات الخصوصية — يخفيه عن الجميع سواه
      if (privacy?.hideInRoom && m.uid !== myUid && !m.onSeat) continue;
      const hideSvip = Boolean(privacy?.hideSvipIdentity) && m.uid !== myUid;
      rows.push({
        ...m,
        // صورة/اسم البروفايل الحقيقيان — سجل الحضور يلتقط photoURL من Auth
        // لحظة الدخول (فارغ غالباً لحسابات الهاتف) فتظهر المضيفة بلا صورة
        avatar: (p as any)?.profile?.avatar || p?.avatar || m.avatar,
        name: (p as any)?.profile?.displayName || p?.displayName || m.name,
        vipLevel: hideSvip ? 0 : (p?.vipLevel ?? m.vipLevel),
        isVIP: hideSvip ? false : (m.isVIP || Boolean(p?.isVIP)),
        level: p?.level ?? m.level,
        gender: p?.gender,
        age: ageFromBirthYear(p?.birthYear),
        coins: p?.coins,
        pearls: p?.pearls,
      });
    }
    return rows;
  }, [audienceMembers, connectedProfiles, myUid]);

  const vipAudienceMembers = useMemo(
    () => enrichedAudienceMembers.filter((m) => m.isVIP),
    [enrichedAudienceMembers],
  );

  useEffect(() => {
    const uids = [...new Set(audienceMembers.map((m) => m.uid).filter(Boolean))].slice(0, 80);
    if (!uids.length) return;
    const missing = uids.filter((uid) => !(uid in connectedProfiles));
    if (!missing.length) return;

    let cancelled = false;
    Promise.all(missing.map((uid) => getUser(uid).catch(() => null)))
      .then((results) => {
        if (cancelled) return;
        setConnectedProfiles((prev) => {
          const next = { ...prev };
          missing.forEach((uid, i) => {
            next[uid] = results[i] ?? null;
          });
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [audienceMembers, connectedProfiles]);

  useEffect(() => {
    if (!showAudienceModal) return;
    const uids = audienceMembers.map((m) => m.uid).slice(0, 60);
    if (!uids.length) return;
    let cancelled = false;
    setProfilesLoading(true);
    Promise.all(uids.map((uid) => getUser(uid).catch(() => null)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, UserDoc | null> = {};
        uids.forEach((uid, i) => {
          map[uid] = results[i] ?? null;
        });
        setConnectedProfiles((prev) => ({ ...prev, ...map }));
      })
      .finally(() => {
        if (!cancelled) setProfilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAudienceModal, audienceMembers]);

  const presenceCount = useMemo(
    () => derivePresenceCount(room, liveAudience, audienceUidSet),
    [room, room?.seats, room?.hostUid, liveAudience, audienceUidSet],
  );

  // ===== LiveKit: الصوت الحقيقي للغرفة =====
  // على مقعد فقط = ينشر صوت (الكل يسمعه). خارج المقعد = مستمع فقط.
  const onMic = !!mySeat;
  const canSpeak = onMic;
  const canShareVideoTool = onMic && canShareVideoPermission;
  /** إظهار أيقونة الفيديو طالما على المايك — الصلاحية تُفحص عند الضغط فقط */
  const showVideoShareTool = onMic;
  const {
    participants: lkParticipants,
    connectionState: lkConnectionState,
  } = useLiveKitRoom({
    roomName: roomId ? `room_${roomId}` : '',
    canPublish: onMic && gateOpen,
    autoConnect: Boolean(roomId) && gateOpen,
  });

  useEffect(() => {
    if (!gateOpen) return;
    roomAudioSession.setRemoteAudioMuted(volumeMuted);
  }, [gateOpen, volumeMuted]);

  // بعد إعادة الاتصال (مثلاً الجلوس على المقعد) — إعادة ضبط مستوى السماع
  useEffect(() => {
    if (!gateOpen || lkConnectionState !== 'connected') return;
    roomAudioSession.setRemoteAudioMuted(volumeMuted);
  }, [gateOpen, volumeMuted, lkConnectionState]);

  // بعد العودة من «احتفظ» — إعادة ضبط LiveKit (نشر/استماع) دون انتظار انقطاع كامل
  useEffect(() => {
    if (!roomId || !gateOpen || !pendingPinnedAudioResumeRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      pendingPinnedAudioResumeRef.current = false;
      void resyncRoomAudioAfterResume(roomId, !!mySeat).catch(() => {});
    });
    return () => task.cancel?.();
  }, [roomId, gateOpen, mySeat]);

  useFocusEffect(
    useCallback(() => {
      const muted = useRoomSessionStore.getState().listenMuted;
      setVolumeMuted(muted);
      if (gateOpen) {
        roomAudioSession.setRemoteAudioMuted(muted);
      }
    }, [gateOpen]),
  );

  // تحميل مسبق لتوكن النشر عند الضغط على مقعد (قبل اكتمال Firebase)
  useEffect(() => {
    if (!roomId || optimisticSeat == null) return;
    prefetchRoomAudio(`room_${roomId}`, true);
  }, [roomId, optimisticSeat]);

  // بعد الجلوس على المقعد واكتمال الاتصال — تأكيد السماع والمايك
  useEffect(() => {
    if (!gateOpen || lkConnectionState !== 'connected') return;
    roomAudioSession.setRemoteAudioMuted(volumeMuted);
    roomAudioSession.resyncRemoteAudio();
    if (!onMic || !mySeat) return;
    if (mySeat.isMuted !== true) {
      void roomAudioSession.setMuted(false);
    }
  }, [gateOpen, onMic, lkConnectionState, mySeat?.isMuted, mySeat?.seatIndex, volumeMuted]);

  // مغادرة المقعد → إيقاف المايك فوراً قبل إعادة اتصال LiveKit كمستمع
  useEffect(() => {
    if (!gateOpen || onMic) return;
    void roomAudioSession.setMuted(true);
  }, [gateOpen, onMic]);

  // مزامنة كتم المايك مع حالة المقعد في Firebase (بعد إعادة الاتصال أو كتم من المضيف)
  useEffect(() => {
    if (!onMic || !gateOpen || !mySeat) return;
    if (Date.now() - micSyncSuppressRef.current < 800) return;
    void roomAudioSession.setMuted(mySeat.isMuted === true);
  }, [onMic, gateOpen, mySeat?.isMuted, mySeat?.seatIndex]);

  // مطابقة حالة التحدث الفعلية مع المقاعد (هل المشارك يتكلم الآن؟)
  const speakingIdentities = useMemo(
    () =>
      new Set(
        lkParticipants
          .filter(
            (p) =>
              !p.isMuted &&
              (p.isSpeaking || (p.audioLevel ?? 0) > 0.01),
          )
          .map((p) => p.identity),
      ),
    [lkParticipants],
  );

  const audioLevelByUid = useMemo(() => {
    const map: Record<string, number> = {};
    lkParticipants.forEach((p) => {
      if (!p.isMuted && (p.audioLevel ?? 0) > 0) {
        map[p.identity] = p.audioLevel ?? 0;
      }
    });
    return map;
  }, [lkParticipants]);

  const musicBroadcasterUid =
    roomMusic?.isPlaying ? roomMusic.addedBy : null;

  const headerMediaStatus = useMemo(() => {
    if (roomVideo?.isPlaying) {
      return {
        kind: 'video' as const,
        label: t('room.mediaVideoLive'),
        title: roomVideo.title,
      };
    }
    return null;
  }, [roomVideo, t]);

  const musicUiDismissed = useRoomMusicUiStore((s) => s.localDismissed);

  const handleOpenMusicSheet = useCallback(() => {
    setShowMusicSheet(true);
  }, []);

  // فحص حالة المفضّلة عند تحميل الروم
  useEffect(() => {
    if (!roomId) return;
    isRoomFavorited(roomId).then(setIsFavorited).catch(() => {});
  }, [roomId]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToConversations(setPrivateConversations);
    return unsub;
  }, [user?.uid]);

  const privateUnreadCount = useMemo(
    () => sumPrivateUnreadCount(privateConversations, user?.uid),
    [privateConversations, user?.uid],
  );

  const handleToggleFavorite = async () => {
    if (!roomId || !room || !user?.uid) return;
    try {
      if (isFavorited) {
        await unfavoriteRoom(roomId);
        setIsFavorited(false);
        showAlert({
          type: 'success',
          title: t('room.favoriteRemoved'),
          message: t('rooms.interestRemoved'),
        });
      } else {
        await favoriteRoom(
          roomId,
          room.name ?? t('room.defaultRoomName'),
          room.hostName,
          room.hostAvatar,
          {
            agencyId: room.agencyId,
            isAgencyRoom: isAgencyRoom,
          },
        );
        setIsFavorited(true);
        showAlert({
          type: 'success',
          title: t('room.favoriteAdded'),
          message: t('rooms.interestAdded'),
        });
      }
    } catch (e: unknown) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('room.actionFailed'),
      });
    }
  };

  const shareInviteItems = useMemo((): ShareInviteItem[] => {
    if (!roomId || !room) return [];
    const roomName = room.name ?? t('room.defaultRoomName');
    const items: ShareInviteItem[] = [
      { kind: 'room', roomId, roomName },
    ];
    if (
      isAgencyLiveRoom(room) &&
      room.agencyId &&
      (user?.agencyRole === 'owner' || user?.isAgent) &&
      user?.agencyId === room.agencyId
    ) {
      items.push({
        kind: 'agency',
        agencyId: room.agencyId,
        agencyName: user?.agencyName ?? roomName,
      });
    }
    return items;
  }, [roomId, room, user?.agencyId, user?.agencyName, user?.agencyRole, user?.isAgent, t]);

  const handleShareRoom = () => {
    if (!roomId || !room) return;
    if (!canSendRoomInviteTool) {
      showPermissionDenied('roomSettings.permDeniedSendRoomInvite');
      return;
    }
    setShowShareToChat(true);
  };

  const promptLeaveMicSeat = useCallback(
    (seatIdx: number) => {
      if (!roomId) return;
      showAlert({
        type: 'warning',
        title: t('room.leaveSeatTitle'),
        message: t('room.leaveSeatMsg'),
        buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('room.leaveSeatConfirm'),
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveSeat(roomId, seatIdx);
              } catch (e: any) {
                showAlert({
                  type: 'error',
                  title: t('common.error'),
                  message: e?.message ?? t('room.actionFailed'),
                });
              }
            },
          },
        ],
      });
    },
    [roomId, showAlert, t],
  );

  const handleJoinSeat = async (seatIdx: number) => {
    if (seatOpLockRef.current) return;
    seatOpLockRef.current = true;
    try {
      if (seatIdx === 0) {
        if (!canTakeHostSeat) {
          showAlert({
            type: 'warning',
            title: t('room.hostSeat'),
            message: isAgencyRoom ? t('room.hostSeatLocked') : t('room.hostSeatRestricted'),
          });
          return;
        }
        if (mySeat && mySeat.seatIndex !== 0) {
          beginOptimisticSeat(0);
          try {
            await changeSeat(roomId!, 0);
          } catch (e) {
            clearOptimisticSeat();
            throw e;
          }
          return;
        }
        if (mySeat?.seatIndex === 0) {
          promptLeaveMicSeat(0);
          return;
        }
        beginOptimisticSeat(0);
        try {
          await ensureHostOnSeat(roomId!);
        } catch (e) {
          clearOptimisticSeat();
          throw e;
        }
        return;
      }

      // المستخدم على مقعد آخر → تبديل فوري
      if (mySeat && mySeat.seatIndex !== seatIdx) {
        beginOptimisticSeat(seatIdx);
        try {
          await changeSeat(roomId!, seatIdx);
        } catch (e) {
          clearOptimisticSeat();
          throw e;
        }
        return;
      }
      // نفس المقعد = اقتراح مغادرة
      if (mySeat && mySeat.seatIndex === seatIdx) {
        promptLeaveMicSeat(seatIdx);
        return;
      }

      // الحصول على رسم المقعد + التحقق من صلاحية المايك
      const perSeatFee = (room as any)?.seatFees?.[`seat_${seatIdx}`];
      const seatFee = typeof perSeatFee === 'number'
        ? perSeatFee
        : (typeof (room as any)?.seatFee === 'number' ? (room as any).seatFee : 0);
      const roomPermsLocal = parseRoomPermissions((room || {}) as any);
      const hasMicAccess = canTakeMicSeat(
        canUseHostSeat,
        myRoomMemberRole,
        roomPermsLocal,
        isMyAgencyMember,
      );
      const needsMicMembership = !isHost && !hasMicAccess;
      const needsJoinMicModal = needsMicMembership || (seatFee > 0 && !isHost && !isRoomMicMember);

      if (needsJoinMicModal) {
        setPendingJoinSeatIdx(seatIdx);
        setJoinMicFee(seatFee);
        setShowJoinMicModal(true);
        return;
      }

      beginOptimisticSeat(seatIdx);
      await joinSeat(roomId!, seatIdx);
    } catch (e: any) {
      clearOptimisticSeat();
      if (e?.message === GUEST_MIC_MEMBERSHIP_REQUIRED) {
        const perSeatFee = (room as any)?.seatFees?.[`seat_${seatIdx}`];
        const seatFee = typeof perSeatFee === 'number'
          ? perSeatFee
          : (typeof (room as any)?.seatFee === 'number' ? (room as any).seatFee : 0);
        setPendingJoinSeatIdx(seatIdx);
        setJoinMicFee(seatFee);
        setShowJoinMicModal(true);
        return;
      }
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('room.actionFailed') });
    } finally {
      seatOpLockRef.current = false;
    }
  };

  const handleJoinMicConfirm = async () => {
    if (pendingJoinSeatIdx == null || !roomId) return;
    if (seatOpLockRef.current) return;
    const seatIdx = pendingJoinSeatIdx;
    const hasMicAccess = canTakeMicSeat(
      canUseHostSeat,
      myRoomMemberRole,
      roomPerms,
      isMyAgencyMember,
    );
    const needsMembership = !isHost && !hasMicAccess;

    setJoinMicLoading(true);
    seatOpLockRef.current = true;
    try {
      beginOptimisticSeat(seatIdx);
      await joinSeat(roomId, seatIdx, { purchaseMembership: needsMembership });
      setShowJoinMicModal(false);
      setPendingJoinSeatIdx(null);
      await refreshUser();
    } catch (e: any) {
      clearOptimisticSeat();
      const msg = e?.message ?? t('room.actionFailed');
      if (msg.includes('رصيد') || msg.includes('كاف')) {
        showAlert({
          type: 'warning',
          title: t('room.insufficientCoins'),
          message: t('room.needMoreCoins'),
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('room.recharge'), onPress: () => router.push('/wallet/recharge' as any) },
          ],
        });
      } else {
        showAlert({ type: 'error', title: t('common.error'), message: msg });
      }
    } finally {
      seatOpLockRef.current = false;
      setJoinMicLoading(false);
    }
  };

  const handleToggleMute = async () => {
    if (!mySeat || !roomId) return;
    const nextMuted = !(mySeat.isMuted === true);
    micSyncSuppressRef.current = Date.now();
    try {
      // RTDB أولاً — يفحص الكتم الإداري (mutedBy) ويرفض فك الكتم الذاتي
      await toggleMute(roomId, mySeat.seatIndex, nextMuted);
    } catch (e) {
      showAlert({
        type: 'warning',
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('room.actionFailed'),
      });
      return;
    }
    try {
      await roomAudioSession.setMuted(nextMuted);
    } catch {
      // صامت — لا alert أثناء انتظار الاتصال
    }
  };

  const handleChangeChat = useCallback((value: string) => {
    if (chatIgnoreChangeRef.current) return;
    setChatText(value);
  }, []);

  const clearChatInput = useCallback(() => {
    chatIgnoreChangeRef.current = true;
    setChatText('');
    setChatInputResetKey((k) => k + 1);
    chatInputRef.current?.blur();
    requestAnimationFrame(() => {
      chatIgnoreChangeRef.current = false;
    });
  }, []);

  const handleSendMessage = async (messageText?: string) => {
    const text = sanitizeMentionTextForSend((messageText ?? chatText).trim());
    if (!text || !user) return;
    if (myChatMuted) {
      showAlert({
        type: 'warning',
        title: t('room.chatMutedTitle'),
        message: t('room.chatMutedError'),
      });
      return;
    }
    clearChatInput();
    const senderProfile: RoomSenderProfile = {
      name: resolveDisplayName(
        { displayName: user.profile?.displayName, email: user.email },
        t('rooms.userFallback'),
      ),
      avatar: user.profile?.avatar ?? '',
    };
    try {
      await sendMessage(roomId!, text, senderProfile);
      // بعد الإرسال انتقل لأحدث رسالة (offset 0 = الأسفل في القائمة المقلوبة)
      requestAnimationFrame(() => {
        chatScrollRef.current?.scrollToOffset?.({ offset: 0, animated: true });
      });
      // امتياز SVIP «رسائل طائرة»: تمرّ رسالة العضو عبر شاشة الغرفة
      if (roomId && userHasVipFeature(user, 'flyingMessage', vipSystem)) {
        const myName = resolveDisplayName(
          { displayName: (user as any)?.displayName ?? (user as any)?.profile?.displayName },
          'SVIP',
        );
        void sendFlyingMessage(roomId, text, { name: myName, avatar: (user as any)?.avatar ?? (user as any)?.profile?.avatar }).catch(() => {});
      }
    } catch (e: any) {
      chatIgnoreChangeRef.current = false;
      setChatText(text);
      setChatInputResetKey((k) => k + 1);
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleSendAnimatedEmoji = useCallback((emoji: string) => {
    if (!roomId || !emoji?.trim()) return;
    if (myChatMuted) {
      showAlert({
        type: 'warning',
        title: t('room.chatMutedTitle'),
        message: t('room.chatMutedError'),
      });
      return;
    }
    const onMic = !!mySeat;
    if (!onMic && room?.permissions && !room.permissions.allowOffMicEmojis) {
      showAlert({
        type: 'warning',
        title: t('roomSettings.offMicEmoji'),
        message: t('roomSettings.offMicEmojiDenied'),
      });
      return;
    }

    if (myUid) showSeatEmoji(myUid, emoji);
    void sendEmojiMessage(roomId, emoji).catch(() => {});
  }, [roomId, isHost, mySeat, room?.permissions, myUid, myChatMuted, showSeatEmoji, showAlert, t]);

  const giftRecipients: GiftPickerRecipient[] = useMemo(() => {
    const list = audienceMembers
      .filter((m) => m.uid)
      .map((m) => ({
        uid: m.uid,
        name: resolveDisplayName({ displayName: m.name }, t('rooms.userFallback')),
        avatar: m.avatar,
        seatLabel: m.onSeat
          ? m.seatIndex === 0
            ? '★'
            : m.seatIndex
          : undefined,
        isMe: m.uid === myUid,
      }));

    // السماح بإهداء النفس حتى لو لم يظهر بعد في قائمة الحضور
    if (myUid && !list.some((r) => r.uid === myUid)) {
      list.unshift({
        uid: myUid,
        name: roomGamePlayerName,
        avatar: mySeatAvatar || undefined,
        seatLabel: mySeat
          ? mySeat.seatIndex === 0
            ? '★'
            : mySeat.seatIndex
          : undefined,
        isMe: true,
      });
    }

    return list;
  }, [audienceMembers, myUid, mySeat, mySeatAvatar, roomGamePlayerName, t]);

  const playRoomGiftAnimation = useCallback(
    (
      gift: GiftType,
      qty: number,
      opts: {
        recipientName: string;
        recipientUid?: string;
        recipientAvatar?: string;
        isGroupGift?: boolean;
        recipientCount?: number;
      },
      comboOpts?: { isCombo?: boolean; displayQty?: number },
    ) => {
      if (!user || !giftAnimationsEnabled) return;
      const displayQty = comboOpts?.displayQty ?? qty;
      const payload = resolveGiftAnimationPayload(GIFTS_CATALOG, {
        giftId: gift.id,
        giftName: gift.name,
        giftQuantity: displayQty,
        giftPrice: gift.price * displayQty,
        imageUrl: gift.imageUrl,
        animationUrl: gift.animationUrl,
        soundUrl: gift.soundUrl,
        videoUrl: gift.videoUrl,
      });
      if (!payload) return;
      playOrBumpComboAnimation(
        {
          ...payload,
          senderName: resolveDisplayName({
            displayName: user.profile.displayName,
            email: user.email,
          }),
          recipientName: opts.recipientName,
          recipientUid: opts.recipientUid,
          recipientAvatar: opts.recipientAvatar,
          isGroupGift: opts.isGroupGift,
          recipientCount: opts.recipientCount,
          key: Date.now(),
        },
        comboOpts?.isCombo,
      );
    },
    [GIFTS_CATALOG, user, giftAnimationsEnabled, playOrBumpComboAnimation],
  );

  const handleSendGift = async (
    gift: GiftType,
    quantity: number,
    recipientUids: string | string[],
    opts?: { isCombo?: boolean },
  ) => {
    let uids = (Array.isArray(recipientUids) ? recipientUids : [recipientUids]).filter(Boolean);
    if (!gift || uids.length === 0 || !user || !roomId) return;
    if (sendingGift && !opts?.isCombo) return;

    // حارس وقت الإرسال: لا تُرسَل هدية لمن غادر الغرفة بين فتح النافذة والضغط —
    // القائمة كانت تُلتقط عند الفتح فتصل هدايا لمن «مسكّرين ومو موجودين»
    const stillHere = new Set<string>();
    for (const m of audienceMembers) if (m.uid) stillHere.add(m.uid);
    for (const s of allSeats) if (s.uid) stillHere.add(s.uid);
    if (myUid) stillHere.add(myUid);
    const absent = uids.filter((u) => !stillHere.has(u));
    uids = uids.filter((u) => stillHere.has(u));
    if (uids.length === 0) {
      showAlert({
        type: 'warning',
        title: t('common.error'),
        message: t('room.giftRecipientLeft', 'المستلم غادر الغرفة — لم تُرسل الهدية'),
      });
      setShowGifts(false);
      return;
    }
    if (absent.length > 0) {
      showAlert({
        type: 'info',
        title: t('gifts.title', 'الهدايا'),
        message: t('room.giftSomeLeft', 'بعض المستلمين غادروا الغرفة واستُبعدوا من الإرسال'),
      });
    }

    const totalPer = gift.price * quantity;
    const totalAll = totalPer * uids.length;
    if ((user.stats?.coins ?? 0) < totalAll) {
      Alert.alert(t('room.insufficientCoins'), t('room.needMoreCoins'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('room.recharge'), onPress: () => router.push('/wallet/recharge' as any) },
      ]);
      return;
    }

    setSendingGift(true);
    const isGroupGift = uids.length > 1;

    if (!isGroupGift && uids.length === 1) {
      const recipientUid = uids[0]!;
      if (!opts?.isCombo) {
        comboChatRef.current = {
          messageId: '',
          giftId: gift.id,
          toUid: recipientUid,
          totalQuantity: quantity,
          totalValue: totalPer,
          lastWrittenValue: 0,
        };
      } else if (
        comboChatRef.current &&
        comboChatRef.current.giftId === gift.id &&
        comboChatRef.current.toUid === recipientUid
      ) {
        comboChatRef.current.totalQuantity += quantity;
        comboChatRef.current.totalValue += totalPer;
      }
    }

    const patchComboChatMessage = () => {
      const bucket = comboChatRef.current;
      if (!bucket?.messageId || isGroupGift) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === bucket.messageId
            ? {
                ...m,
                giftQuantity: bucket.totalQuantity,
                giftValue: bucket.totalValue,
              }
            : m,
        ),
      );
    };

    // أسماء المستلمين تُحسب مرة واحدة
    const recipientNames = uids.map((uid) => {
      const seat = allSeats.find((s) => s.uid === uid);
      const member = audienceMembers.find((m) => m.uid === uid);
      return resolveDisplayName({ displayName: seat?.displayName ?? member?.name });
    });

    const comboDisplayQty =
      !isGroupGift && comboChatRef.current ? comboChatRef.current.totalQuantity : quantity;

    // ⚡ تفاؤلي: الأنيميشن فوري — المودال يبقى مفتوحاً لدعم وضع الكومبو
    if (isGroupGift) {
      showGroupGiftOnSeats(gift, uids);
      playRoomGiftAnimation(gift, quantity, {
        recipientName: t('room.sendToAll'),
        isGroupGift: true,
        recipientCount: uids.length,
      });
    } else {
      const recipientUid = uids[0]!;
      const recipientSeat = allSeats.find((s) => s?.uid === recipientUid);
      playRoomGiftAnimation(
        gift,
        quantity,
        {
          recipientName: recipientNames[0] ?? '',
          recipientUid,
          recipientAvatar: recipientSeat?.avatar,
        },
        { isCombo: opts?.isCombo, displayQty: comboDisplayQty },
      );
    }
    patchComboChatMessage();
    setSendingGift(false);

    const senderNameResolved = resolveDisplayName({
      displayName: user.profile?.displayName,
      email: user.email,
    });
    const senderAvatarResolved = mySeatAvatar;
    const senderProfile: RoomSenderProfile = {
      name: senderNameResolved,
      avatar: senderAvatarResolved,
    };
    primeRoomSenderProfile(senderNameResolved, senderAvatarResolved);

    void (async () => {
      try {
        if (isGroupGift) {
          void sendGiftInRoom(
            roomId,
            {
              giftId: gift.id,
              giftName: gift.name,
              giftValue: totalAll,
              giftQuantity: quantity,
              imageUrl: gift.imageUrl,
              animationUrl: gift.animationUrl,
              soundUrl: gift.soundUrl,
              videoUrl: gift.videoUrl,
              isGroupGift: true,
              recipientCount: uids.length,
            },
            senderProfile,
          ).catch((e) => console.warn('group gift chat failed:', e));
        }

        await runWithConcurrency(uids, GIFT_SEND_CONCURRENCY, async (recipientUid, i) => {
          const recipientName = recipientNames[i]!;

          const giftResult = await buyAndSendGift(gift, recipientUid, recipientName, roomId, quantity);
          const supportCoins = giftResult.coinsForRecipient;

          if (!isGroupGift) {
            const writeComboChat = async () => {
              const bucket = comboChatRef.current;
              if (!bucket || bucket.giftId !== gift.id || bucket.toUid !== recipientUid) {
                const messageId = await sendGiftInRoom(
                  roomId,
                  {
                    giftId: gift.id,
                    giftName: gift.name,
                    giftValue: totalPer,
                    giftQuantity: quantity,
                    imageUrl: gift.imageUrl,
                    animationUrl: gift.animationUrl,
                    soundUrl: gift.soundUrl,
                    videoUrl: gift.videoUrl,
                    toUid: recipientUid,
                    toName: recipientName,
                  },
                  senderProfile,
                );
                comboChatRef.current = {
                  messageId,
                  giftId: gift.id,
                  toUid: recipientUid,
                  totalQuantity: quantity,
                  totalValue: totalPer,
                  lastWrittenValue: totalPer,
                };
                patchComboChatMessage();
                return;
              }

              const ensureMessageId = async (): Promise<string> => {
                const b = comboChatRef.current;
                if (!b) throw new Error('combo bucket missing');
                if (b.messageId) return b.messageId;
                if (!b.createPromise) {
                  b.createPromise = (async () => {
                    const live = comboChatRef.current;
                    if (!live) throw new Error('combo bucket missing');
                    const messageId = await sendGiftInRoom(
                      roomId,
                      {
                        giftId: gift.id,
                        giftName: gift.name,
                        giftValue: live.totalValue,
                        giftQuantity: live.totalQuantity,
                        imageUrl: gift.imageUrl,
                        animationUrl: gift.animationUrl,
                        soundUrl: gift.soundUrl,
                        videoUrl: gift.videoUrl,
                        toUid: recipientUid,
                        toName: recipientName,
                      },
                      senderProfile,
                    );
                    const after = comboChatRef.current;
                    if (after) {
                      after.messageId = messageId;
                      after.lastWrittenValue = after.totalValue;
                      delete after.createPromise;
                    }
                    return messageId;
                  })();
                }
                return b.createPromise;
              };

              const messageId = await ensureMessageId();
              const live = comboChatRef.current;
              if (!live || live.messageId !== messageId) return;

              const delta = live.totalValue - live.lastWrittenValue;
              if (delta <= 0) return;

              await updateRoomGiftMessage(roomId, messageId, {
                giftQuantity: live.totalQuantity,
                giftValue: live.totalValue,
              });
              if (live.lastWrittenValue > 0) {
                await incrementRoomGiftTotal(roomId, delta);
              }
              live.lastWrittenValue = live.totalValue;
              patchComboChatMessage();
            };

            comboChatWriteRef.current = comboChatWriteRef.current
              .catch(() => undefined)
              .then(writeComboChat);
          }

          void recordRocketGiftContribution(roomId, {
            uid: user.uid,
            name: senderNameResolved,
            avatar: senderAvatarResolved,
            coins: totalPer,
            level: user.stats?.level,
            isVIP: Boolean(user.isVIP),
            vipLevel: user.vipLevel,
          });

          void recordRoomGiftContribution(roomId, {
            uid: user.uid,
            name: senderNameResolved,
            avatar: senderAvatarResolved,
            coins: totalPer,
            level: user.stats?.level,
            vipLevel: user.vipLevel,
          });

          if (supportCoins > 0) {
            void recordRoomGiftSupportReceived(roomId, recipientUid, supportCoins);
          }

          void syncUserSeatLevelInRoom(roomId, recipientUid, giftResult.recipientLevel).catch(() => {});
          if (user.uid) {
            void syncUserSeatLevelInRoom(roomId, user.uid, giftResult.senderLevel).catch(() => {});
          }

          if (throneActive) {
            void recordThroneGiftContribution(
              roomId,
              {
                uid: user.uid,
                name: senderNameResolved,
                avatar: senderAvatarResolved,
                coins: totalPer,
                level: user.stats?.level,
                vipLevel: user.vipLevel,
              },
              throneConfig.minGiftCoins,
            );
          }

          if (isPkActive(roomPk) && user.uid !== recipientUid) {
            try {
              await recordPKGift(
                roomId,
                totalPer,
                user.uid,
                recipientUid,
                senderNameResolved,
                senderAvatarResolved,
              );
            } catch (pkErr) {
              console.warn('recordPKGift failed:', pkErr);
            }
          }
        });

        void refreshUser?.();
      } catch (e: any) {
        console.warn('handleSendGift failed:', e);
        Alert.alert(t('common.error'), e?.message ?? t('chat.giftSendFailed'));
      }
    })();
  };

  const handleExit = () => {
    setShowMoreRooms(true);
  };

  const handleMusicTool = useCallback(async () => {
    if (!roomId || musicBusy) return;
    if (!user?.uid) {
      showAlert({
        type: 'warning',
        title: t('common.error'),
        message: t('room.musicLoginRequired'),
      });
      return;
    }
    if (!mySeat) {
      showPermissionDenied('room.musicOnMicOnly');
      return;
    }
    if (!canShareMusicTool) {
      showPermissionDenied('roomSettings.permDeniedShareMusic');
      return;
    }
    if (roomMusic && roomMusic.addedBy !== user.uid && !canManageRoomMusic) {
      showAlert({
        type: 'info',
        title: t('room.musicNowPlaying'),
        message: t('room.musicListening'),
      });
      return;
    }

    setShowTools(false);
    setMusicBusy(true);
    try {
      await waitAfterSheetDismiss();
      setShowMusicSheet(true);
    } finally {
      setMusicBusy(false);
    }
  }, [roomId, musicBusy, user?.uid, mySeat, roomMusic, showAlert, t, canShareMusicTool, showPermissionDenied, canManageRoomMusic]);

  const prevOnSeatForMusicRef = useRef<boolean | null>(null);
  useEffect(() => {
    const onSeat = !!mySeat;
    if (
      prevOnSeatForMusicRef.current === true &&
      !onSeat &&
      roomId &&
      myUid &&
      roomMusic?.addedBy === myUid
    ) {
      void stopRoomMusicPlayback().catch(() => {});
      void removeMusicFromRoom(roomId).catch(() => {});
    }
    prevOnSeatForMusicRef.current = onSeat;
  }, [mySeat, roomId, myUid, roomMusic?.addedBy]);

  const openOtherAgency = useCallback(
    async (agencyId: string) => {
      try {
        const oldRoomId = roomId;
        setShowMoreRooms(false);
        await enterAgencyRoomAndNavigate(router, agencyId, { replace: true });
        if (oldRoomId) {
          void completeRoomLeave(oldRoomId, user?.uid);
        } else {
          useRoomSessionStore.getState().clear();
          void roomAudioSession.disconnect();
        }
      } catch (e: any) {
        Alert.alert(t('room.actionFailed'), e?.message ?? t('common.error'));
      }
    },
    [router, t, roomId, user?.uid],
  );

  const renderOtherAgencyItem = useCallback(
    ({ item: agency }: { item: Agency }) => {
      const linkedRoom = otherAgencyRooms[agency.id];
      const audience = linkedRoom?.audienceCount ?? agency.members ?? 0;
      const banner =
        agency.banner ||
        agency.logo ||
        linkedRoom?.banner ||
        `https://picsum.photos/seed/ag-${agency.id}/400/200`;
      return (
        <Pressable onPress={() => void openOtherAgency(agency.id)} style={styles.roomCard}>
          <Image
            source={{ uri: banner }}
            style={styles.roomCardImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={agency.id}
          />
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                variant="bodySmall"
                color={colors.white}
                weight="bold"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {agency.name}
              </Text>
              <RealCountryFlag countryCode={agency.country ?? 'PS'} size={14} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.partyPillMini}>
                <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 10 }}>
                  {t('room.partyBadge')}
                </Text>
              </View>
              <Text
                variant="caption"
                color="rgba(255,255,255,0.72)"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {agency.ownerName || t('room.hostFallback')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users size={11} color={lu.colors.gold} strokeWidth={2.5} />
              <Text variant="caption" color={lu.colors.gold} weight="bold" style={{ fontSize: 10 }}>
                {audience}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [openOtherAgency, otherAgencyRooms, t],
  );

  const pinRoomSessionAndNavigate = useCallback(
    (navigate: () => void) => {
      if (!roomId) return;
      const canSpeakNow = !!mySeat;
      const displayName = room?.name ?? t('room.voiceRoom');
      const hostAvatar =
        hostMicSeat?.avatar ?? hostSeat?.avatar ?? room?.hostAvatar;
      const bubbleImage = isAgencyRoom
        ? resolveAgencyLogoImage(linkedAgency, { roomBanner: room?.banner }) ||
          room?.banner
        : room?.banner || hostAvatar;
      keepRoomAliveRef.current = true;
      useRoomMusicUiStore.getState().setActive(roomId);
      useRoomMusicUiStore.getState().resetDismiss();
      useRoomVideoUiStore.getState().setPinned(roomId, { unmuted: true });
      useRoomSessionStore.getState().minimize({
        roomId,
        roomName: displayName,
        roomBanner: bubbleImage,
        canPublish: canSpeakNow,
        micSeatIndex: mySeat?.seatIndex ?? null,
      });
      setShowMoreRooms(false);
      closeBottomPanels();

      // لا ننتظر عمليات الشبكة قبل التنقّل — لتجنّب ثِقل/تأخير واجهة "احتفظ".
      InteractionManager.runAfterInteractions(navigate);
      void pinRoomSession(roomId).catch(() => {});
      void syncPinnedRoomListenAudio(roomId).catch(() => {});
    },
    [
      roomId,
      mySeat,
      room?.name,
      room?.hostAvatar,
      room?.banner,
      hostMicSeat?.avatar,
      hostSeat?.avatar,
      isAgencyRoom,
      linkedAgency,
      t,
      closeBottomPanels,
    ],
  );

  const handleKeepRoomInBackground = useCallback(() => {
    pinRoomSessionAndNavigate(navigateAwayWhilePinned);
  }, [pinRoomSessionAndNavigate, navigateAwayWhilePinned]);

  const handleOpenPrivateChats = useCallback(() => {
    pinRoomSessionAndNavigate(() => {
      router.push('/(tabs)/chat' as any);
    });
  }, [pinRoomSessionAndNavigate, router]);

  const handleOpenPrivateChatWith = useCallback(
    (target: { uid: string }) => {
      if (!target.uid) return;
      setSeatUser(null);
      pinRoomSessionAndNavigate(() => {
        router.push(`/chat/${target.uid}` as any);
      });
    },
    [pinRoomSessionAndNavigate, router],
  );

  const handleFullExitRoom = () => {
    if (!roomId) return;
    setShowMoreRooms(false);
    leaveRoomAndNavigate();
  };

  const sendMicInviteToUser = useCallback(
    async (uid: string, name: string, seatIdx?: number) => {
      if (!roomId || !room) return;
      try {
        await sendRoomMicInvite({
          targetUid: uid,
          targetName: name,
          roomId,
          roomName: room.name ?? t('room.defaultRoomName'),
          seatIdx: seatIdx ?? inviteSeatIdx ?? undefined,
          includeMembership: false,
          inviterName: resolveDisplayName({
            displayName: user?.profile?.displayName,
            email: user?.email,
          }),
          inviterAvatar: user?.profile?.avatar,
        });
        setSeatUser(null);
        showAlert({
          type: 'success',
          title: t('common.done'),
          message: t('room.micInviteSent'),
        });
      } catch (e: unknown) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: e instanceof Error ? e.message : t('room.actionFailed'),
        });
      }
    },
    [
      roomId,
      room,
      inviteSeatIdx,
      isAgencyRoom,
      user?.profile?.displayName,
      user?.profile?.avatar,
      user?.email,
      showAlert,
      t,
    ],
  );

  const handleConnectedAddToMic = useCallback(
    async (uid: string) => {
      const member = enrichedAudienceMembers.find((m) => m.uid === uid);
      const name = member?.name ?? t('rooms.userFallback');
      setShowAudienceModal(false);
      await sendMicInviteToUser(uid, name);
    },
    [enrichedAudienceMembers, sendMicInviteToUser, t],
  );

  const handleConnectedRemoveFromMic = useCallback(
    async (uid: string) => {
      if (!roomId || micBusyUid) return;
      setMicBusyUid(uid);
      try {
        await hostRemoveUserFromMic(roomId, uid);
        showAlert({ type: 'success', title: t('common.done'), message: t('room.removeFromMic') });
      } catch (e: any) {
        showAlert({ type: 'error', title: t('common.error'), message: e?.message });
      } finally {
        setMicBusyUid(null);
      }
    },
    [roomId, micBusyUid, showAlert, t],
  );

  const handleToggleUserMicMute = useCallback(
    async (uid: string) => {
      if (!roomId) return;
      try {
        const muted = await hostToggleUserMicMute(roomId, uid);
        showAlert({
          type: 'success',
          title: t('common.done'),
          message: muted ? t('room.micLockedSuccess') : t('room.micUnlockedSuccess'),
        });
      } catch (e: unknown) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: e instanceof Error ? e.message : t('room.actionFailed'),
        });
      }
    },
    [roomId, showAlert, t],
  );

  const handleToggleUserChatMute = useCallback(
    async (uid: string) => {
      if (!roomId) return;
      try {
        const muted = await hostToggleUserChatMuted(roomId, uid);
        showAlert({
          type: 'success',
          title: t('common.done'),
          message: muted ? t('room.chatMutedSuccess') : t('room.chatUnmutedSuccess'),
        });
      } catch (e: unknown) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: e instanceof Error ? e.message : t('room.actionFailed'),
        });
      }
    },
    [roomId, showAlert, t],
  );

  const handleConnectedUserPress = useCallback(
    (m: ConnectedUserRow) => {
      setShowAudienceModal(false);
      openRoomUserSheet({
        uid: m.uid,
        displayName: m.name,
        avatar: m.avatar,
        level: m.level,
        isVIP: m.isVIP,
        vipLevel: (m as any).vipLevel,
        onSeat: m.onSeat,
        seatIndex: m.onSeat ? m.seatIndex : undefined,
        agencyMemberDocId: agencyMemberDocByUid.get(m.uid),
      });
    },
    [openRoomUserSheet, agencyMemberDocByUid],
  );

  const handleInfoMemberPress = useCallback(
    (m: RoomInfoMemberRow) => {
      setShowRoomInfo(false);
      openRoomUserSheet({
        uid: m.uid,
        displayName: m.name,
        avatar: m.avatar,
        level: m.level,
        isVIP: m.isVIP,
        vipLevel: (m as any).vipLevel,
        onSeat: m.onSeat,
        agencyMemberDocId: m.memberDocId,
      });
    },
    [openRoomUserSheet],
  );

  // #3: تنفيذ مباشر بدون نافذة تأكيد — رسالة نتيجة فقط (يمكن إعادة الدعوة لاحقاً)
  const handleCancelMembership = useCallback(
    async (memberDocId: string, uid: string) => {
      void uid;
      try {
        await removeAgencyMember(memberDocId);
        setSeatUser(null);
        showAlert({ type: 'success', title: t('common.done'), message: t('roomInfo.membershipCancelled') });
      } catch (e: any) {
        showAlert({ type: 'error', title: t('common.error'), message: e?.message });
      }
    },
    [showAlert, t],
  );

  /** إغلاق أي sheet مفتوح ثم فتح موديل مدة الطرد (تجنّب تداخل Modals) */
  const openKickBanFlow = useCallback((uid: string, name: string) => {
    setSeatUser(null);
    setShowRoomInfo(false);
    setShowAudienceModal(false);
    setTimeout(() => setKickTarget({ uid, name }), 80);
  }, []);

  const handleRoomToolAction = useCallback(
    (action: RoomToolAction, payload?: { activityId?: string; gameId?: string }) => {
      if (action === 'free-game' && payload?.gameId && activeRoomId) {
        const def = getRoomFreeGame(payload.gameId);
        if (!def?.ready) {
          showAlert({ type: 'info', title: t('room.featureComingSoon'), message: t('room.featureComingSoon') });
          return;
        }
        setShowTools(false);
        setPendingFreeGameId(def.id);
        return;
      }
      if (action === 'activity' && payload?.activityId) {
        const map: Record<string, string> = {
          vip: '/vip',
          aristocracy: '/vip/aristocracy',
          svip: '/vip',
          'gift-wall': '/gifts',
          'gold-miner': '/games',
        };
        router.push((map[payload.activityId] ?? '/store') as any);
        return;
      }
      if (action === 'music') {
        if (!mySeat) {
          showPermissionDenied('room.musicOnMicOnly');
          return;
        }
        if (!canShareMusicTool) {
          showPermissionDenied('roomSettings.permDeniedShareMusic');
          return;
        }
        void handleMusicTool();
        return;
      }
      if (action === 'share') {
        if (!canSendRoomInviteTool) {
          showPermissionDenied('roomSettings.permDeniedSendRoomInvite');
          return;
        }
        void handleShareRoom();
        return;
      }
      if (action === 'lucky-bag') {
        setShowLuckyBagModal(true);
        return;
      }
      if (action === 'rocket') {
        openRocketTools();
        return;
      }
      if (action === 'throne') {
        if (!showThroneTool) return;
        if (!throneUnlockedByLevel) {
          showAlert({
            type: 'info',
            title: t('roomThrone.lockedByLevelTitle'),
            message: t('roomThrone.lockedByLevelMessage', { level: AGENCY_THRONE_UNLOCK_LEVEL }),
          });
          return;
        }
        if (!throneActive) {
          if (isHost) {
            Alert.alert(
              t('roomThrone.notEnabledTitle'),
              t('roomThrone.notEnabledHost'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('roomSettings.title'),
                  onPress: () => setShowRoomSettings(true),
                },
              ],
            );
          } else {
            showAlert({
              type: 'info',
              title: t('roomThrone.notEnabledTitle'),
              message: t('roomThrone.notEnabledGuest'),
            });
          }
          return;
        }
        setShowThroneModal(true);
        return;
      }
      if (action === 'settings') {
        if (isAgencyRoom) setShowRoomSettings(true);
        else router.push(`/room/edit?id=${roomId}` as any);
        return;
      }
      if (action === 'pk') {
        openPkFlow();
        return;
      }
      if (action === 'notice') {
        if (isAgencyRoom) return;
        const canPin = supervisorPerms.pinMessages;
        if (!canPin) {
          showAlert({
            type: 'warning',
            title: t('room.permissionRequired'),
            message: t('room.pinAnnouncementOwnerOnly'),
          });
          return;
        }
        setShowPinModal(true);
        return;
      }
      if (action === 'video') {
        if (!canSpeak) {
          showPermissionDenied('room.videoOnMicOnly');
          return;
        }
        const ownsActiveVideo = Boolean(roomVideo?.addedBy && roomVideo.addedBy === myUid);
        if (!canShareVideoPermission && !ownsActiveVideo) {
          showPermissionDenied('roomSettings.permDeniedShareVideo');
          return;
        }
        if (roomVideo) {
          showAlert({
            type: 'warning',
            title: t('room.videoExists'),
            message: t('room.videoReplaceConfirm'),
            buttons: [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('room.replace'), onPress: () => setShowVideoModal(true) },
            ],
          });
        } else {
          setShowVideoModal(true);
        }
        return;
      }
      if (action === 'sound') {
        setShowEmoji(false);
        setShowVoiceModal(true);
        return;
      }
      if (action === 'effects') {
        if (!supervisorPerms.manageEffects) {
          showAlert({
            type: 'warning',
            title: t('room.permissionRequired'),
            message: t('roomEffects.manageEffectsHostOnly'),
          });
          return;
        }
        setShowTools(false);
        setShowEffectsModal(true);
        return;
      }
      if (action === 'clean-screen') {
        setShowTools(false);
        setSimpleScreen((v) => !v);
        return;
      }
      if (action === 'reset-mic-support') {
        if (!supervisorPerms.resetMicSupport) {
          showAlert({
            type: 'warning',
            title: t('room.permissionRequired'),
            message: t('roomEffects.resetMicSupportHostOnly'),
          });
          return;
        }
        setShowTools(false);
        setShowResetMicSupportModal(true);
        return;
      }
      if (action === 'clean-chat') {
        if (!supervisorPerms.cleanChat) {
          showAlert({
            type: 'warning',
            title: t('room.permissionRequired'),
            message: t('roomEffects.clearChatHostOnly'),
          });
          return;
        }
        setShowTools(false);
        Alert.alert(t('roomTools.basic.cleanChat'), t('roomEffects.clearChatConfirm'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('roomEffects.clearChatAction'),
            style: 'destructive',
            onPress: () => {
              void clearRoomChatHistory(roomId!)
                .then(() => {
                  showAlert({
                    type: 'success',
                    title: t('roomEffects.clearChatDone'),
                    message: t('roomEffects.clearChatDoneMsg'),
                  });
                })
                .catch((e: any) => {
                  showAlert({
                    type: 'error',
                    title: t('common.error'),
                    message: e?.message ?? t('roomEffects.clearChatFailed'),
                  });
                });
            },
          },
        ]);
        return;
      }
      const labelKey =
        action === 'poll'
          ? 'roomTools.interactive.poll'
          : action === 'broadcast'
            ? 'roomTools.interactive.broadcast'
            : action === 'quality'
              ? 'roomTools.basic.quality'
              : 'room.featureComingSoon';
      Alert.alert(t(labelKey), t('room.featureComingSoon'));
    },
    [
      activeRoomId,
      supervisorPerms.resetMicSupport,
      supervisorPerms.cleanChat,
      supervisorPerms.pinMessages,
      supervisorPerms.manageEffects,
      canSendRoomInviteTool,
      canShareMusicTool,
      canShareVideoTool,
      showVideoShareTool,
      canSpeak,
      mySeat,
      myUid,
      handleMusicTool,
      handleShareRoom,
      showPermissionDenied,
      isAgencyRoom,
      isHost,
      openPkFlow,
      openRocketTools,
      room,
      roomId,
      roomVideo,
      router,
      showAlert,
      showThroneTool,
      throneActive,
      t,
      user?.uid,
    ],
  );

  useEffect(() => {
    if (!myUid || !activeRoomId) return;
    return subscribePendingRoomGameInvites(myUid, (invites) => {
      if (freeGame) {
        setRoomGameInvitePopup(null);
        return;
      }
      const inRoom = invites.filter((i) => i.roomId === activeRoomId);
      if (!inRoom.length) {
        setRoomGameInvitePopup((prev) =>
          prev && prev.roomId === activeRoomId ? null : prev,
        );
        return;
      }
      setRoomGameInvitePopup(inRoom[0] ?? null);
    });
  }, [myUid, activeRoomId, freeGame]);

  const acceptRoomGameInvitePopup = useCallback(() => {
    if (!roomGameInvitePopup) return;
    void handleJoinRoomGame({
      sessionId: roomGameInvitePopup.sessionId,
      gameId: roomGameInvitePopup.gameId,
      joinCode: roomGameInvitePopup.joinCode,
    }).then(() => {
      if (myUid && roomGameInvitePopup) {
        void resolveRoomGameInvite(myUid, roomGameInvitePopup.id, 'accepted');
        void clearRoomGameInvite(myUid, roomGameInvitePopup.id);
      }
    });
  }, [roomGameInvitePopup, handleJoinRoomGame, myUid]);

  const declineRoomGameInvitePopup = useCallback(() => {
    if (!roomGameInvitePopup || !myUid) return;
    void resolveRoomGameInvite(myUid, roomGameInvitePopup.id, 'declined');
    void clearRoomGameInvite(myUid, roomGameInvitePopup.id);
    setRoomGameInvitePopup(null);
  }, [roomGameInvitePopup, myUid]);

  useEffect(() => {
    if (!myUid || !activeRoomId) return;
    // نعرض فقط الدعوات المرسلة بعد دخولي الغرفة (بهامش 30 ثانية) —
    // دعوة قديمة من قبل دخولي كانت تنبثق فوراً وكأن أحداً دعاني للتو
    const enteredAt = Date.now();
    return subscribePendingRoomMicInvites(myUid, (invites) => {
      const inRoom = invites.filter(
        (i) => i.roomId === activeRoomId && i.createdAt >= enteredAt - 30_000,
      );
      // على المايك بالفعل؟ لا معنى لدعوة مايك — تُتجاهل بدل أن تُربك المستخدم
      setMicInvitePopup(mySeatRefForInvites.current ? null : inRoom[0] ?? null);
    });
  }, [myUid, activeRoomId]);
  const mySeatRefForInvites = useRef(false);
  useEffect(() => {
    mySeatRefForInvites.current = !!mySeat;
    // إخفاء دعوة معروضة إن صعدتُ للمايك بطريقة أخرى قبل قبولها
    if (mySeat) setMicInvitePopup(null);
  }, [mySeat]);

  useEffect(() => {
    if (!myUid || !isAgencyRoom || !room?.agencyId) {
      setAgencyInvitePopup(null);
      return;
    }
    return subscribeToMyReceivedAgencyInvites((invites) => {
      const forAgency = invites.filter(
        (i) => i.agencyId === room.agencyId && i.status === 'pending',
      );
      setAgencyInvitePopup(forAgency[0] ?? null);
    });
  }, [myUid, isAgencyRoom, room?.agencyId]);

  const acceptMicInvitePopup = useCallback(async () => {
    if (!micInvitePopup) return;
    setMicInviteLoading(true);
    try {
      // مهلة قصوى — بدونها كان مؤشر «قبول» يدور للأبد عند تعليق الشبكة
      await Promise.race([
        acceptRoomMicInvite(micInvitePopup),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('الشبكة بطيئة — تعذّر إكمال القبول، حاول مرة أخرى')),
            20_000,
          ),
        ),
      ]);
      setMicInvitePopup(null);
      showAlert({
        type: 'success',
        title: t('common.done'),
        message: t('room.addToMic'),
      });
    } catch (e: unknown) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: friendlyErrorMessage(e, t('room.actionFailed')),
      });
    } finally {
      setMicInviteLoading(false);
    }
  }, [micInvitePopup, showAlert, t]);

  const declineMicInvitePopup = useCallback(() => {
    if (!micInvitePopup || !myUid) return;
    void resolveRoomMicInvite(myUid, micInvitePopup.id, 'declined');
    void clearRoomMicInvite(myUid, micInvitePopup.id);
    setMicInvitePopup(null);
  }, [micInvitePopup, myUid]);

  const acceptAgencyInvitePopup = useCallback(async () => {
    if (!agencyInvitePopup) return;
    setAgencyInviteLoading(true);
    try {
      await acceptDirectAgencyInvite(agencyInvitePopup.id);
      setAgencyInvitePopup(null);
      showAlert({
        type: 'success',
        title: t('common.done'),
        message: t('room.inviteAgencyAccepted'),
      });
    } catch (e: unknown) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('room.actionFailed'),
      });
    } finally {
      setAgencyInviteLoading(false);
    }
  }, [agencyInvitePopup, showAlert, t]);

  const declineAgencyInvitePopup = useCallback(() => {
    if (!agencyInvitePopup) return;
    void rejectDirectAgencyInvite(agencyInvitePopup.id);
    setAgencyInvitePopup(null);
  }, [agencyInvitePopup]);

  // ⚡ معالجات ضغط المقاعد مستقرة المرجع (واحدة لكل مقعد) حتى لا يُبطل onPress
  //    الجديد ذاكرة RoomSeat فتُعاد رسمة كل المقاعد مع كل رسالة شات.
  const seatPressRef = useRef<(seatNum: number) => void>(() => {});
  const resolveSeatFrameUri = useCallback(
    (uid: string | undefined, occupant: any) => {
      if (!uid) return undefined;
      const standardFrame = userFrameByUid[uid];
      if (standardFrame) return standardFrame;
      const privileges = vipSystem?.privileges || [];
      const vipLevel = Number(occupant?.vipLevel ?? 0);
      const hasVipSeat = hasVipPrivilege(occupant, 'vipSeat', privileges);
      if (hasVipSeat && vipSystem) {
        const seatPriv = resolveVipPrivilegeAsset(vipLevel, 'vipSeat', vipSystem);
        if (seatPriv?.imageUrl) {
          return seatPriv.imageUrl;
        }
      }
      return undefined;
    },
    [userFrameByUid, vipSystem],
  );

  seatPressRef.current = (seatNum: number) => {
    const occupant = seatMap.get(seatNum);
    if (occupant?.uid) {
      openRoomUserSheet({
        uid: occupant.uid,
        displayName: occupant.displayName,
        avatar: occupant.avatar,
        level: occupant.level,
        isVIP: occupant.isVIP,
        vipLevel: occupant.vipLevel,
        onSeat: true,
        seatIndex: seatNum,
      });
    } else {
      const locked = lockedSeatSet.has(seatNum);
      if (isAgencyRoom && (canUseHostSeat || canInviteToMicTool)) {
        setEmptySeatSheet({ seatIdx: seatNum, locked });
        return;
      }
      if (locked) {
        showAlert({
          type: 'warning',
          title: t('room.seatLockedTitle'),
          message: t('room.seatLockedMessage'),
        });
        return;
      }
      void handleJoinSeat(seatNum);
    }
  };
  const seatPressHandlers = useMemo(() => {
    const map: Record<number, () => void> = {};
    for (const n of seatNumbers) map[n] = () => seatPressRef.current(n);
    return map;
  }, [seatNumbers]);

  // معالج مقعد المضيف ثابت المرجع (يمنع إعادة بناء مقعد المضيف عند كل تحديث للروم)
  const hostSeatPressRef = useRef<() => void>(() => {});
  hostSeatPressRef.current = () => {
    if (hostDisplay?.uid) {
      openRoomUserSheet({
        uid: hostDisplay.uid,
        displayName: hostDisplay.displayName,
        avatar: hostDisplay.avatar,
        level: hostDisplay.level,
        isVIP: hostDisplay.isVIP,
        vipLevel: hostDisplay.vipLevel,
        onSeat: true,
        seatIndex: 0,
      });
      return;
    }
    if (canTakeHostSeat) {
      void handleJoinSeat(0);
      return;
    }
    showAlert({
      type: 'warning',
      title: t('room.hostSeat'),
      message: isAgencyRoom ? t('room.hostSeatLocked') : t('room.hostSeatRestricted'),
    });
  };
  const handleHostSeatPress = useCallback(() => hostSeatPressRef.current(), []);

  // الضغط على مقعد المدير الثاني: مشغول → ملف المستخدم؛ فارغ → أخذه (إدارة فقط، مجاناً)
  const secondHostSeatPressRef = useRef<() => void>(() => {});
  secondHostSeatPressRef.current = () => {
    const occ = secondHostSeat;
    if (occ?.uid) {
      openRoomUserSheet({
        uid: occ.uid,
        displayName: occ.displayName,
        avatar: occ.avatar,
        level: occ.level,
        isVIP: occ.isVIP,
        vipLevel: occ.vipLevel,
        onSeat: true,
        seatIndex: SECOND_HOST_SEAT_INDEX,
      });
      return;
    }
    const locked = lockedSeatSet.has(SECOND_HOST_SEAT_INDEX);
    if (canUseHostSeat || supervisorPerms.lockSeats) {
      setEmptySeatSheet({ seatIdx: SECOND_HOST_SEAT_INDEX, locked });
      return;
    }
    if (locked) {
      showAlert({
        type: 'warning',
        title: t('room.seatLockedTitle'),
        message: t('room.seatLockedMessage'),
      });
      return;
    }
    if (!canTakeSecondHostSeat) {
      showAlert({ type: 'warning', title: t('room.secondHostSeat'), message: t('room.secondHostSeatRestricted') });
      return;
    }
    void (async () => {
      beginOptimisticSeat(SECOND_HOST_SEAT_INDEX);
      try {
        if (mySeat && mySeat.seatIndex !== SECOND_HOST_SEAT_INDEX) {
          await changeSeat(roomId!, SECOND_HOST_SEAT_INDEX);
        } else {
          await joinSeat(roomId!, SECOND_HOST_SEAT_INDEX);
        }
      } catch (e: any) {
        clearOptimisticSeat();
        showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('room.actionFailed') });
      }
    })();
  };
  const handleSecondHostSeatPress = useCallback(() => secondHostSeatPressRef.current(), []);

  const seatSupportForUid = useCallback(
    (uid?: string) => {
      if (!uid) return undefined;
      return seatSupportByUid[uid] ?? 0;
    },
    [seatSupportByUid],
  );

  if (!room) {
    return (
      <View style={styles.loading}>
        <LinearGradient
          colors={[...lu.gradients.room]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  const hostSeatLabel = isAgencyRoom ? undefined : t('room.hostSeat');

  const renderHostSeat = () => {
    const hostSeatEl = (
      <View style={styles.hostCenterWrap}>
        <RoomSeat
          seatIndex={0}
          avatar={hostDisplay?.avatar}
          frameUri={resolveSeatFrameUri(hostDisplay?.uid, hostDisplay)}
          displayName={hostDisplay?.displayName}
          emptySeatLabel={hostSeatLabel}
          hideEmptySeatLabel={isAgencyRoom}
          isHost
          isMuted={hostOnSeat ? hostSeat?.isMuted : true}
          isSpeaking={
            hostOnSeat &&
            ((hostSeat?.uid ? speakingIdentities.has(hostSeat.uid) : false) || hostSeat?.isSpeaking)
          }
          audioLevel={hostSeat?.uid ? audioLevelByUid[hostSeat.uid] : undefined}
          isPlayingMusic={
            !!hostDisplay?.uid &&
            !!musicBroadcasterUid &&
            musicBroadcasterUid === hostDisplay.uid
          }
          isVIP={hasVipPrivilege(hostDisplay, 'vipBadge', vipSystem?.privileges || [])}
          level={hostDisplay?.level ?? 1}
          coins={seatSupportForUid(hostDisplay?.uid)}
          size="large"
          shape="circle"
          empty={!hostDisplay?.uid}
          overlayEmoji={hostDisplay?.uid ? seatEmojiByUid[hostDisplay.uid] : undefined}
          overlayGift={hostDisplay?.uid ? seatGiftByUid[hostDisplay.uid] : undefined}
          onPress={handleHostSeatPress}
        />
      </View>
    );

    const secondSeatEl = secondHostEnabled ? (
      <View style={styles.hostCenterWrap}>
        <RoomSeat
          seatIndex={SECOND_HOST_SEAT_INDEX}
          avatar={secondHostSeat?.avatar}
          frameUri={resolveSeatFrameUri(secondHostSeat?.uid, secondHostSeat)}
          displayName={secondHostSeat?.displayName}
          emptySeatLabel={isAgencyRoom ? undefined : t('room.secondHostSeat')}
          hideEmptySeatLabel={isAgencyRoom}
          isMuted={secondHostSeat?.uid ? secondHostSeat?.isMuted : true}
          isSpeaking={
            !!secondHostSeat?.uid &&
            ((secondHostSeat?.uid ? speakingIdentities.has(secondHostSeat.uid) : false) || secondHostSeat?.isSpeaking)
          }
          audioLevel={secondHostSeat?.uid ? audioLevelByUid[secondHostSeat.uid] : undefined}
          isPlayingMusic={
            !!secondHostSeat?.uid &&
            !!musicBroadcasterUid &&
            musicBroadcasterUid === secondHostSeat.uid
          }
          isVIP={hasVipPrivilege(secondHostSeat, 'vipBadge', vipSystem?.privileges || [])}
          level={secondHostSeat?.level ?? 1}
          coins={seatSupportForUid(secondHostSeat?.uid)}
          size="large"
          shape="circle"
          empty={!secondHostSeat?.uid}
          isLocked={!secondHostSeat?.uid && lockedSeatSet.has(SECOND_HOST_SEAT_INDEX)}
          overlayEmoji={secondHostSeat?.uid ? seatEmojiByUid[secondHostSeat.uid] : undefined}
          overlayGift={secondHostSeat?.uid ? seatGiftByUid[secondHostSeat.uid] : undefined}
          onPress={handleSecondHostSeatPress}
        />
      </View>
    ) : null;

    const throneInlineEl = throneActive ? (
      <View style={{ transform: [{ scale: 0.72 }] }}>
        <RoomThroneSeat
          throne={roomThrone}
          label={t('roomThrone.seatLabel')}
          price={throneConfig.minGiftCoins}
          onPress={() => setShowThroneModal(true)}
        />
      </View>
    ) : null;

    return (
      // مسافة سفلية كبيرة فقط عند وجود العرش (الكرسي ينزل أسفل المضيف)؛ بدونه نرفع المقاعد للأعلى
      <View style={[styles.hostSeatSection, { marginBottom: throneActive ? 34 : 6 }]}>
        {!isAgencyRoom && hostSeatLabel ? (
          <View style={styles.hostSeatBadge}>
            <Crown size={10} color={lu.colors.gold} fill={lu.colors.gold} strokeWidth={0} />
            <Text variant="caption" color={lu.colors.gold} weight="bold" style={{ fontSize: 10 }}>
              {hostSeatLabel}
            </Text>
          </View>
        ) : null}
        <View style={styles.hostSeatRow}>
          {secondHostEnabled ? (
            // مقعدان: المضيف — (العرش في المنتصف عند تفعيله) — المدير الثاني
            <>
              {hostSeatEl}
              {throneInlineEl}
              {secondSeatEl}
            </>
          ) : (
            // مقعد واحد + العرش بجانبه (مطلق) كالسابق
            <>
              {hostSeatEl}
              {throneActive ? (
                <View style={{ position: 'absolute', right: '50%', marginRight: 34, bottom: -34, transform: [{ scale: 0.72 }] }}>
                  <RoomThroneSeat
                    throne={roomThrone}
                    label={t('roomThrone.seatLabel')}
                    price={throneConfig.minGiftCoins}
                    onPress={() => setShowThroneModal(true)}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderSeat = (seatNum: number) => {
    const occupant = seatMap.get(seatNum);
    const isOccupied = !!occupant && !!occupant.uid;
    return (
      <RoomSeat
        key={seatNum}
        seatIndex={seatNum}
        // الاسم/الصورة من البروفايل الحقيقي أولاً — لقطة المقعد قد تكون فارغة/قديمة
        avatar={
          (occupant?.uid
            ? (connectedProfiles[occupant.uid] as any)?.profile?.avatar ||
              connectedProfiles[occupant.uid]?.avatar
            : undefined) || occupant?.avatar
        }
        frameUri={resolveSeatFrameUri(occupant?.uid, occupant)}
        displayName={
          (occupant?.uid
            ? (connectedProfiles[occupant.uid] as any)?.profile?.displayName ||
              connectedProfiles[occupant.uid]?.displayName
            : undefined) || occupant?.displayName
        }
        isMuted={occupant?.isMuted}
        isSpeaking={
          (occupant?.uid ? speakingIdentities.has(occupant.uid) : false) ||
          occupant?.isSpeaking
        }
        audioLevel={occupant?.uid ? audioLevelByUid[occupant.uid] : undefined}
        isPlayingMusic={
          !!occupant?.uid &&
          !!musicBroadcasterUid &&
          musicBroadcasterUid === occupant.uid
        }
        isVIP={hasVipPrivilege(occupant, 'vipBadge', vipSystem?.privileges || [])}
        level={occupant?.level ?? 1}
        coins={seatSupportForUid(occupant?.uid)}
        pkTeam={
          pkLive && roomPk.mode === 'in_room'
            ? getPkTeamForSeat(seatNum) ?? undefined
            : undefined
        }
        size={seatSize}
        // شكل موحّد دائري لكل المقاعد — كان «rounded» فيظهر الفارغ مربعاً
        // والمشغول دائرياً (طلب المالك: الكل مدوّر)
        shape="circle"
        empty={!isOccupied}
        emptySeatLabel={isAgencyRoom ? String(seatNum) : undefined}
        isLocked={!isOccupied && lockedSeatSet.has(seatNum)}
        overlayEmoji={occupant?.uid ? seatEmojiByUid[occupant.uid] : undefined}
        overlayGift={occupant?.uid ? seatGiftByUid[occupant.uid] : undefined}
        onPress={seatPressHandlers[seatNum]}
      />
    );
  };

  if (!gateOpen) {
    return (
      <View style={[styles.flex1, styles.gateBlockingScreen]}>
        {askPassword ? (
          <RoomPasswordGateModal
            embedded
            visible
            isAgencyRoom={isAgencyRoom}
            error={pwError}
            onSubmit={submitPassword}
            onCancel={() => void leaveRoomAndNavigate()}
          />
        ) : null}
      </View>
    );
  }

  return (
    <>
    <View style={styles.flex1}>
    <View
      style={[
        styles.container,
        // نرفع منطقة الشات فوق الكيبورد مباشرةً وبتزامن مع حدثه (لا عبر onLayout المتأخّر):
        // على iOS نضيف keyboardHeight صراحةً، وأندرويد يتكفّل به adjustResize الأصلي.
        { paddingBottom: bottomBarHeight + (Platform.OS === 'ios' ? keyboardHeight : 0) },
      ]}
    >
      <RoomVoiceSessionGuard
        active={gateOpen && !!roomId}
        roomId={roomId}
        roomTitle={room.name ?? t('room.voiceRoom')}
        canSpeak={canSpeak}
      />
      <RoomStageBackground customUri={stageBackgroundUri} />

      <RoomLiveHeader
        topInset={insets.top}
        roomName={room.name ?? t('room.voiceRoom')}
        roomId={roomId ?? ''}
        vanityId={room.vanityId || agencyInviteCode}
        hostName={
          isAgencyRoom
            ? agencyHeaderName
            : hostMicSeat?.displayName ?? hostSeat?.displayName ?? room.hostName
        }
        hostAvatar={
          isAgencyRoom
            ? agencyHeaderAvatar
            : hostMicSeat?.avatar ?? hostSeat?.avatar ?? room.hostAvatar
        }
        hostFrameUri={
          isAgencyRoom
            ? agencyCardFrameUrl
            : (hostMicSeat?.uid ?? hostSeat?.uid)
              ? userFrameByUid[hostMicSeat?.uid ?? hostSeat?.uid ?? '']
              : undefined
        }
        headerFrameStyle={(isAgencyRoom ? 'agencyCard' : 'avatar') as 'avatar' | 'agencyCard'}
        hostLevel={hostMicSeat?.level ?? hostSeat?.level ?? 1}
        presenceCount={presenceCount}
        audience={audienceMembers}
        contributionLabel={t('room.contributionList')}
        onExit={handleExit}
        onAudience={() => setShowAudienceModal(true)}
        showRoomIdOnCard={!isAgencyRoom}
        onContribution={() => setShowContribution(true)}
        onRoomPress={() => {
          if (isAgencyRoom) {
            setShowRoomInfo(true);
            return;
          }
          if (hostSeat?.uid) {
            openRoomUserSheet({
              uid: hostSeat.uid,
              displayName: hostSeat.displayName,
              avatar: hostSeat.avatar,
              level: hostSeat.level,
              isVIP: hostSeat.isVIP,
              vipLevel: hostSeat.vipLevel,
              onSeat: true,
              seatIndex: 0,
            });
          }
        }}
        showFavorite={!!user?.uid}
        isFavorited={isFavorited}
        onFavorite={() => void handleToggleFavorite()}
        showEdit={canUseHostSeat}
        onEdit={() => {
          if (isAgencyRoom) setShowRoomSettings(true);
          else router.push(`/room/edit?id=${roomId}` as any);
        }}
        showPartyBadge={canManageAgencyParty}
        partyBadgeLabel={t('room.partyBadge')}
        onPartyBadge={() => {
          if (!room?.agencyId || !roomId) return;
          router.push({
            pathname: '/agency/party',
            params: {
              roomId,
              agencyId: room.agencyId,
              agencyName: room.name ?? '',
            },
          } as any);
        }}
        showRoomEventBadges={!simpleScreen}
        rocketLaunch={latestRocketLaunch}
        onRocketPress={() => openRocketLaunchView(latestRocketLaunch)}
        luckyBags={luckyBags}
        onLuckyBagPress={(bagId) => setLuckyBagPromptId(bagId)}
        mediaPlayingKind={headerMediaStatus?.kind}
        mediaPlayingLabel={headerMediaStatus?.label}
        mediaPlayingTitle={headerMediaStatus?.title}
        showMusicPulse={!!roomMusic && !musicUiDismissed}
        musicPlaying={roomMusic?.isPlaying === true}
        onMusicPress={handleOpenMusicSheet}
        musicA11yLabel={t('room.musicLibTitle')}
      />

      {rocketLaunchAnim ? (
        <RoomRocketLaunchAnimation
          key={rocketLaunchAnim.id}
          launch={rocketLaunchAnim}
          onComplete={handleRocketLaunchAnimComplete}
        />
      ) : null}

      {isAgencyRoom && welcomeEntry ? (
        <RoomEntryWelcomeBanner
          key={welcomeEntry.key}
          name={welcomeEntry.name}
          visible
          isPrince={welcomeEntry.isPrince}
          isStaff={welcomeEntry.isStaff}
          entryImageUrl={welcomeEntry.entryImageUrl}
          onDone={() => setWelcomeEntry(null)}
        />
      ) : null}

      <RoomFlyingMessages roomId={roomId!} />

      {entryVideo && entryAnimationsEnabled ? (
        <RoomEntryVideoOverlay
          key={entryVideo.key}
          userName={entryVideo.name}
          videoUrl={entryVideo.videoUrl}
          videoUrlMp4={entryVideo.videoUrlMp4}
          onComplete={completeEntryVideo}
        />
      ) : null}


      {/* Stage Area — ثابتة (غير قابلة للسكرول)، بحجم محتواها الطبيعي حسب عدد المقاعد */}
      <View
        style={{ flexShrink: 0, flexGrow: 0, marginTop: stageMarginTop, zIndex: 1, paddingBottom: stagePaddingBottom }}
      >
        {renderHostSeat()}

        {pkLive ? (
          <RoomPkBattleOverlay
            pk={roomPk}
            onTimerEnd={() => {
              // المضيف فقط يُنهي ويسجّل الفائز عند انتهاء الوقت — يمنع تكرار الإنهاء وسبام الشات
              if (isHost) handlePkEnded(false);
            }}
          />
        ) : null}

      {pkLive && roomPk.mode === 'in_room' ? (
        <View style={styles.pkTeamsRow}>
          <View style={[styles.pkTeamPanel, styles.pkTeamPanelBlue]}>
            {seatNumbers
              .filter((n) => getPkTeamForSeat(n) === 'blue')
              .map(renderSeat)}
          </View>
          <View style={[styles.pkTeamPanel, styles.pkTeamPanelRed]}>
            {seatNumbers
              .filter((n) => getPkTeamForSeat(n) === 'red')
              .map(renderSeat)}
          </View>
        </View>
      ) : (
        <View style={[styles.seatsGrid, { flexDirection: rowDir, rowGap: stageRowGap }]}>
          {seatNumbers.map((seatNum) => (
            <View
              key={seatNum}
              style={[styles.seatGridItem, { width: `${100 / seatColumns}%` as any }]}
            >
              {renderSeat(seatNum)}
            </View>
          ))}
        </View>
      )}
      </View>

      {simpleScreen ? (
        <View style={styles.simpleScreenHint}>
          <Text variant="caption" color="rgba(255,255,255,0.65)" style={{ textAlign: 'center' }}>
            {t('roomEffects.simpleScreenActive')}
          </Text>
          <Pressable onPress={() => setSimpleScreen(false)} style={styles.simpleScreenExit}>
            <Text variant="caption" color={lu.colors.gold} weight="bold">
              {t('roomEffects.exitSimpleScreen')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
      {/* ===== فيديو الروم (مشترك للجميع) — عائم وقابل للسحب ===== */}
      {roomVideo && (
        <RoomVideoPlayer
          roomId={roomId!}
          video={roomVideo}
          userUid={user?.uid}
          canControl={canControlRoomVideo}
          roomHostUid={room.hostUid}
          coHosts={(room as any).coHosts ?? []}
        />
      )}

      {/* ===== بوب أب حقيبة الحظ (يُفتح عند الضغط على الأيقونة العائمة) ===== */}
      <LuckyBagPopup
        roomId={roomId!}
        bags={luckyBags}
        myUid={user?.uid ?? ''}
        canManageRoom={supervisorPerms.manageLuckyBags}
        promptBagId={luckyBagPromptId}
        onPromptHandled={() => setLuckyBagPromptId(null)}
      />

      {/* البانرات الكاملة أُلغيت — التفاصيل تظهر عند الضغط على الأيقونة العائمة
          (حقيبة الحظ → LuckyBagPopup، الصاروخ → RoomRocketModal). */}

{/* شريط الحاضرين — أُزيل */}

      {/* Chat area */}
      <View style={styles.chatArea}>
        {/* ===== الرسائل المثبتة — تطفو فوق الشات بدون تأثير على المايكات ===== */}
        {!isAgencyRoom ? (
          <PinnedMessagesBanner
            roomId={roomId!}
            pins={pinnedMessages}
            canManage={supervisorPerms.pinMessages}
            onAddPress={() => setShowPinModal(true)}
          />
        ) : null}
        <FlatList
          ref={chatScrollRef as any}
          // قائمة مقلوبة: الأحدث في الأسفل دائماً بلا scrollToEnd → لا قفز، وثبات على آخر رسالة،
          // وظهور كل جديد فوراً (ريل-تايم). عند الدخول يعرض الأحدث مباشرة.
          inverted
          data={invertedMessages}
          keyExtractor={keyExtractor}
          extraData={chatExtraData}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatContent}
          // ⚡ إعدادات الأداء — تقليل العمل أثناء التمرير والرسائل السريعة
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={60}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          // في القائمة المقلوبة يصبح الهيدر (رسالة الترحيب) في الأعلى البصري عبر Footer.
          ListFooterComponent={chatHeaderEl}
          renderItem={renderChatItem}
        />
      </View>

      <View
        pointerEvents="none"
        style={[styles.chatBottomFade, { height: bottomBarHeight + 20 }]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(8, 4, 4, 0.55)', 'rgba(8, 4, 4, 0.92)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
        </>
      )}

      {chatInputFocused && !simpleScreen ? (
        <Pressable
          style={[styles.chatInputDismissOverlay, { bottom: bottomBarHeight }]}
          onPress={dismissChatInput}
          accessibilityRole="button"
        />
      ) : null}

      <RoomBottomToolbar
        dockCollapsed={dockCollapsed}
        onToggleDock={toggleDockCollapsed}
        onLayoutHeight={setToolbarHeight}
        keyboardHeight={keyboardHeight}
        chatText={chatText}
        onChangeChat={handleChangeChat}
        onSend={handleSendMessage}
        inputResetKey={chatInputResetKey}
        chatPlaceholder={myChatMuted ? t('room.chatMutedPlaceholder') : t('room.chatPlaceholder')}
        showEmoji={showEmoji}
        onToggleEmoji={() => {
          setShowTools(false);
          setShowVoiceModal(false);
          setShowEmoji((v) => !v);
        }}
        volumeMuted={volumeMuted}
        micMuted={!!mySeat?.isMuted}
        onSeat={!!mySeat}
        onToggleMic={
          mySeat
            ? () => {
                setShowEmoji(false);
                setShowVoiceModal(false);
                setShowTools(false);
                void handleToggleMute();
              }
            : undefined
        }
        onToggleRoomVolume={() => {
          setShowEmoji(false);
          setShowVoiceModal(false);
          setShowTools(false);
          toggleRoomVolume();
        }}
        messageCount={privateUnreadCount}
        onMessages={handleOpenPrivateChats}
        onGift={() => {
          const target = regularSeats.find((s) => s.uid && s.uid !== myUid) ?? hostSeat;
          setGiftInitialRecipientUid(target?.uid ?? null);
          setShowGifts(true);
        }}
        onMore={() => {
          closeBottomPanels();
          setShowTools(true);
        }}
        inputRef={chatInputRef}
        onInputFocusChange={setChatInputFocused}
      />

      <RoomResetMicSupportModal
        visible={showResetMicSupportModal}
        roomId={roomId!}
        members={micSupportResetCandidates}
        onClose={() => setShowResetMicSupportModal(false)}
        onSuccess={() => {
          showAlert({
            type: 'success',
            title: t('roomEffects.resetMicSupportDone'),
            message: t('roomEffects.resetMicSupportDoneMsg'),
          });
        }}
        onError={(msg) => {
          showAlert({
            type: 'error',
            title: t('common.error'),
            message: msg || t('room.actionFailed'),
          });
        }}
      />

      <RoomToolsSheet
        visible={showTools}
        onClose={() => setShowTools(false)}
        onAction={handleRoomToolAction}
        musicBusy={musicBusy}
        showSettings={canOpenRoomSettings}
        showThrone={showThroneTool}
        showVideo={showVideoShareTool}
        showMusic
        showShare={canSendRoomInviteTool}
        showResetMicSupport={supervisorPerms.resetMicSupport}
        showPinNotice={!isAgencyRoom}
        simpleScreenActive={simpleScreen}
        effectsActive={roomEffectsSettings.animations || roomEffectsSettings.soundEffects}
      />

      {roomId && roomMusic && !musicUiDismissed ? (
        <RoomMusicPlaybackHost
          roomId={roomId}
          music={roomMusic}
          userUid={user?.uid}
          canManageMusic={canManageRoomMusic}
        >
          <RoomMusicSheet
            visible={showMusicSheet}
            onClose={() => setShowMusicSheet(false)}
            onReopen={() => setShowMusicSheet(true)}
            roomId={roomId}
            roomMusic={roomMusic}
            canControl={canDjRoomMusic}
            canManageMusic={canManageRoomMusic}
          />
        </RoomMusicPlaybackHost>
      ) : roomId ? (
        <RoomMusicSheet
          visible={showMusicSheet}
          onClose={() => setShowMusicSheet(false)}
          onReopen={() => setShowMusicSheet(true)}
          roomId={roomId}
          roomMusic={roomMusic}
          canControl={canDjRoomMusic}
          canManageMusic={canManageRoomMusic}
        />
      ) : null}

      <RoomFreeGameStartSheet
        visible={!!pendingFreeGameId}
        gameId={pendingFreeGameId}
        loading={startingFreeGame}
        onClose={() => setPendingFreeGameId(null)}
        onStart={confirmPendingFreeGame}
      />

      <RoomFreeGameWebView
        visible={!!freeGame}
        gameId={freeGame?.gameId ?? 'ludo'}
        sessionId={freeGame?.sessionId ?? ''}
        roomId={activeRoomId ?? ''}
        uid={user?.uid ?? ''}
        playerName={roomGamePlayerName}
        joinCode={freeGame?.joinCode}
        autoCreate={freeGame?.autoCreate}
        canMic={!!mySeat}
        volumeMuted={volumeMuted}
        onToggleVolume={toggleRoomVolume}
        micMuted={!!mySeat?.isMuted}
        onToggleMic={() => void handleToggleMute()}
        roomMembers={roomGamePickerMembers}
        onClose={() => setFreeGame(null)}
      />

      <RoomGameInvitePopup
        invite={roomGameInvitePopup}
        loading={joiningRoomGame}
        onAccept={acceptRoomGameInvitePopup}
        onDecline={declineRoomGameInvitePopup}
      />

      <RoomMicInvitePopup
        invite={micInvitePopup}
        loading={micInviteLoading}
        onAccept={() => void acceptMicInvitePopup()}
        onDecline={declineMicInvitePopup}
      />

      <RoomAgencyInvitePopup
        invite={!micInvitePopup ? agencyInvitePopup : null}
        loading={agencyInviteLoading}
        onAccept={() => void acceptAgencyInvitePopup()}
        onDecline={declineAgencyInvitePopup}
      />

      <RoomGiftPickerModal
        visible={showGifts}
        gifts={GIFTS_CATALOG}
        categories={giftCategories}
        balance={user?.stats?.coins ?? 0}
        sending={sendingGift}
        recipients={giftRecipients}
        initialRecipientUid={giftInitialRecipientUid}
        onClose={() => {
          if (sendingGift) return;
          setShowGifts(false);
          setGiftInitialRecipientUid(null);
        }}
        onSend={handleSendGift}
        onComboEnd={clearComboChatBucket}
        onRecharge={() => {
          setShowGifts(false);
          router.push('/wallet/recharge' as any);
        }}
      />

      {/* معلومات الغرفة / الوكالة */}
      {isAgencyRoom && roomId ? (
        <>
          <RoomInformationModal
            visible={showRoomInfo}
            onClose={() => setShowRoomInfo(false)}
            room={room}
            roomId={roomId}
            agencyId={room.agencyId}
            presenceCount={presenceCount}
            canManage={isHost || supervisorPerms.manageRoles}
            canManageBlocks={canManageRoomBlocks}
            myUid={myUid}
            frameByUid={userFrameByUid}
            onOpenSettings={() => {
              setShowRoomInfo(false);
              setShowRoomSettings(true);
            }}
            onPressMember={handleInfoMemberPress}
          />
          <RoomSettingsSheet
            visible={showRoomSettings}
            onClose={() => setShowRoomSettings(false)}
            roomId={roomId}
            canManage={canOpenRoomSettings}
            canManageBlocks={canManageRoomBlocks}
          />
        </>
      ) : null}

      {/* المستخدمين المتصلين */}
      <ConnectedUsersSheet
        visible={showAudienceModal}
        onClose={() => {
          setShowAudienceModal(false);
          setInviteSeatIdx(null);
        }}
        members={enrichedAudienceMembers}
        vipMembers={vipAudienceMembers}
        onlineCount={presenceCount}
        canManageMic={supervisorPerms.manageMic || supervisorPerms.inviteMic || canInviteToMicTool}
        frameByUid={userFrameByUid}
        micBusyUid={micBusyUid}
        profilesLoading={profilesLoading}
        onPressUser={handleConnectedUserPress}
        onAddToMic={handleConnectedAddToMic}
        onRemoveFromMic={handleConnectedRemoveFromMic}
        myUid={myUid}
      />

      {isAgencyRoom && emptySeatSheet ? (
        <AgencyEmptySeatSheet
          visible
          seatIdx={emptySeatSheet.seatIdx}
          locked={emptySeatSheet.locked}
          hideTakeMic={
            emptySeatSheet.seatIdx === SECOND_HOST_SEAT_INDEX && !canTakeSecondHostSeat
          }
          onClose={() => setEmptySeatSheet(null)}
          onTakeMic={() => {
            const seatIdx = emptySeatSheet.seatIdx;
            setEmptySeatSheet(null);
            if (seatIdx === SECOND_HOST_SEAT_INDEX) {
              void (async () => {
                beginOptimisticSeat(SECOND_HOST_SEAT_INDEX);
                try {
                  if (mySeat && mySeat.seatIndex !== SECOND_HOST_SEAT_INDEX) {
                    await changeSeat(roomId!, SECOND_HOST_SEAT_INDEX);
                  } else {
                    await joinSeat(roomId!, SECOND_HOST_SEAT_INDEX);
                  }
                } catch (e: any) {
                  clearOptimisticSeat();
                  showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('room.actionFailed') });
                }
              })();
              return;
            }
            void handleJoinSeat(seatIdx);
          }}
          onToggleLock={
            supervisorPerms.lockSeats
              ? () => {
                  if (!roomId) return;
                  const seatIdx = emptySeatSheet.seatIdx;
                  const nextLocked = !emptySeatSheet.locked;
                  const seatKey = `seat_${seatIdx}`;
                  setEmptySeatSheet(null);
                  setRoom((prev) => {
                    if (!prev) return prev;
                    const lockedSeats = { ...(prev.lockedSeats ?? {}) };
                    if (nextLocked) lockedSeats[seatKey] = true;
                    else delete lockedSeats[seatKey];
                    return { ...prev, lockedSeats };
                  });
                  void setSeatLocked(roomId, seatIdx, nextLocked).catch((e: any) => {
                    setRoom((prev) => {
                      if (!prev) return prev;
                      const lockedSeats = { ...(prev.lockedSeats ?? {}) };
                      if (nextLocked) delete lockedSeats[seatKey];
                      else lockedSeats[seatKey] = true;
                      return { ...prev, lockedSeats };
                    });
                    showAlert({ type: 'error', title: t('common.error'), message: e?.message });
                  });
                }
              : undefined
          }
          onInvite={
            (emptySeatSheet.seatIdx === SECOND_HOST_SEAT_INDEX
              ? canUseHostSeat || supervisorPerms.manageMic
              : supervisorPerms.inviteMic || supervisorPerms.manageMic || canInviteToMicTool)
              ? () => {
                  const seatIdx = emptySeatSheet.seatIdx;
                  if (emptySeatSheet.locked) {
                    setEmptySeatSheet(null);
                    showAlert({
                      type: 'warning',
                      title: t('room.seatLockedTitle'),
                      message: t('room.seatUnlockBeforeInvite'),
                    });
                    return;
                  }
                  setInviteSeatIdx(seatIdx);
                  setEmptySeatSheet(null);
                  setShowSeatInviteModal(true);
                }
              : undefined
          }
        />
      ) : null}

      {/* دعوة شخص للمقعد: بحث بـ ID + متابَعين + متصلين */}
      <SeatInviteModal
        visible={showSeatInviteModal}
        onClose={() => {
          setShowSeatInviteModal(false);
          setInviteSeatIdx(null);
        }}
        seatIdx={inviteSeatIdx ?? 0}
        roomId={roomId ?? ''}
        roomName={room?.name ?? ''}
        connectedUsers={enrichedAudienceMembers}
        frameByUid={userFrameByUid}
        includeMembership={false}
      />

      {/* Contribution List Modal */}
      <RoomContributionsModal
        visible={showContribution}
        roomId={roomId ?? ''}
        onClose={() => setShowContribution(false)}
      />

      {/* More Rooms Drawer - Luxurious Bottom Sheet Redesign */}
      <Modal
        visible={showMoreRooms}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowMoreRooms(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setShowMoreRooms(false)} />
          <View
            style={[
              styles.moreRoomsDrawer,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            {/* الخلفية الفخمة */}
            <LinearGradient colors={['rgba(26, 10, 12, 0.98)', 'rgba(10, 4, 5, 1)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassTopBorder} />
            <View style={styles.drawerHandle} />

            <View style={styles.drawerHeader}>
              <Text variant="h2" weight="bold" color={colors.white} style={styles.moreRoomsTitle}>
                {t('room.moreRoomsTitle')}
              </Text>
            </View>

            <FlatList
              data={otherAgencies}
              keyExtractor={(a) => a.id}
              renderItem={renderOtherAgencyItem}
              style={styles.moreRoomsList}
              contentContainerStyle={
                otherAgencies.length === 0
                  ? styles.moreRoomsListEmpty
                  : styles.moreRoomsListContent
              }
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              ListEmptyComponent={
                <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                  <Text variant="body" color="rgba(255,255,255,0.5)" weight="bold">
                    {t('room.noOtherRooms')}
                  </Text>
                </View>
              }
            />

            <View style={styles.drawerFooter}>
              {isHost ? (
                <Pressable
                  onPress={() => {
                    setShowMoreRooms(false);
                    setShowEndRoomConfirm(true);
                  }}
                  style={styles.hostCloseLink}
                >
                  <Text variant="body" color="#FCA5A5" weight="bold">
                    {t('room.closeRoomTitle')}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.drawerActions}>
                <Pressable
                  onPress={() => void handleFullExitRoom()}
                  style={styles.exitBigBtn}
                >
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.2)', 'rgba(185, 28, 28, 0.4)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.exitBtnBorder} />
                  <Power size={20} color="#FCA5A5" strokeWidth={2.5} />
                  <Text variant="button" color="#FCA5A5" weight="bold">
                    {t('room.exitRoom')}
                  </Text>
                </Pressable>
                
                <Pressable onPress={handleKeepRoomInBackground} style={styles.keepBtn}>
                  <LinearGradient
                    colors={['rgba(225, 20, 20, 0.2)', 'rgba(176, 14, 14, 0.4)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.keepBtnBorder} />
                  <Text variant="button" color="#FECACA" weight="bold">
                    {t('room.keepInRoom')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gift Animation Overlay - يظهر فوق كل شيء */}
      {giftAnimation && giftAnimationsEnabled ? (
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
          recipientUid={giftAnimation.recipientUid}
          recipientAvatar={giftAnimation.recipientAvatar}
          isGroupGift={giftAnimation.isGroupGift}
          recipientCount={giftAnimation.recipientCount}
          quantity={giftAnimation.quantity}
          price={giftAnimation.price}
          showGiftName={false}
          giftOnly
          onComplete={completeGiftAnimation}
        />
      ) : null}

      {/* ===== لوحة الصوت (فوق الشريط السفلي) ===== */}
      {showVoiceModal && !dockCollapsed && (
        <>
          <Pressable
            style={[styles.roomBottomBackdrop, { bottom: bottomBarHeight }]}
            onPress={() => setShowVoiceModal(false)}
          />
          <View style={[styles.roomBottomPanel, { bottom: bottomBarHeight }]}>
            <VoiceMicPanel
              onClose={() => setShowVoiceModal(false)}
              roomId={roomId!}
              canMic={onMic}
              micMuted={!!mySeat?.isMuted}
              onToggleMic={() => void handleToggleMute()}
              volumeMuted={volumeMuted}
              onToggleVolume={toggleRoomVolume}
            />
          </View>
        </>
      )}

      {/* ===== لوحة الإيموجي (للروم) — شيت ينزلق من الأسفل، طبقة عائمة لا تُزحزح المقاعد ===== */}
      <RoomBottomSheet
        visible={showEmoji && !dockCollapsed}
        onClose={() => setShowEmoji(false)}
        bottom={bottomBarHeight}
        height={EMOJI_SHEET_HEIGHT}
      >
        <EmojiPicker
          mode="reactions"
          height={EMOJI_SHEET_HEIGHT}
          reactionPacks={roomReactions.packs}
          selectDisabled={false}
          onSelect={(emoji) => void handleSendAnimatedEmoji(emoji)}
          onClose={() => setShowEmoji(false)}
          // تبويب الطبلة 🥁: تشغيل محلي فوري + بث للجميع عبر RTDB
          onPlaySoundEffect={(effectId: SoundEffectId) => {
            void playSoundEffectLocal(effectId, 0.92).catch(() => {});
            void triggerSoundEffect(roomId!, effectId).catch(() => {});
          }}
        />
      </RoomBottomSheet>

      <ShareToChatModal
        visible={showShareToChat}
        onClose={() => setShowShareToChat(false)}
        title="إرسال دعوة عبر المحادثات"
        invites={shareInviteItems}
      />

      {/* بطاقة تفاصيل الشخص الجالس على المقعد / من الشات */}
      <RoomUserSheet
        visible={!!seatUser}
        user={seatUser}
        vipSystem={vipSystem}
        isSelf={seatUser?.uid === myUid}
        canAdmin={supervisorPerms.kickBan || supervisorPerms.manageMic}
        onSeat={seatUser?.onSeat}
        onClose={() => setSeatUser(null)}
        onMention={(token) => {
          setSeatUser(null);
          setChatText((prev) => buildRoomMentionInsert(token, prev));
          setTimeout(() => chatInputRef.current?.focus(), 150);
        }}
        onPrivateChat={handleOpenPrivateChatWith}
        onGift={(uid) => {
          setSeatUser(null);
          setGiftInitialRecipientUid(uid);
          setShowGifts(true);
        }}
        onViewProfile={(uid) => {
          setSeatUser(null);
          router.push(`/profile/${uid}` as any);
        }}
        onLeaveMic={
          seatUser?.uid === myUid && roomId
          && (mySeat != null || typeof seatUser?.seatIndex === 'number')
            ? () => promptLeaveMicSeat(mySeat?.seatIndex ?? seatUser!.seatIndex!)
            : undefined
        }
        onKick={
          supervisorPerms.kickBan && roomId && canManageAgencyTarget(seatUser?.uid, 'kick')
            ? (uid) => {
                const name = seatUser?.displayName ?? t('room.defaultRoomName');
                openKickBanFlow(uid, name);
              }
            : undefined
        }
        onReport={
          (uid) => {
            setSeatUser(null);
            router.push(getUserReportPath(uid, 'app') as any);
          }
        }
        onAddToMic={
          supervisorPerms.manageMic && roomId && !seatUser?.onSeat
            ? (uid) => {
                const name = resolveDisplayName({ displayName: seatUser?.displayName });
                void sendMicInviteToUser(uid, name, seatUser?.seatIndex);
              }
            : undefined
        }
        onRemoveFromMic={
          supervisorPerms.manageMic && roomId && seatUser?.onSeat
          && canManageAgencyTarget(seatUser?.uid, 'removeMic')
            ? async (uid) => {
                try {
                  await hostRemoveUserFromMic(roomId, uid);
                  setSeatUser(null);
                  showAlert({
                    type: 'success',
                    title: t('common.done'),
                    message: t('room.removeFromMic'),
                  });
                } catch (e: any) {
                  showAlert({ type: 'error', title: t('common.error'), message: e?.message });
                }
              }
            : undefined
        }
        onInviteAgency={
          canShowAgencyInviteForUser(seatUser?.uid)
            ? handleInviteToAgencyFromRoom
            : undefined
        }
        showAgencyInvite={canShowAgencyInviteForUser(seatUser?.uid)}
        onCancelMembership={
          isAgencyRoom
          && supervisorPerms.cancelMembership
          && canManageAgencyTarget(seatUser?.uid, 'cancelMembership')
            ? handleCancelMembership
            : undefined
        }
        onManageRole={
          roomId &&
          seatUser?.uid &&
          seatUser.uid !== myUid &&
          (isHost || supervisorPerms.kickBan || supervisorPerms.manageMic) &&
          canManageAgencyTarget(seatUser.uid, 'assignRole')
            ? (uid, name) => {
                const currentRole = roomMemberRoles[uid];
                const options: { text: string; role: RoomAgencyMemberRole }[] = [];
                if (currentRole !== 'red_member' && currentRole !== 'blue_supervisor' && currentRole !== 'yellow_supervisor') {
                  options.push({ text: t('room.grantMembership', 'منح عضوية'), role: 'red_member' });
                }
                options.push({ text: t('room.grantBlueSupervisor', 'تعيين مشرف أزرق'), role: 'blue_supervisor' });
                if (isHost) {
                  options.push({ text: t('room.grantYellowSupervisor', 'تعيين إشراف (أصفر)'), role: 'yellow_supervisor' });
                }
                if (currentRole && currentRole !== 'cancelled') {
                  options.push({ text: t('roomInfo.cancelMembership'), role: 'cancelled' });
                }
                showAlert({
                  type: 'info',
                  title: name || t('room.memberRole', 'عضوية / إشراف'),
                  message: t('room.memberRoleHint', 'اختر الدور الذي تريد منحه لهذا العضو'),
                  buttons: [
                    ...options.map((o) => ({
                      text: o.text,
                      onPress: () => {
                        void setRoomAgencyMemberRole(roomId, uid, o.role)
                          .then(() => {
                            setSeatUser(null);
                            showAlert({ type: 'success', title: t('common.done'), message: o.text });
                          })
                          .catch((e: any) => {
                            showAlert({ type: 'error', title: t('common.error'), message: e?.message });
                          });
                      },
                    })),
                    { text: t('common.cancel'), style: 'cancel' as const },
                  ],
                });
              }
            : undefined
        }
        seatIsMuted={seatUserMicMuted}
        isChatMuted={seatUserChatMuted}
        onToggleMicMute={
          supervisorPerms.manageMic && roomId && seatUser?.onSeat
          && canManageAgencyTarget(seatUser?.uid, 'mute')
            ? handleToggleUserMicMute
            : undefined
        }
        onToggleChatMute={
          (supervisorPerms.manageMic || supervisorPerms.kickBan) && roomId && seatUser?.uid !== myUid
          && canManageAgencyTarget(seatUser?.uid, 'mute')
            ? handleToggleUserChatMute
            : undefined
        }
      />

      {/* ===== Follow Success Modal (custom brand look) ===== */}
      <Modal
        visible={showFollowSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFollowSuccessModal(false)}
      >
        <Pressable style={styles.followModalBackdrop} onPress={() => setShowFollowSuccessModal(false)}>
          <Pressable style={styles.followModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.followModalIconWrap}>
              <LinearGradient
                colors={[lu.colors.mint, '#10B981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.followModalIcon}
              >
                <Check size={28} color={colors.white} strokeWidth={3} />
              </LinearGradient>
            </View>

            <Text variant="h3" weight="bold" color={lu.colors.ink} align="center">
              {t('room.followedRoom')}
            </Text>
            <Text
              variant="bodySmall"
              color={lu.colors.ink2}
              align="center"
              style={{ marginTop: 6, lineHeight: 20 }}
            >
              {t('room.followNotice')}
            </Text>

            <Pressable
              onPress={() => setShowFollowSuccessModal(false)}
              style={styles.followModalBtn}
            >
              <LinearGradient
                colors={[lu.colors.mint, '#10B981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text variant="button" weight="bold" color={colors.white}>
                {t('common.ok')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <RoomKickBanModal
        visible={!!kickTarget}
        userName={kickTarget?.name}
        loading={kickLoading}
        onClose={() => !kickLoading && setKickTarget(null)}
        onConfirm={async (choice: KickBanChoice) => {
          if (!roomId || !kickTarget) return;
          setKickLoading(true);
          try {
            const options = choice.permanent
              ? { permanent: true as const }
              : { duration: choice.duration };
            await kickUserFromRoom(roomId, kickTarget.uid, options);
            setSeatUser(null);
            setKickTarget(null);
            showAlert({
              type: 'success',
              title: t('common.done'),
              message: t('room.kickSuccess', 'تم طرد المستخدم'),
            });
          } catch (e: any) {
            showAlert({ type: 'error', title: t('common.error'), message: e?.message });
          } finally {
            setKickLoading(false);
          }
        }}
      />


      <RoomJoinMicModal
        visible={showJoinMicModal}
        fee={joinMicFee}
        loading={joinMicLoading}
        onClose={() => {
          if (joinMicLoading) return;
          setShowJoinMicModal(false);
          setPendingJoinSeatIdx(null);
        }}
        onJoin={() => void handleJoinMicConfirm()}
      />

      <RoomEffectsModal
        visible={showEffectsModal}
        onClose={() => setShowEffectsModal(false)}
        roomId={roomId!}
        roomEffects={roomEffectsSettings}
        canManageRoom={supervisorPerms.manageEffects}
        myUid={user?.uid ?? ''}
        onPersonalChange={setPersonalEffects}
        onRoomChange={setRoomEffectsSettings}
      />

      {/* ===== مشغّل المؤثرات (خفي - يستمع دائماً) ===== */}
      <SoundEffectsPlayer roomId={roomId!} myUid={user?.uid} muted={!roomSoundEffectsEnabled} />

      {/* ===== مودال إغلاق الغرفة ===== */}
      <EndRoomModal
        visible={showEndRoomConfirm}
        loading={confirmLoading ? (endRoomMode ?? null) : null}
        onArchive={async () => {
          setEndRoomMode('archive');
          setConfirmLoading(true);
          try {
            await performCompleteLeave();
            await archiveRoom(roomId!);
            navigateAfterLeaveRoom();
          } catch (e: any) {
            showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('room.archiveFailed') });
            setConfirmLoading(false);
            setEndRoomMode(null);
          }
        }}
        onEnd={async () => {
          setEndRoomMode('end');
          setConfirmLoading(true);
          try {
            await performCompleteLeave();
            await endRoom(roomId!);
            navigateAfterLeaveRoom();
          } catch (e: any) {
            showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('room.endFailed') });
            setConfirmLoading(false);
            setEndRoomMode(null);
          }
        }}
        onCancel={() => setShowEndRoomConfirm(false)}
      />

      {/* ===== Video Add Modal ===== */}
      <VideoAddModal
        visible={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        roomId={roomId!}
        canPublishDirectly={canReviewVideoRequests}
      />

      {/* ===== Video Approval (supervisors / agency) ===== */}
      <RoomVideoApprovalModal
        visible={showVideoApprovalModal && !!pendingVideoRequests[0]}
        request={pendingVideoRequests[0] ?? null}
        roomId={roomId!}
        onClose={() => setShowVideoApprovalModal(false)}
      />

      {/* ===== Lucky Bag Modal ===== */}
      <ThrowLuckyBagModal
        visible={showLuckyBagModal}
        onClose={() => setShowLuckyBagModal(false)}
        roomId={roomId!}
        onSent={(bagId) => setLuckyBagPromptId(bagId)}
      />

      <RoomRocketModal
        visible={showRocketModal}
        onClose={() => {
          setShowRocketModal(false);
          setRocketViewLaunch(null);
        }}
        onOpenGifts={() => {
          setShowRocketModal(false);
          setRocketViewLaunch(null);
          setShowGifts(true);
        }}
        roomId={roomId!}
        progress={rocketProgress}
        launch={rocketViewLaunch}
        myCoins={user?.stats?.coins ?? 0}
        onLaunched={() => refreshUser?.()}
      />

      {throneActive ? (
        <RoomThroneModal
          visible={showThroneModal}
          onClose={() => setShowThroneModal(false)}
          roomId={roomId!}
          throne={roomThrone}
          config={throneConfig}
          myUid={user?.uid ?? ''}
          myContribution={myThroneContribution}
          canManageRoom={isHost || supervisorPerms.manageMic}
          onSendGift={() => setShowGifts(true)}
        />
      ) : null}

      {/* ===== Pin Custom Message Modal (غير الوكالات) ===== */}
      {!isAgencyRoom ? (
        <PinCustomMessageModal
          visible={showPinModal}
          onClose={() => setShowPinModal(false)}
          roomId={roomId!}
          canManage={supervisorPerms.pinMessages}
        />
      ) : null}

      <RoomPkTypeSheet
        visible={showPkType}
        onClose={() => setShowPkType(false)}
        onSelectInRoom={() => {
          setShowPkType(false);
          pkFlowRef.current = 'in_room';
          setPkFlow('in_room');
          setShowPkSetup(true);
        }}
        onSelectCrossRoom={() => {
          if (!isAgencyRoom) {
            showAlert({
              type: 'warning',
              title: t('roomPk.title'),
              message: t('roomPk.agencyOnly'),
            });
            return;
          }
          setShowPkType(false);
          pkFlowRef.current = 'cross_room';
          setPkFlow('cross_room');
          setShowPkSetup(true);
        }}
      />

      <RoomPkMatchingSheet
        visible={showPkMatching}
        matchRequest={pkMatchRequest}
        sentInvites={pkSentInvites}
        loading={pkStarting}
        onClose={() => setShowPkMatching(false)}
        onCancel={() => void handleCancelPkMatch()}
      />

      <RoomPkChallengePopup
        visible={showPkChallengePopup && !!pkPendingInvite}
        invite={pkPendingInvite}
        roomId={roomId!}
        onClose={() => setShowPkChallengePopup(false)}
        onAccepted={() => {
          void sendMessage(roomId!, `⚔️ ${t('roomPk.started')}`).catch(() => {});
        }}
      />

      <RoomPkSetupSheet
        visible={showPkSetup}
        mode={pkFlowRef.current ?? pkFlow ?? 'in_room'}
        modeLabel={
          (pkFlowRef.current ?? pkFlow) === 'cross_room'
            ? t('roomPk.crossRoomTitle')
            : t('roomPk.inRoomTitle')
        }
        startLabel={
          (pkFlowRef.current ?? pkFlow) === 'cross_room'
            ? t('roomPk.startMatch')
            : undefined
        }
        loading={pkStarting}
        onClose={() => {
          setShowPkSetup(false);
          setPkFlow(null);
          pkFlowRef.current = null;
        }}
        onStart={handleStartPk}
      />

      {isHost && pkLive ? (
        <Pressable
          style={[styles.pkEndFab, { top: insets.top + 120 }]}
          onPress={() => {
            // تسمية أمرية + تأكيد — «انتهى التحدي» كانت تُقرأ كحالة
            // فيظن الجميع أن التحدي انتهى وهو جارٍ
            showAlert({
              type: 'warning',
              title: t('roomPk.endAction', 'إنهاء التحدي'),
              message: t('roomPk.endConfirm', 'هل تريد إنهاء التحدي الآن واحتساب النتيجة؟'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('roomPk.endAction', 'إنهاء التحدي'), onPress: () => void handlePkEnded(false) },
              ],
            });
          }}
        >
          <Text variant="caption" weight="bold" color="#fff">
            {t('roomPk.endAction', 'إنهاء التحدي')}
          </Text>
        </Pressable>
      ) : null}

      {/* ===== Message Action Sheet (Long-press على رسالة) ===== */}
      {actionSheetMsg && (
        <MessageActionSheet
          visible={!!actionSheetMsg}
          onClose={() => setActionSheetMsg(null)}
          roomId={roomId!}
          canManagePins={!isAgencyRoom && supervisorPerms.pinMessages}
          message={{
            id: actionSheetMsg.id,
            uid: actionSheetMsg.uid,
            name: actionSheetMsg.name,
            avatar: actionSheetMsg.avatar,
            text: actionSheetMsg.text,
          }}
          isPinned={pinnedMessages.some((p) => p.messageId === actionSheetMsg.id)}
          pinnedId={pinnedMessages.find((p) => p.messageId === actionSheetMsg.id)?.id}
        />
      )}

    </View>
    </View>
    </>
  );
}

// ⚡ صف رسالة واحدة — memo يمنع إعادة رسم الرسائل القديمة عند وصول رسالة جديدة
const CHAT_AVATAR_SIZE = 30;

const ChatMessageAvatar = React.memo(function ChatMessageAvatar({
  msg,
  frameUri,
  onPress,
}: {
  msg: RoomMessage;
  frameUri?: string;
  onPress?: () => void;
}) {
  if (!msg.uid) return null;
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.chatAvatarBtn}>
      {frameUri ? (
        <FramedAvatar
          avatarUri={msg.avatar}
          frameUri={frameUri}
          avatarSize={CHAT_AVATAR_SIZE}
          fallbackLetter={msg.name}
        />
      ) : msg.avatar ? (
        <Image
          source={{ uri: msg.avatar }}
          style={styles.chatAvatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={msg.avatar}
        />
      ) : (
        <View style={[styles.chatAvatar, styles.chatAvatarFallback]}>
          <LucideIcons.User size={14} color="rgba(255,255,255,0.7)" />
        </View>
      )}
    </Pressable>
  );
});

/** وسام صورة صغير داخل الشات — خفيف ومخزَّن (memory-disk)، بحجم واضح ومنسّق */
const ChatBadgeImage = React.memo(function ChatBadgeImage({ uri, wide }: { uri: string; wide?: boolean }) {
  return (
    <Image
      source={{ uri }}
      style={{ height: 19, width: wide ? 47 : 38 }}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={uri}
    />
  );
});

const ChatMessageMeta = React.memo(function ChatMessageMeta({
  name,
  meta,
  isPinned,
  onNamePress,
}: {
  name: string;
  meta?: ChatUserMeta;
  isPinned?: boolean;
  onNamePress?: () => void;
}) {
  return (
    <View style={styles.chatMsgMeta}>
      {isPinned ? (
        <LucideIcons.Pin size={9} color={lu.colors.pink} fill={lu.colors.pink} />
      ) : null}
      <Pressable onPress={onNamePress} disabled={!onNamePress}>
        <Text style={styles.chatMsgName} numberOfLines={1}>
          {name}
        </Text>
      </Pressable>
      {/* موثّق */}
      {meta?.isVerified ? (
        <View style={styles.chatVerified}>
          <LucideIcons.BadgeCheck size={12} color="#fff" strokeWidth={2.4} />
        </View>
      ) : null}
      {/* مستوى العلاقة (نفس وسام البروفايل ❤) */}
      {meta?.relationshipLevel && meta.relationshipLevel > 0 ? (
        <View style={styles.chatRelPill}>
          <LucideIcons.Infinity size={10} color="#fff" strokeWidth={2.6} />
          <Text style={styles.chatRelText}>{meta.relationshipLevel}</Text>
        </View>
      ) : null}
      {/* أوسمة المستخدم (نفس صور البروفايل) — مرتّبة بحجم واضح وخفيف */}
      {meta?.vipBadgeUrl ? <ChatBadgeImage uri={meta.vipBadgeUrl} /> : null}
      {meta?.princeBadgeUrl ? <ChatBadgeImage uri={meta.princeBadgeUrl} wide /> : null}
      {meta?.aristocracyBadgeUrl ? <ChatBadgeImage uri={meta.aristocracyBadgeUrl} /> : null}
    </View>
  );
});

const ChatMessageRow = React.memo(({
  msg,
  myUid,
  onJoinRoomGame,
  onLongPress,
  onUserPress,
  isPinned,
  giftsCatalog = [],
  frameUri,
  bubbleUri,
  meta,
  mentionIndex,
  onMentionPress,
}: {
  msg: RoomMessage;
  myUid?: string;
  onJoinRoomGame?: (payload: {
    sessionId: string;
    gameId: RoomFreeGameId;
    joinCode?: string;
  }) => void;
  onLongPress?: (msg: RoomMessage) => void;
  onUserPress?: (msg: RoomMessage) => void;
  isPinned?: boolean;
  giftsCatalog?: GiftType[];
  frameUri?: string;
  bubbleUri?: string;
  meta?: ChatUserMeta;
  mentionIndex?: Map<string, import('@/utils/mentions').RoomMentionEntry>;
  onMentionPress?: (uid: string) => void;
}) => {
  const { t } = useTranslation();
  const displayName = resolveDisplayName({ displayName: msg.name });
  const openUser = msg.uid ? () => onUserPress?.(msg) : undefined;

  if (msg.type === 'agency_entry') {
    return (
      <AgencyRoomEntryChatMessage
        name={msg.name}
        avatar={msg.avatar}
        isSelf={msg.uid === myUid}
        onPress={msg.uid ? () => onUserPress?.(msg) : undefined}
      />
    );
  }

  if (msg.type === 'system') {
    const body = (msg.text ?? '').trim();
    if (!body) return null;
    return (
      <View style={styles.systemMsg}>
        <Text style={styles.systemMsgText}>{body}</Text>
      </View>
    );
  }

  if (msg.type === 'room_game_invite' && msg.inviteSessionId) {
    return (
      <Pressable
        onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
        delayLongPress={400}
        style={styles.chatMsgRow}
      >
        <ChatMessageAvatar msg={msg} frameUri={frameUri} onPress={openUser} />
        <View style={styles.chatMsgBody}>
          <ChatMessageMeta
            name={displayName}
            meta={meta}
            isPinned={isPinned}
            onNamePress={openUser}
          />
          <RoomGameInviteChatCard
            msg={msg}
            myUid={myUid}
            onJoin={(payload) => onJoinRoomGame?.(payload)}
          />
        </View>
      </Pressable>
    );
  }

  if (msg.type === 'gift') {
    const qty = msg.giftQuantity ?? 1;
    const catalogGift = giftsCatalog.find((g) => g.id === msg.giftId);
    const displayGift: GiftType = catalogGift ?? {
      id: msg.giftId ?? '',
      name: msg.giftName ?? '',
      price: 0,
      category: '',
      iconName: 'Gift',
      iconColor: lu.colors.pink,
      rarity: 'common',
      imageUrl: msg.imageUrl,
      animationUrl: msg.animationUrl,
      soundUrl: msg.soundUrl,
      videoUrl: msg.videoUrl,
    };
    return (
      <Pressable
        onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
        delayLongPress={400}
        style={styles.chatMsgRow}
      >
        <ChatMessageAvatar msg={msg} frameUri={frameUri} onPress={openUser} />
        <View style={styles.chatMsgBody}>
          <ChatMessageMeta
            name={displayName}
            meta={meta}
            isPinned={isPinned}
            onNamePress={openUser}
          />
          <RoomGiftChatLine
            gift={displayGift}
            recipientName={msg.toName}
            quantity={qty}
            isGroupGift={msg.isGroupGift}
            recipientCount={msg.recipientCount}
          />
        </View>
      </Pressable>
    );
  }

  if (msg.type === 'emoji') {
    const em = msg.emoji ?? msg.text ?? '✨';
    const { imageUrl } = parseRoomReactionDisplay(em);
    const reactionSize = imageUrl ? ROOM_REACTION_CHAT_SIZE : 36;
    return (
      <Pressable
        onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
        delayLongPress={400}
        style={styles.chatMsgRow}
      >
        <ChatMessageAvatar msg={msg} frameUri={frameUri} onPress={openUser} />
        <View style={styles.chatMsgBody}>
          <ChatMessageMeta
            name={displayName}
            meta={meta}
            isPinned={isPinned}
            onNamePress={openUser}
          />
          <View style={imageUrl ? styles.chatReactionWrap : undefined}>
            <RoomReactionDisplay
              value={em}
              size={reactionSize}
              variant={imageUrl ? 'chat' : 'default'}
            />
          </View>
        </View>
      </Pressable>
    );
  }

  const body = (msg.text ?? '').trim();
  if (!body) return null;

  return (
    <Pressable
      onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
      delayLongPress={400}
      style={styles.chatMsgRow}
    >
      <ChatMessageAvatar msg={msg} frameUri={frameUri} onPress={openUser} />
      <View style={styles.chatMsgBody}>
        <ChatMessageMeta
          name={displayName}
          meta={meta}
          isPinned={isPinned}
          onNamePress={openUser}
        />
        <FramedMessageBubble
          bubbleUri={bubbleUri}
          textStyle={styles.chatMsgText}
          style={styles.chatMsgBubble}
        >
          <RoomChatMessageText
            text={body}
            style={styles.chatMsgText}
            mentionIndex={mentionIndex}
            onMentionPress={onMentionPress}
          />
        </FramedMessageBubble>
      </View>
    </Pressable>
  );
}, (prev, next) =>
  prev.msg.id === next.msg.id
  && prev.isPinned === next.isPinned
  && prev.frameUri === next.frameUri
  && prev.bubbleUri === next.bubbleUri
  && prev.meta === next.meta
  && prev.mentionIndex === next.mentionIndex
  && prev.onMentionPress === next.onMentionPress);

const FloatingEmojiBurst = ({
  emoji,
  x,
  bottomOffset,
  onDone,
}: {
  emoji: string;
  x: number;
  bottomOffset: number;
  onDone: () => void;
}) => {
  const rise = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rise, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 260, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 1040, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1300,
        useNativeDriver: true,
      }),
    ]).start(onDone);
  }, [rise, scale, opacity, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.emojiBurst,
        {
          start: x,
          bottom: bottomOffset,
          opacity,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -210] }) },
            { scale },
          ],
        },
      ]}
    >
      <Text style={styles.emojiBurstText}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  gateBlockingScreen: {
    backgroundColor: ROOM_DESIGN.shellBg,
  },
  flex1: { flex: 1 },
  container: { flex: 1, backgroundColor: lu.colors.room0 },
  chatBottomFade: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    zIndex: 25,
  },
  chatInputDismissOverlay: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 95,
  },
  /** يغطي الشات فقط — لا يحجب الشريط السفلي (إيموجي / أدوات / شبكة) */
  roomBottomBackdrop: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 40,
  },
  roomBottomPanel: {
    position: 'absolute',
    start: 0,
    end: 0,
    zIndex: 45,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Top header redesigned
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    width: '100%',
  },
  leftActionsColumn: {
    alignItems: 'flex-start',
    gap: 8,
  },
  leftHeaderCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leftVerticalButtons: {
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  rightInfoPanel: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  roomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  trophyCrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  lvBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: lu.colors.purpleDark,
    borderRadius: 4,
  },
  audienceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.full,
  },
  audienceCountText: {
    marginEnd: 6,
    minWidth: 14,
    textAlign: 'center',
  },
  audienceStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audienceAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: lu.colors.room0,
  },
  audienceAvatarFallback: {
    backgroundColor: lu.colors.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.full,
  },
  crownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(252, 211, 77, 0.15)',
    borderRadius: radius.full,
  },

  seatsSection: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginTop: 0,
    marginBottom: 5,
    zIndex: 10,
  },
  partyStageBadgeInline: {
    position: 'absolute',
    top: -26, // Pulls it up into the header area
    right: 64, // Pushes it to the left of the crown badge
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(225, 20, 20,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165,0.35)',
  },
  grid2x4: {
    paddingHorizontal: spacing.sm,
    marginTop: 0,
    marginBottom: 8,
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
  },
  gridCell: {
    alignItems: 'center',
  },

  // Stage (legacy)
  stageContainer: {
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  partyStageBadge: {
    position: 'absolute',
    top: spacing.base,
    end: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(232, 23, 23, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 23, 23, 0.3)',
    borderRadius: radius.full,
  },
  hostSeatSection: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6, // القيمة الفعلية تُضبط inline (34 مع العرش، 6 بدونه)
    zIndex: 2,
  },
  hostSeatRow: {
    flexDirection: 'row',
    alignItems: 'center', // Aligns Throne and Host seat exactly in the middle
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  hostSeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(225, 20, 20,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.5)',
    marginBottom: 8,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  hostCenterWrap: {
    alignItems: 'center',
    gap: 6,
  },
  hostCoinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 4,
  },
  hostCoinsText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: lu.fonts.body,
  },
  simpleScreenHint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    minHeight: 120,
  },
  simpleScreenExit: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 211, 77, 0.12)',
  },
  // طبقة برواز المضيف — شفافة حول الصورة (PNG مفرّغ)
  hostFrameOverlay: {
    position: 'absolute',
    top: -12,
    width: 100,
    height: 100,
    alignSelf: 'center',
    zIndex: 5,
  },
  hostCenterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    backgroundColor: lu.colors.purpleDark,
    position: 'relative',
  },
  hostCenterImg: {
    width: '100%',
    height: '100%',
  },
  mutedDot: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: lu.colors.room0,
  },
  emptyHostCenter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Waveforms
  waveformLeft: {
    position: 'absolute',
    start: 16,
    top: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveformRight: {
    position: 'absolute',
    end: 16,
    top: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveCol: {
    width: 3,
    backgroundColor: lu.colors.purple,
    borderRadius: 2,
  },

  // Seats grid (يدعم 8/10/15/18 مقاعد)
  seatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    marginTop: 0,
    marginBottom: 4,
    rowGap: 12, // تباعد رأسي منتظم بين الصفوف فقط
    columnGap: 0, // أفقياً: عرض الخلية = 100/الأعمدة% يضمن عدداً ثابتاً بكل صف بلا لفّ خاطئ
  },
  uSeatsGrid: {
    paddingHorizontal: 8,
    marginTop: -4,
    marginBottom: spacing.base,
    gap: 12,
    width: '100%',
  },
  uSeatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  uSeatsRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  uSeatBottomSpacer: {
    width: 68,
  },
  seatsGridPk: {
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  // تخطيط شقّي PK — أزرق ضد أحمر
  pkTeamsRow: {
    flexDirection: 'row',
    direction: 'ltr', // أزرق دائماً يسار / أحمر يمين (مطابق لشريط النقاط) في كل اللغات
    marginTop: -8,
    marginBottom: spacing.base,
    marginHorizontal: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pkTeamPanel: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  pkTeamPanelBlue: {
    backgroundColor: 'rgba(234, 38, 38, 0.22)',
  },
  pkTeamPanelRed: {
    backgroundColor: 'rgba(220,38,38,0.22)',
  },
  pkChipGrad: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    minWidth: 40,
    alignItems: 'center',
  },
  pkChipActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(244,63,94,0.6)',
    borderRadius: radius.full,
  },
  pkEndFab: {
    position: 'absolute',
    end: 12,
    zIndex: 60,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  seatGridItem: {
    alignItems: 'center',
  },

  // Seats row (legacy - kept for compatibility)
  seatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    marginTop: -10,
    marginBottom: spacing.base,
  },
  seatItem: {
    alignItems: 'center',
    width: 70,
  },
  seatOccupied: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
    backgroundColor: lu.colors.purpleDark,
  },
  seatAvatarImg: {
    width: '100%',
    height: '100%',
  },
  seatMutedDot: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: lu.colors.room0,
  },
  seatEmpty: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Audience strip above chat
  audienceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  audienceStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  audienceStripAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  audienceStripFallback: {
    backgroundColor: 'rgba(225, 20, 20, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceStripInitial: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
  audienceStripMore: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceStripMoreText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 8,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
  audienceStripCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(225, 20, 20, 0.3)',
    marginStart: 6,
  },
  audienceStripCountText: {
    fontSize: 10,
  },

  // Chat area
  chatArea: {
    flex: 1,
    minHeight: 160,
    paddingHorizontal: spacing.base,
    marginTop: 2,
    overflow: 'hidden',
  },
  chatContent: {
    gap: 4,
    // في القائمة المقلوبة: paddingTop = الأسفل البصري (فسحة فوق شريط الكتابة لأحدث رسالة)
    paddingTop: spacing.sm,
  },
  systemMsg: {
    gap: 2,
    alignSelf: 'stretch',
    maxWidth: '92%',
    marginBottom: 4,
    paddingVertical: 2,
  },
  systemMsgTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: lu.colors.gold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  systemMsgText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chatAvatarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatAvatar: {
    width: CHAT_AVATAR_SIZE,
    height: CHAT_AVATAR_SIZE,
    borderRadius: CHAT_AVATAR_SIZE / 2,
  },
  chatAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMsgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '96%',
    paddingVertical: 2,
  },
  chatMsgBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingTop: 1,
    alignItems: 'flex-start',
  },
  chatMsgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  chatMsgName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 140,
  },
  chatVerified: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16C79A',
  },
  chatRelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(196, 14, 30, 0.92)',
    borderRadius: 99,
  },
  chatRelText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chatMsgText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 15,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  chatMsgBubble: {
    maxWidth: '100%',
    marginTop: 1,
  },
  chatMsgTextMuted: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },
  chatGiftLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  chatReactionWrap: {
    marginTop: 2,
    marginBottom: 4,
  },
  emojiBurst: {
    position: 'absolute',
    zIndex: 120,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  emojiBurstText: {
    fontSize: 36,
    lineHeight: 46,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    includeFontPadding: true,
  },

  musicDiscAnchor: {
    position: 'absolute',
    start: spacing.md,
    zIndex: 45,
    elevation: 45,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: 'column',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 8, 8, 0.42)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    zIndex: 30,
  },
  chatComposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  composerEmojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  composerEmojiBtnActive: {
    backgroundColor: 'rgba(225, 20, 20,0.22)',
    borderColor: lu.colors.pink,
  },
  chatInputWrap: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingStart: 16,
    paddingEnd: 4,
    paddingVertical: 4,
  },
  chatInput: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 38,
    paddingVertical: Platform.OS === 'android' ? 6 : 8,
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 4,
  },
  chatSendBtnDisabled: {
    opacity: 0.65,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  toolChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  giftChip: {
    backgroundColor: 'rgba(225, 20, 20,0.85)',
    borderWidth: 0,
  },
  sfxChip: {
    borderWidth: 1,
    borderColor: 'rgba(255, 186, 73, 0.4)',
  },
  sfxChipActive: {
    backgroundColor: 'rgba(255, 186, 73, 0.28)',
    borderColor: lu.colors.gold,
  },
  msgBadge: {
    position: 'absolute',
    top: -4,
    end: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  // Modal common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  followModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  followModalCard: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    ...shadows.lg,
  },
  followModalIconWrap: {
    marginTop: -42,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 38,
    padding: 4,
  },
  followModalIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followModalBtn: {
    marginTop: 16,
    width: '100%',
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceModal: {
    backgroundColor: '#fff',
    borderTopStartRadius: radius['2xl'],
    borderTopEndRadius: radius['2xl'],
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    maxHeight: SCREEN_H * 0.82,
    overflow: 'hidden',
  },
  audienceModalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  audienceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  audienceCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceCloseBtnGhost: {
    width: 30,
    height: 30,
    borderRadius: 15,
    opacity: 0,
  },
  audienceHelpBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
    marginBottom: spacing.sm,
  },
  audienceTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  audienceTabItemActive: {
    borderBottomColor: lu.colors.pink,
  },
  audienceHint: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E9EAF5',
  },
  audienceEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F8',
  },
  audienceRankPill: {
    minWidth: 28,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FBEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  audienceRowAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  audienceBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  audienceBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  audiencePlusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E8EE',
  },
  audiencePlusBtnActive: {
    backgroundColor: lu.colors.purple,
    borderColor: lu.colors.purple,
  },

  // Gifts Modal
  giftsModal: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    borderTopStartRadius: radius['2xl'],
    borderTopEndRadius: radius['2xl'],
    maxHeight: SCREEN_H * 0.75,
    overflow: 'hidden',
  },
  giftsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.full,
  },
  recipientChip: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginEnd: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    minWidth: 60,
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  selectedRecipientBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(252, 211, 77, 0.2)',
    borderRadius: radius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: lu.colors.gold,
  },
  giftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  giftItem: {
    width: '22%',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  giftItemSelected: {
    borderColor: lu.colors.gold,
    backgroundColor: 'rgba(252, 211, 77, 0.2)',
  },
  giftIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  giftPriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  sendGiftBtn: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.base,
  },
  sendGiftBtnDisabled: {
    opacity: 0.5,
  },

  // Contribution
  contribModal: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    borderTopStartRadius: radius['2xl'],
    borderTopEndRadius: radius['2xl'],
    maxHeight: SCREEN_H * 0.8,
    overflow: 'hidden',
  },
  contribHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.base,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.md,
    marginBottom: 6,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: 'rgba(252, 211, 77, 0.3)',
    borderWidth: 1.5,
    borderColor: lu.colors.gold,
  },
  contribAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  // More Rooms drawer
  drawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)', // Extra darkening
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  moreRoomsDrawer: {
    width: '100%',
    height: SCREEN_H * 0.65, // Fixed height so FlatList can expand inside
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    overflow: 'hidden',
    elevation: 24,
  },
  glassTopBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  drawerHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  drawerHeader: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  moreRoomsTitle: {
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  moreRoomsList: {
    flex: 1,
    minHeight: 0,
  },
  moreRoomsListContent: {
    paddingBottom: spacing.sm,
  },
  moreRoomsListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  drawerFooter: {
    flexShrink: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 10,
    borderRadius: 18,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  partyPillMini: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 122, 122, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 122, 0.5)',
  },
  roomCardImg: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: lu.colors.purpleDark,
  },
  hostCloseLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  drawerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
    flexShrink: 0,
  },
  exitBigBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  exitBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  keepBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  keepBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.5)',
  },
});
