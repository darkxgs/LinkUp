/**
 * LinkUp App — Conversations Service (Firestore)
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
  deleteField,
  type FieldValue,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { resolveDisplayName } from '@/utils/displayName';
import { parseLastSeen } from '@/utils/presence';
import { resolveUserDocAvatar, resolveConversationPeerAvatar } from '@/utils/userAvatar';
import { getUser } from './users';
import { waitForFirestoreAuth, subscribeWhenAuthenticated } from './authReady';
import type { User } from '@firebase/auth';
import { isBlockedBetween } from './blocks';
import { isOfficialHiddenInChatList, resolveOfficialChatDisplayName, isOfficialSystemAccount } from '@/services/supportAccount';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';
import {
  getCallPricingOnce,
  getChatMessagePrice,
  type ChatMessagePriceType,
} from './callPricingConfig';

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage: string;
  lastMessageAt: number;
  unreadBy: Record<string, number>;
  pinnedBy?: Record<string, boolean>;
  archivedBy?: Record<string, boolean>;
  hiddenBy?: Record<string, boolean>;
  /** وقت حذف المحادثة صراحةً من القائمة — يمنع إعادة إظهارها تلقائياً */
  deletedAtBy?: Record<string, number>;
  lastReadAt?: Record<string, number>;
  /** @deprecated — استخدم chatBackgroundBy */
  chatBackgroundId?: string;
  /** خلفية المحادثة لكل مستخدم على حدة */
  chatBackgroundBy?: Record<string, string>;
  isOnline?: boolean;
}

/** إعادة إظهار المحادثة في قائمة مستخدم (رسالة جديدة أو فتح الشات) */
export function buildConversationUnhidePatch(uid: string): Record<string, unknown> {
  return {
    [`hiddenBy.${uid}`]: false,
    [`deletedAtBy.${uid}`]: deleteField(),
  };
}

export function buildConversationUnhidePatchForBoth(uidA: string, uidB: string): Record<string, unknown> {
  return {
    ...buildConversationUnhidePatch(uidA),
    ...buildConversationUnhidePatch(uidB),
  };
}

/** محادثة لها سجل فعلي — تستبعد المحادثات التي فُتحت دون إرسال رسالة */
export function conversationHasThreadActivity(c: Conversation): boolean {
  if ((c.lastMessage ?? '').trim().length > 0) return true;
  return c.participants.some(
    (p) => isOfficialSystemAccount(p) && !isOfficialHiddenInChatList(p),
  );
}

/** خلفية المحادثة للمستخدم الحالي فقط (لا تظهر للطرف الآخر) */
export function resolveConversationChatBackgroundId(
  conv: Conversation | null | undefined,
  uid: string | undefined,
): string | undefined {
  if (!uid || !conv) return undefined;
  const mine = conv.chatBackgroundBy?.[uid];
  if (mine) return mine;
  if (!conv.chatBackgroundBy && conv.chatBackgroundId) {
    return conv.chatBackgroundId;
  }
  return undefined;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  fromUid: string;
  toUid: string;
  text: string;
  type: 'text' | 'gift' | 'image' | 'voice' | 'video' | 'file' | 'room_invite' | 'agency_invite' | 'party_invite' | 'game_invite' | 'post_share' | 'call';
  /** دعوة غرفة */
  inviteRoomId?: string;
  inviteRoomName?: string;
  inviteShortUrl?: string;
  inviteDeepLink?: string;
  /** مشاركة منشور */
  invitePostId?: string;
  invitePostAuthor?: string;
  invitePostPreview?: string;
  /** دعوة وكالة */
  inviteAgencyId?: string;
  inviteAgencyName?: string;
  /** دعوة حفل */
  invitePartyId?: string;
  invitePartyTitle?: string;
  /** دعوة تحدي لعبة */
  inviteChallengeId?: string;
  inviteGameId?: string;
  inviteGameName?: string;
  inviteBet?: number;
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
  giftId?: string;
  giftName?: string;
  giftQuantity?: number;
  giftPrice?: number;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  voiceUrl?: string;
  voiceDuration?: number; // بالثواني
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: number;
  /** سجل مكالمة 1-to-1 */
  callType?: 'voice' | 'video';
  callStatus?: 'completed' | 'missed' | 'declined';
  callDurationSeconds?: number;
  callChannelName?: string;
  // === الرسائل المقفلة / المؤقتة ===
  isLocked?: boolean;          // تحتاج دفع كوينز للفتح
  unlockPrice?: number;        // السعر بالكوينز (snapshot وقت الإرسال)
  unlockedBy?: string[];       // قائمة من فتحوها (uids)
  expireMode?: 'once' | 'timed'; // مرة واحدة (تختفي) أو تقفل بعد مدة
  viewDuration?: number;       // ثواني العرض قبل الإخفاء (لـ once و timed)
  viewedBy?: string[];         // من شاهدها (لـ once)
  createdAt: number;
  isRead: boolean;
  readAt?: number;
  /** إخفاء الرسالة لمستخدم واحد (حذف لي فقط) */
  hiddenFor?: Record<string, boolean>;
  deleted?: boolean;
  /** رد على رسالة سابقة — snapshot وقت الإرسال */
  replyTo?: ChatReplySnapshot;
}

export type ChatReplySnapshot = {
  messageId: string;
  fromUid: string;
  type: ChatMessage['type'];
  /** نص معاينة مختصر (صورة، صوت، …) */
  text: string;
};

/** بناء snapshot للرد — يُخزَّن مع الرسالة */
export function buildReplySnapshot(msg: ChatMessage): ChatReplySnapshot {
  return {
    messageId: msg.id,
    fromUid: msg.fromUid,
    type: msg.type ?? 'text',
    text: getChatMessagePreviewLabel(msg).slice(0, 200),
  };
}

/** نص معاينة آخر رسالة في قائمة المحادثات */
export function getChatMessagePreviewLabel(msg: Partial<ChatMessage>): string {
  if (msg.type === 'text' || !msg.type) return (msg.text ?? '').trim();
  if (msg.type === 'image') return 'صورة';
  if (msg.type === 'voice') return 'رسالة صوتية';
  if (msg.type === 'video') return 'فيديو';
  if (msg.type === 'gift') return '🎁';
  if (msg.type === 'call') {
    const voice = msg.callType !== 'video';
    if (msg.callStatus === 'completed') {
      return voice ? '📞 مكالمة صوتية' : '📹 مكالمة فيديو';
    }
    if (msg.callStatus === 'declined') {
      return voice ? '📞 مكالمة صوتية مرفوضة' : '📹 مكالمة فيديو مرفوضة';
    }
    return voice ? '📞 مكالمة صوتية فائتة' : '📹 مكالمة فيديو فائتة';
  }
  if (msg.type === 'file') return msg.fileName?.trim() ? `📎 ${msg.fileName.trim()}` : '📎 ملف';
  if (msg.type === 'room_invite') return msg.text?.trim() || 'دعوة غرفة';
  if (msg.type === 'agency_invite') return msg.text?.trim() || 'دعوة وكالة';
  if (msg.type === 'party_invite') return msg.text?.trim() || 'دعوة حفل';
  if (msg.type === 'game_invite') return msg.text?.trim() || 'دعوة تحدي';
  if (msg.type === 'post_share') return msg.text?.trim() || 'منشور';
  return (msg.text ?? '').trim();
}

const lastMessageRepairScheduled = new Set<string>();

/** إصلاح lastMessage من آخر رسالة فعلية (للمحادثات التي فُرغت بالخطأ) */
export async function repairConversationLastMessage(conversationId: string): Promise<boolean> {
  if (!conversationId) return false;
  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'messages'),
        where('conversationId', '==', conversationId),
        limit(100),
      ),
    );
    const msgs = snap.docs
      .map((d) => d.data() as ChatMessage)
      .filter((m) => !m.deleted)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    if (msgs.length === 0) return false;

    const last = msgs[0]!;
    const preview = getChatMessagePreviewLabel(last);
    if (!preview) return false;

    await updateDoc(doc(firestore, 'conversations', conversationId), {
      lastMessage: preview,
      lastMessageAt: last.createdAt ?? Date.now(),
    });
    return true;
  } catch (e) {
    console.warn('repairConversationLastMessage:', e);
    return false;
  }
}

function scheduleLastMessageRepair(conversationId: string): void {
  if (!conversationId || lastMessageRepairScheduled.has(conversationId)) return;
  lastMessageRepairScheduled.add(conversationId);
  void repairConversationLastMessage(conversationId).finally(() => {
    lastMessageRepairScheduled.delete(conversationId);
  });
}

const hiddenWelcomeRepairScheduled = new Set<string>();

/** إظهار محادثة مخفية عند المرسل إذا سبق وأرسل رسالة ترحيب/افتتاحية */
function scheduleHiddenWelcomeConversationReveal(conversationId: string, uid: string): void {
  const key = `${conversationId}_${uid}`;
  if (!conversationId || !uid || hiddenWelcomeRepairScheduled.has(key)) return;
  hiddenWelcomeRepairScheduled.add(key);
  void (async () => {
    try {
      const convRef = doc(firestore, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) return;
      if (convSnap.data()?.deletedAtBy?.[uid]) return;

      const snap = await getDocs(
        query(
          collection(firestore, 'messages'),
          where('conversationId', '==', conversationId),
          where('fromUid', '==', uid),
          limit(1),
        ),
      );
      if (snap.empty) return;
      const msg = snap.docs[0]!.data() as ChatMessage;
      const preview = getChatMessagePreviewLabel(msg);
      if (!preview) return;
      await updateDoc(convRef, {
        lastMessage: preview,
        lastMessageAt: msg.createdAt ?? Date.now(),
        ...buildConversationUnhidePatch(uid),
        [`archivedBy.${uid}`]: false,
        [`unreadBy.${uid}`]: 0,
      });
    } catch (e) {
      console.warn('scheduleHiddenWelcomeConversationReveal:', e);
    } finally {
      hiddenWelcomeRepairScheduled.delete(key);
    }
  })();
}

// === Get conversations ===
export const getConversations = async (): Promise<Conversation[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', user.uid),
      limit(100),
    );
    const snap = await getDocs(q);
    const convs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Conversation);
    // ترتيب في الكلاينت
    convs.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
    return convs.slice(0, 50);
  } catch (e) {
    console.error('getConversations:', e);
    return [];
  }
};

// === Subscribe to conversations ===
// نضيف isOnline + presence بناءً على users/{uid}.lastSeen (آخر دقيقتين = متصل)
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // دقيقتان

export const subscribeToConversations = (
  callback: (convs: Conversation[]) => void,
  // enrich=false: مسار خفيف يعيد المستندات الخام بلا جلب مستندات الأطراف
  // (للاستخدام حيث نحتاج العدّ فقط، مثل شارة «غير مقروء» داخل الروم).
  // الافتراضي إثراء كامل (اسم/صورة/حالة اتصال) لقائمة الدردشات.
  options?: { enrich?: boolean },
): (() => void) => {
  // نفس إصلاح سباق الإقلاع في notifications.ts: قراءة auth.currentUser لحظة
  // الاستدعاء تُرجع noop إذا رُكِّب المستمع قبل اكتمال استعادة الجلسة.
  let fsUnsub: (() => void) | null = null;
  let attachedUid: string | null = null;
  let disposed = false;

  const authUnsub = subscribeWhenAuthenticated(
    (user) => {
      if (disposed || attachedUid === user.uid) return;
      fsUnsub?.();
      attachedUid = user.uid;
      fsUnsub = attachConversationsListener(user, callback, options);
    },
    () => {
      if (disposed) return;
      fsUnsub?.();
      fsUnsub = null;
      attachedUid = null;
      callback([]);
    },
  );

  return () => {
    disposed = true;
    authUnsub();
    fsUnsub?.();
    fsUnsub = null;
  };
};

function attachConversationsListener(
  user: User,
  callback: (convs: Conversation[]) => void,
  options?: { enrich?: boolean },
): () => void {
  const enrich = options?.enrich !== false; // الافتراضي: إثراء كامل
  const q = query(
    collection(firestore, 'conversations'),
    where('participants', 'array-contains', user.uid),
    orderBy('lastMessageAt', 'desc'),
    limit(50),
  );

  // كاش لـ lastSeen وأسماء العرض — صور البروفايل تُحدَّث كل snapshot
  const lastSeenCache = new Map<string, number>();
  const displayNameCache = new Map<string, string>();
  const avatarCache = new Map<string, string>();
  // جلب تفاضلي: وقت آخر جلب لكل طرف — رسالة واردة كانت تعيد جلب كل الأطراف
  // (~50 getDoc لكل لقطة) فتخنق خيط JS وتيار Firestore وتؤخر عرض الرسالة نفسها
  const fetchedAt = new Map<string, number>();
  const PEER_REFRESH_TTL_MS = 45_000;

  // حارس ترتيب اللقطات — الإثراء غير المتزامن (جلب مستندات الأطراف) كان يسمح
  // للقطة قديمة أن تكتمل بعد الأحدث فتستقر شارة «غير مقروء» وهمية/قديمة
  // (تظهر خصوصاً في شارة الرسائل داخل الروم رغم تصفير العدّاد فعلياً)
  let snapshotSeq = 0;

  return onSnapshot(q, async (snap) => {
    const seq = ++snapshotSeq;
    const baseConvs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Conversation);

    // مسار خفيف: عدّ «غير مقروء» فقط بلا جلب مستندات الأطراف.
    // كان الإثراء يقرأ getDoc(users/{peer}) لكل طرف من حتى 50 محادثة على كل
    // لقطة (~50 قراءة). هنا نعيد المستندات الخام (unreadBy) مع نفس الفلترة
    // (المخفية/المحذوفة/الرسمية المخفية/بلا نشاط) ليطابق العدّ قائمة الدردشات.
    if (!enrich) {
      const visible = baseConvs.filter(
        (c) =>
          !c.hiddenBy?.[user.uid] &&
          !c.deletedAtBy?.[user.uid] &&
          !c.participants.some((p) => isOfficialHiddenInChatList(p)) &&
          conversationHasThreadActivity(c),
      );
      callback(visible);
      return;
    }

    // بثّ فوري من الكاش ثم ترقيع تفاضلي غير متزامن — كانت اللقطة تنتظر جلبات
    // الأطراف (حتى 50 getDoc) قبل أي عرض، فتصل الرسالة الواردة بعد إشعارها بوضوح
    const emit = (): Conversation[] => {
      // ادمج isOnline + أسماء حقيقية + صور محدّثة (من الكاش)
      const now = Date.now();
      const enriched: Conversation[] = buildEnriched(now);
      const visible = enriched.filter(
        (c) =>
          !c.hiddenBy?.[user.uid] &&
          !c.deletedAtBy?.[user.uid] &&
          !c.participants.some((p) => isOfficialHiddenInChatList(p)) &&
          conversationHasThreadActivity(c),
      );
      visible.sort((a, b) => {
        const aPinned = a.pinnedBy?.[user.uid] ? 1 : 0;
        const bPinned = b.pinnedBy?.[user.uid] ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
      });
      callback(visible);
      return enriched;
    };

    const firstPass = emit();
    for (const c of firstPass) {
      if (c.hiddenBy?.[user.uid] && !c.deletedAtBy?.[user.uid]) {
        scheduleHiddenWelcomeConversationReveal(c.id, user.uid);
      }
      if (!(c.lastMessage ?? '').trim()) {
        scheduleLastMessageRepair(c.id);
      }
    }

    await waitForFirestoreAuth(12_000);

    // اجلب بيانات الأطراف الآخرين — التفاضلي فقط (خارج TTL الإنعاش)
    const otherUids = new Set<string>();
    for (const c of baseConvs) {
      const other = c.participants.find((p) => p !== user.uid);
      if (other) otherUids.add(other);
    }
    const missing = Array.from(otherUids).filter(
      (uid) => Date.now() - (fetchedAt.get(uid) ?? 0) > PEER_REFRESH_TTL_MS,
    );
    if (missing.length === 0) return;

    await Promise.all(
      missing.map(async (uid) => {
        const officialName = resolveOfficialChatDisplayName(uid);
        if (officialName) {
          lastSeenCache.set(uid, 0);
          if (!displayNameCache.has(uid)) displayNameCache.set(uid, officialName);
          avatarCache.set(uid, '');
          fetchedAt.set(uid, Date.now());
          return;
        }
        try {
          const userSnap = await getDoc(doc(firestore, 'users', uid));
          if (userSnap.exists()) {
            const data = userSnap.data() as Record<string, unknown>;
            lastSeenCache.set(uid, parseLastSeen(data.lastSeen));
            if (!displayNameCache.has(uid)) {
              displayNameCache.set(
                uid,
                resolveDisplayName({
                  displayName: data.displayName as string | undefined,
                  email: data.email as string | undefined,
                }),
              );
            }
            avatarCache.set(uid, resolveUserDocAvatar(data, uid));
          } else {
            lastSeenCache.set(uid, 0);
            if (!displayNameCache.has(uid)) displayNameCache.set(uid, 'مستخدم');
            avatarCache.set(uid, '');
          }
          fetchedAt.set(uid, Date.now());
        } catch {
          // فشل الجلب لا يُسجَّل في fetchedAt — تُعاد المحاولة باللقطة التالية
          lastSeenCache.set(uid, 0);
          if (!displayNameCache.has(uid)) displayNameCache.set(uid, 'مستخدم');
          avatarCache.set(uid, '');
        }
      }),
    );

    // لقطة أحدث بدأت أثناء الإثراء — تجاهل هذه النتيجة القديمة كلياً
    if (seq !== snapshotSeq) return;

    // بثّ ثانٍ بالبيانات المجلوبة حديثاً
    emit();

    function buildEnriched(now: number): Conversation[] {
      return baseConvs.map((c) => {
      const other = c.participants.find((p) => p !== user.uid) ?? '';
      const lastSeen = lastSeenCache.get(other) ?? 0;
      const officialName = resolveOfficialChatDisplayName(other);
      const resolvedOther = officialName
        ?? displayNameCache.get(other)
        ?? resolveDisplayName({ displayName: c.participantNames?.[other] ?? '' });

      const myStored = c.participantNames?.[user.uid] ?? '';
      const resolvedMe = displayNameCache.get(user.uid)
        ?? resolveDisplayName({
          displayName: myStored,
          email: user.email ?? undefined,
        });

      const cachedAvatar = avatarCache.get(other)?.trim();
      const resolvedAvatar = resolveConversationPeerAvatar(
        c,
        other,
        cachedAvatar ? { avatar: cachedAvatar } : undefined,
      );

      return {
        ...c,
        participantNames: {
          ...c.participantNames,
          [other]: resolvedOther,
          [user.uid]: resolvedMe,
        },
        participantAvatars: {
          ...(c.participantAvatars ?? {}),
          [other]: resolvedAvatar,
        },
        isOnline: lastSeen > 0 && now - lastSeen < ONLINE_THRESHOLD_MS,
      };
      });
    }
  });
}

/** متابعة محادثة واحدة — لإيصالات القراءة اللحظية (lastReadAt)
 *  آمنة ضد سباق الإقلاع: الاشتراك قبل استعادة الجلسة كان يفشل نهائياً بلا إعادة محاولة */
export const subscribeToConversation = (
  conversationId: string,
  callback: (conv: Conversation | null) => void,
): (() => void) => {
  let fsUnsub: (() => void) | null = null;
  let attachedUid: string | null = null;
  let disposed = false;

  const authUnsub = subscribeWhenAuthenticated(
    (user) => {
      if (disposed || attachedUid === user.uid) return;
      fsUnsub?.();
      attachedUid = user.uid;
      fsUnsub = onSnapshot(
        doc(firestore, 'conversations', conversationId),
        (snap) => {
          if (!snap.exists()) {
            callback(null);
            return;
          }
          callback({ id: snap.id, ...snap.data() } as Conversation);
        },
        () => callback(null),
      );
    },
    () => {
      if (disposed) return;
      fsUnsub?.();
      fsUnsub = null;
      attachedUid = null;
      callback(null);
    },
  );

  return () => {
    disposed = true;
    authUnsub();
    fsUnsub?.();
    fsUnsub = null;
  };
};

/** تعيين خلفية المحادثة للمستخدم الحالي فقط */
export const setConversationChatBackground = async (
  conversationId: string,
  backgroundId: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  await updateDoc(doc(firestore, 'conversations', conversationId), {
    [`chatBackgroundBy.${user.uid}`]: backgroundId,
  });
};

// === Get/Create conversation ===
export const getOrCreateConversation = async (
  otherUid: string,
  otherName: string,
  otherAvatar: string,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  // Sort UIDs to create deterministic conversation ID
  const sortedUids = [user.uid, otherUid].sort();
  const convId = `${sortedUids[0]}_${sortedUids[1]}`;

  const convRef = doc(firestore, 'conversations', convId);
  // ⚡ الجلبات الثلاث بالتوازي — كانت متسلسلة (3 رحلات شبكة) فيتأخر فتح الشاشة
  const [meDoc, otherDoc, existingSnap] = await Promise.all([
    getUser(user.uid),
    getUser(otherUid),
    getDoc(convRef),
  ]);

  const myName = resolveDisplayName({
    displayName: meDoc?.displayName ?? user.displayName,
    email: meDoc?.email ?? user.email ?? undefined,
  });
  const theirName = resolveOfficialChatDisplayName(otherUid)
    ?? resolveDisplayName({
      displayName: otherDoc?.displayName ?? otherName,
      email: otherDoc?.email,
    });

  const participantNames = {
    [user.uid]: myName,
    [otherUid]: theirName,
  };
  const participantAvatars = {
    [user.uid]:
      (meDoc
        ? resolveUserDocAvatar(meDoc as unknown as Record<string, unknown>, user.uid)
        : '')
      || user.photoURL?.trim()
      || '',
    [otherUid]:
      (otherDoc
        ? resolveUserDocAvatar(otherDoc as unknown as Record<string, unknown>, otherUid)
        : '')
      || otherAvatar?.trim()
      || '',
  };

  if (existingSnap.exists()) {
    // تحديث الأسماء/الصور تجميلي — لا نحجب فتح المحادثة على رحلة كتابة إضافية
    void updateDoc(convRef, {
      participants: sortedUids,
      participantNames,
      participantAvatars,
    }).catch(() => {});
    const existing = existingSnap.data() as Conversation;
    if (!(existing.lastMessage ?? '').trim()) {
      scheduleLastMessageRepair(convId);
    }
    return convId;
  }

  await setDoc(convRef, {
    participants: sortedUids,
    participantNames,
    participantAvatars,
    lastMessage: '',
    lastMessageAt: 0,
    unreadBy: { [user.uid]: 0, [otherUid]: 0 },
  });

  return convId;
};

// ⚡ كاش الإعفاء من رسوم الرسائل — يوفّر قراءتي Firestore على كل رسالة
// (حالة الإعفاء: حساب رسمي/وكيل/أنثى معفاة — لا تتغير خلال دقائق المحادثة)
const chargeExemptCache = new Map<string, number>();
const CHARGE_EXEMPT_TTL_MS = 2 * 60 * 1000;

/** خصم كوينز إرسال رسالة شات — يُقرأ السعر من config/callPricing */
async function chargeForChatMessage(
  toUid: string,
  messageType: ChatMessagePriceType,
): Promise<number> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  if (isOfficialSystemAccount(user.uid) || isOfficialSystemAccount(toUid)) return 0;

  const exemptKey = `${user.uid}_${toUid}`;
  const exemptAt = chargeExemptCache.get(exemptKey);
  if (exemptAt && Date.now() - exemptAt < CHARGE_EXEMPT_TTL_MS) return 0;

  const [senderDoc, recipientDoc] = await Promise.all([
    getDoc(doc(firestore, 'users', user.uid)),
    getDoc(doc(firestore, 'users', toUid)),
  ]);
  const { isAgentChatParticipant } = await import('./hostTasks');
  const { canFemaleSendFreeText } = await import('@/utils/genderAccess');
  const senderData = senderDoc.data() as Record<string, unknown> | undefined;
  const recipientData = recipientDoc.data() as Record<string, unknown> | undefined;
  if (isAgentChatParticipant(senderData) || isAgentChatParticipant(recipientData)) {
    chargeExemptCache.set(exemptKey, Date.now());
    return 0;
  }

  // عضوا وكالة واحدة (مضيفة⇄مضيفة أو وكيل⇄مضيفة) — الدردشة بينهما مجانية
  const senderAgencyId = String((senderData as { agencyId?: unknown } | undefined)?.agencyId ?? '').trim();
  const recipientAgencyId = String((recipientData as { agencyId?: unknown } | undefined)?.agencyId ?? '').trim();
  if (senderAgencyId && senderAgencyId === recipientAgencyId) {
    chargeExemptCache.set(exemptKey, Date.now());
    return 0;
  }

  if (canFemaleSendFreeText(senderData as Parameters<typeof canFemaleSendFreeText>[0])) {
    chargeExemptCache.set(exemptKey, Date.now());
    return 0;
  }

  const pricing = await getCallPricingOnce();
  const price = getChatMessagePrice(pricing, messageType);
  if (price <= 0) {
    chargeExemptCache.set(exemptKey, Date.now());
    return 0;
  }

  const userRef = doc(firestore, 'users', user.uid);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');
    const stats = statsFromFirestoreDoc(snap.data() as Record<string, unknown>);
    if (stats.coins < price) {
      throw new Error(
        `رصيدك ${stats.coins.toLocaleString('en-US')} كوين — تحتاج ${price.toLocaleString('en-US')} كوين لإرسال هذه الرسالة`,
      );
    }
    tx.update(userRef, buildBalanceIncrementPatch('coins', -price));
  });

  const label =
    messageType === 'text' ? 'رسالة نصية'
      : messageType === 'voice' ? 'رسالة صوتية'
        : 'صورة';
  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'chat_message',
    messageType,
    amount: -price,
    currency: 'coins',
    toUid,
    itemName: label,
    status: 'completed',
    createdAt: Date.now(),
  });

  return price;
}

// ⚡ كاش فحص الحظر — القيمة «غير محظور» تصلح لثوانٍ؛ الحظر الفعلي تفرضه القواعد
const blockCheckCache = new Map<string, { blocked: boolean; at: number }>();
const BLOCK_CHECK_TTL_MS = 30 * 1000;

export async function isBlockedBetweenCached(uid: string, toUid: string): Promise<boolean> {
  const key = `${uid}_${toUid}`;
  const hit = blockCheckCache.get(key);
  if (hit && Date.now() - hit.at < BLOCK_CHECK_TTL_MS) return hit.blocked;
  const blocked = await isBlockedBetween(uid, toUid);
  blockCheckCache.set(key, { blocked, at: Date.now() });
  return blocked;
}

// طابور إرسال لكل محادثة — الإرسالات السريعة كانت تنطلق متوازية فتصل الخادم
// بترتيب عشوائي وتُخزَّن serverAt بترتيب الالتزام لا ترتيب الكتابة، فتظهر
// الرسائل مخربطة للطرفين (اختبار 1→20 وصل 11،14،16،19…). التسلسل يجعل
// ترتيب الالتزام مطابقاً لترتيب الإرسال، وفشل رسالة لا يكسر الطابور.
const conversationSendQueues = new Map<string, Promise<unknown>>();
function enqueueConversationSend<T>(
  conversationId: string,
  task: () => Promise<T>,
): Promise<T> {
  const prev = conversationSendQueues.get(conversationId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  conversationSendQueues.set(conversationId, next);
  return next;
}

// === Send message ===
export const sendChatMessage = (
  conversationId: string,
  toUid: string,
  text: string,
  replyTo?: ChatReplySnapshot,
): Promise<void> =>
  enqueueConversationSend(conversationId, () =>
    sendChatMessageNow(conversationId, toUid, text, replyTo),
  );

const sendChatMessageNow = async (
  conversationId: string,
  toUid: string,
  text: string,
  replyTo?: ChatReplySnapshot,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  // رقابة برمجية — منع الألفاظ المسيئة قبل أي خصم أو إرسال
  const { assertCleanText } = await import('@/utils/textModeration');
  assertCleanText(text);
  // منع الدعاية لتطبيقات منافسة (config/moderation.bannedTerms)
  const { assertNoBannedTerms } = await import('@/utils/moderation');
  assertNoBannedTerms(text);
  // ⚡ الفحصان مكاشان — بعد أول رسالة يصيران فوريين بلا رحلات شبكية
  // (الحظر قبل الرسوم حتى لا يُخصم من مرسل محظور)
  if (await isBlockedBetweenCached(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }
  await chargeForChatMessage(toUid, 'text');

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: user.uid,
    toUid,
    text,
    type: 'text',
    createdAt: Date.now(),
    // ساعة الخادم — الترتيب بساعة الجهاز كان يخلط الرسائل عند اختلاف ساعات الطرفين
    serverAt: serverTimestamp(),
    isRead: false,
    ...(replyTo ? { replyTo } : {}),
  });

  // تحديث ملخص المحادثة في الخلفية — لا يؤخّر ظهور الرسالة
  const now = Date.now();
  void updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: text,
    lastMessageAt: now,
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  }).catch(() => {});

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, text);

  void (async () => {
    try {
      const me = await getUser(user.uid);
      const { isHostessUser, markHostInteraction } = await import('./hostTasks');
      const { canEarnHostTasks } = await import('@/utils/genderAccess');
      if (canEarnHostTasks(me)) {
        await markHostInteraction();
      }
    } catch { /* non-blocking */ }
  })();

  void (async () => {
    try {
      const { trackRewardsMessageSent, hadIncomingReplyBeforeSend } = await import('./rewardsCenter');
      const recipient = await getUser(toUid);
      const isFemale = recipient?.gender === 'female';
      const hadReply = await hadIncomingReplyBeforeSend(conversationId, user.uid);
      await trackRewardsMessageSent(toUid, isFemale, hadReply);
      // عدّ «الرسائل الواردة» لمهام المضيفة يتم في السيرفر
      // (trigger: countHostTaskMessageOnCreate) — لا يعتمد على جهاز المرسل
    } catch { /* non-blocking */ }
  })();
};

/** إظهار المحادثة في قائمة الطرفين وتحديث آخر رسالة */
async function syncConversationListPreview(
  convId: string,
  myUid: string,
  otherUid: string,
  preview: string,
  lastMessageAt: number,
  incrementOtherUnread = false,
): Promise<void> {
  const patch: Record<string, unknown> = {
    lastMessage: preview,
    lastMessageAt,
    ...buildConversationUnhidePatchForBoth(myUid, otherUid),
    [`archivedBy.${myUid}`]: false,
    [`archivedBy.${otherUid}`]: false,
    [`unreadBy.${myUid}`]: 0,
  };
  if (incrementOtherUnread) {
    patch[`unreadBy.${otherUid}`] = increment(1);
  }
  await updateDoc(
    doc(firestore, 'conversations', convId),
    patch as Record<string, FieldValue | string | number | boolean>,
  );
}

/**
 * رسالة ترحيب تلقائية عند الإعجاب من الشاشة الرئيسية — مجانية وبدون خصم كوينز
 */
export async function sendLikeWelcomeChatMessage(
  toUid: string,
  otherName?: string,
  otherAvatar?: string,
  welcomeText?: string,
): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || user.uid === toUid) return null;
  if (await isBlockedBetween(user.uid, toUid)) return null;

  const text = (welcomeText ?? 'مرحبا هل يمكنك التحدث').trim();
  if (!text) return null;

  const convId = await getOrCreateConversation(
    toUid,
    otherName ?? '',
    otherAvatar ?? '',
  );

  const prior = await getDocs(
    query(
      collection(firestore, 'messages'),
      where('conversationId', '==', convId),
      where('fromUid', '==', user.uid),
      limit(1),
    ),
  );

  if (!prior.empty) {
    const existing = prior.docs[0]!.data() as ChatMessage;
    const preview = getChatMessagePreviewLabel(existing) || text;
    const at = existing.createdAt ?? Date.now();
    await syncConversationListPreview(convId, user.uid, toUid, preview, at, false);
    return convId;
  }

  const now = Date.now();
  const msgRef = doc(collection(firestore, 'messages'));
  const batch = writeBatch(firestore);
  batch.set(msgRef, {
    conversationId: convId,
    fromUid: user.uid,
    toUid,
    text,
    type: 'text',
    createdAt: now,
    serverAt: serverTimestamp(),
    isRead: false,
  });
  batch.update(doc(firestore, 'conversations', convId), {
    lastMessage: text,
    lastMessageAt: now,
    [`unreadBy.${toUid}`]: increment(1),
    [`unreadBy.${user.uid}`]: 0,
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
    [`archivedBy.${user.uid}`]: false,
    [`archivedBy.${toUid}`]: false,
  });
  await batch.commit();

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, convId, text);
  return convId;
}

export { sendGiftChatMessage } from './chatGifts';
export type { ChatGiftPayload } from './chatGifts';

/**
 * إرسال رسالة صورة
 * - يرفع الصورة إلى Storage ثم يخزّن رابطها
 */
export const sendImageMessage = (
  conversationId: string,
  toUid: string,
  localUri: string,
  dimensions?: { width: number; height: number },
): Promise<void> =>
  enqueueConversationSend(conversationId, () =>
    sendImageMessageNow(conversationId, toUid, localUri, dimensions),
  );

const sendImageMessageNow = async (
  conversationId: string,
  toUid: string,
  localUri: string,
  dimensions?: { width: number; height: number },
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  if (await isBlockedBetween(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }

  await chargeForChatMessage(toUid, 'image');

  const { storage } = await import('./index');
  const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');

  // ضغط الصورة قبل الرفع (تصغير بالعرض + JPEG) لتسريع الإرسال. أي فشل يُعيد الأصل.
  const { compressImageForUpload, COMPRESS_PRESETS } = await import('@/utils/imageCompress');
  const { uriToUploadBlob, assertUploadSize } = await import('@/utils/mediaUpload');
  const uploadUri = await compressImageForUpload(localUri, COMPRESS_PRESETS.chat);

  const blob = await uriToUploadBlob(uploadUri, 'image/jpeg');
  assertUploadSize(blob);

  const ext = 'jpg';
  const path = `chat_images/${conversationId}/${user.uid}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: blob.type || `image/${ext}` });
  const imageUrl = await getDownloadURL(fileRef);

  const msgData: any = {
    conversationId,
    fromUid: user.uid,
    toUid,
    text: '',
    type: 'image',
    imageUrl,
    createdAt: Date.now(),
    serverAt: serverTimestamp(),
    isRead: false,
  };
  if (dimensions) {
    msgData.imageWidth = dimensions.width;
    msgData.imageHeight = dimensions.height;
  }

  await addDoc(collection(firestore, 'messages'), msgData);

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: 'صورة',
    lastMessageAt: Date.now(),
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, '📷 صورة');
  // عدّ مهام المضيفة يتم في السيرفر (countHostTaskMessageOnCreate)
};

/**
 * إرسال رسالة صوتية
 * - يرفع التسجيل إلى Storage ثم يخزّن رابطه + المدّة
 */
export const sendVoiceMessage = (
  conversationId: string,
  toUid: string,
  localUri: string,
  durationSeconds: number,
): Promise<void> =>
  enqueueConversationSend(conversationId, () =>
    sendVoiceMessageNow(conversationId, toUid, localUri, durationSeconds),
  );

const sendVoiceMessageNow = async (
  conversationId: string,
  toUid: string,
  localUri: string,
  durationSeconds: number,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  if (await isBlockedBetween(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }

  await chargeForChatMessage(toUid, 'voice');

  const { storage } = await import('./index');
  const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');

  const response = await fetch(localUri);
  const blob = await response.blob();

  // حد أقصى 10MB (~ عدة دقائق)
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('التسجيل طويل جداً');
  }

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'm4a';
  const path = `chat_voices/${conversationId}/${user.uid}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: blob.type || 'audio/m4a' });
  const voiceUrl = await getDownloadURL(fileRef);

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: user.uid,
    toUid,
    text: '',
    type: 'voice',
    voiceUrl,
    voiceDuration: Math.round(durationSeconds),
    createdAt: Date.now(),
    serverAt: serverTimestamp(),
    isRead: false,
  });

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: 'رسالة صوتية',
    lastMessageAt: Date.now(),
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, '🎤 رسالة صوتية');
  // عدّ مهام المضيفة يتم في السيرفر (countHostTaskMessageOnCreate)
};

const MAX_CHAT_FILE_BYTES = 15 * 1024 * 1024;

/**
 * إرسال ملف (PDF، مستند، إلخ) — للدعم والشات
 */
export const sendFileMessage = (
  conversationId: string,
  toUid: string,
  localUri: string,
  fileName: string,
  mimeType?: string,
): Promise<void> =>
  enqueueConversationSend(conversationId, () =>
    sendFileMessageNow(conversationId, toUid, localUri, fileName, mimeType),
  );

const sendFileMessageNow = async (
  conversationId: string,
  toUid: string,
  localUri: string,
  fileName: string,
  mimeType?: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  if (await isBlockedBetween(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }

  const { storage } = await import('./index');
  const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');

  const response = await fetch(localUri);
  const blob = await response.blob();
  if (blob.size > MAX_CHAT_FILE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const safeName = fileName.replace(/[^\w.\-أ-ي\s]/g, '_').slice(0, 80) || 'file';
  const ext = safeName.includes('.') ? safeName.split('.').pop() : 'bin';
  const path = `chat_files/${conversationId}/${user.uid}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, {
    contentType: mimeType || blob.type || 'application/octet-stream',
  });
  const fileUrl = await getDownloadURL(fileRef);

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: user.uid,
    toUid,
    text: safeName,
    type: 'file',
    fileUrl,
    fileName: safeName,
    fileMime: mimeType || blob.type,
    fileSize: blob.size,
    createdAt: Date.now(),
    serverAt: serverTimestamp(),
    isRead: false,
  });

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: `📎 ${safeName}`,
    lastMessageAt: Date.now(),
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, `📎 ${safeName}`);
};

/**
 * تصفير عدّاد الرسائل غير المقروءة لي في هذه المحادثة
 * يُستدعى عند فتح المحادثة وعرضها
 */
export const markConversationAsRead = async (
  conversationId: string,
  otherUid?: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  const now = Date.now();
  try {
    await updateDoc(doc(firestore, 'conversations', conversationId), {
      [`unreadBy.${user.uid}`]: 0,
      [`lastReadAt.${user.uid}`]: now,
    });

    const q = query(
      collection(firestore, 'messages'),
      where('conversationId', '==', conversationId),
      where('toUid', '==', user.uid),
      limit(100),
    );
    const snap = await getDocs(q);
    const batch = writeBatch(firestore);
    let pending = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.isRead === true || data.deleted === true) return;
      batch.update(d.ref, { isRead: true, readAt: now });
      pending += 1;
    });
    if (pending > 0) await batch.commit();

    let peerUid = otherUid?.trim() || '';
    if (!peerUid) {
      const convSnap = await getDoc(doc(firestore, 'conversations', conversationId));
      const participants = convSnap.data()?.participants as string[] | undefined;
      peerUid = participants?.find((p) => p !== user.uid) ?? '';
    }
    if (peerUid) {
      const { dismissChatMessageNotifications } = await import('./notifications');
      void dismissChatMessageNotifications({ fromUid: peerUid, conversationId });
    }
  } catch (e) {
    console.warn('markConversationAsRead:', e);
  }
};

/**
 * تثبيت/إلغاء تثبيت محادثة (للأولوية في القائمة)
 */
export const togglePinConversation = async (
  conversationId: string,
  pinned: boolean,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  await updateDoc(doc(firestore, 'conversations', conversationId), {
    [`pinnedBy.${user.uid}`]: pinned,
  });
};

/** أرشفة / إلغاء أرشفة محادثة (لك فقط) */
export const archiveConversation = async (
  conversationId: string,
  archived: boolean,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  await updateDoc(doc(firestore, 'conversations', conversationId), {
    [`archivedBy.${user.uid}`]: archived,
  });
};

/** حذف المحادثة من قائمتك (soft delete)
 *  «حذف الدردشة» يخفي أيضاً كل الرسائل الحالية لي (نفس آلية المسح الشامل) —
 *  بدونها كانت المحادثة تعود من الخارج بمعاينة آخر رسالة وسجلّها كاملاً من الداخل */
export const hideConversationForUser = async (conversationId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const convSnap = await getDoc(doc(firestore, 'conversations', conversationId));
  const participants = convSnap.data()?.participants as string[] | undefined;
  const peerUid = participants?.find((p) => p !== user.uid) ?? '';

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    [`hiddenBy.${user.uid}`]: true,
    [`deletedAtBy.${user.uid}`]: Date.now(),
    [`pinnedBy.${user.uid}`]: false,
    // تصفير عدّاد غير المقروء — الرسائل المحذوفة كانت تُبقي نقطة حمراء وهمية
    [`unreadBy.${user.uid}`]: 0,
  });

  // إخفاء رسائل المحادثة لي فقط (حقول per-user — نسخة الطرف الآخر لا تُمسّ)
  // في الخلفية حتى لا يتأخر اختفاء المحادثة من القائمة
  void (async () => {
    try {
      const msgSnap = await getDocs(
        query(
          collection(firestore, 'messages'),
          where('conversationId', '==', conversationId),
          limit(500),
        ),
      );
      let batch = writeBatch(firestore);
      let batchCount = 0;
      for (const msgDoc of msgSnap.docs) {
        const m = msgDoc.data() as ChatMessage;
        if (m.deleted || m.hiddenFor?.[user.uid]) continue;
        batch.update(msgDoc.ref, { [`hiddenFor.${user.uid}`]: true });
        batchCount += 1;
        if (batchCount >= 450) {
          await batch.commit();
          batch = writeBatch(firestore);
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();
    } catch (e) {
      console.warn('hideConversationForUser messages:', e);
    }
  })();

  if (peerUid) {
    const { dismissChatMessageNotifications } = await import('./notifications');
    void dismissChatMessageNotifications({ fromUid: peerUid, conversationId });
  }
};

/** 0 = مسح الكل (بما فيها رسائل اليوم) */
export type QuickClearDays = 0 | 4 | 14 | 21 | 90;

function isImportantChatMessage(m: ChatMessage): boolean {
  if (m.type === 'gift') return true;
  if (m.isLocked) return true;
  if (m.type === 'image' || m.type === 'video' || m.type === 'voice' || m.type === 'file') {
    return true;
  }
  return false;
}

/** مسح سريع — إخفاء الرسائل القديمة غير الهامة للمستخدم الحالي.
 *  olderThanDays = 0 ⇒ مسح شامل لكل الرسائل (حتى الهامة والحديثة). */
export async function quickClearOldChatMessages(olderThanDays: QuickClearDays): Promise<number> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const clearAll = olderThanDays === 0;
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const convSnap = await getDocs(
    query(collection(firestore, 'conversations'), where('participants', 'array-contains', user.uid)),
  );

  let cleared = 0;
  let batch = writeBatch(firestore);
  let batchCount = 0;

  const flush = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    batch = writeBatch(firestore);
    batchCount = 0;
  };

  // نقرأ رسائل كل المحادثات بالتوازي بدل انتظار كل واحدة على حدة (كان N ذهاب/إياب متتالية)
  const perConv = await Promise.all(
    convSnap.docs.map(async (convDoc) => ({
      convDoc,
      msgSnap: await getDocs(
        query(collection(firestore, 'messages'), where('conversationId', '==', convDoc.id), limit(500)),
      ),
    })),
  );

  for (const { convDoc, msgSnap } of perConv) {
    let clearedHere = 0;
    let visibleLeft = 0;
    for (const msgDoc of msgSnap.docs) {
      const m = { id: msgDoc.id, ...msgDoc.data() } as ChatMessage;
      if (m.deleted) continue;
      if (m.hiddenFor?.[user.uid]) continue;
      if (
        (!clearAll && (m.createdAt ?? 0) >= cutoff) ||
        (!clearAll && isImportantChatMessage(m))
      ) {
        visibleLeft += 1;
        continue;
      }

      batch.update(msgDoc.ref, { [`hiddenFor.${user.uid}`]: true });
      batchCount += 1;
      cleared += 1;
      clearedHere += 1;

      if (batchCount >= 450) await flush();
    }

    if (clearedHere > 0) {
      // تحديث قائمتي أنا فقط (حقول per-user) — نسخة الطرف الآخر لا تُمسّ:
      // • تصفير عدّاد غير المقروء (الرسائل المخفية كانت تُبقي نقطة حمراء وهمية)
      // • إن لم تبقَ أي رسالة ظاهرة لي: إخفاء المحادثة من قائمتي بالكامل
      //   (كان الاسم + معاينة آخر رسالة يظلان ظاهرين من الخارج بعد المسح الشامل)
      const convPatch: Record<string, unknown> = {
        [`unreadBy.${user.uid}`]: 0,
      };
      if (visibleLeft === 0) {
        convPatch[`hiddenBy.${user.uid}`] = true;
        convPatch[`deletedAtBy.${user.uid}`] = Date.now();
        convPatch[`pinnedBy.${user.uid}`] = false;
      }
      batch.update(convDoc.ref, convPatch as Record<string, FieldValue | string | number | boolean>);
      batchCount += 1;
      if (batchCount >= 450) await flush();
    }
  }

  await flush();
  return cleared;
}

/** حذف رسالة — forEveryone=true يحذف للجميع (المرسل فقط) */
export const deleteChatMessage = async (
  messageId: string,
  options: { forEveryone?: boolean } = {},
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const msgRef = doc(firestore, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (options.forEveryone) {
    if (data.fromUid !== user.uid) throw new Error('NOT_AUTHORIZED');
    await deleteDoc(msgRef);
    return;
  }

  await updateDoc(msgRef, {
    [`hiddenFor.${user.uid}`]: true,
  });
};

// === Subscribe to messages ===
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
): (() => void) => {
  // بمجرد تسليم قائمة غير فارغة، لا نمحوها بخطأ عابر أو وميض مصادقة (كانت الرسائل
  // تختفي ثم تعود عند إعادة الاشتراك)
  let deliveredNonEmpty = false;

  const handleSnapshot = (snap: QuerySnapshot<DocumentData>) => {
    // نقرأ المستخدم لحظة كل snapshot — قراءته مرة عند الاشتراك كانت null في
    // سباق الإقلاع فتتعطّل فلترة «حُذفت لي» (hiddenFor) وتعود الرسائل المحذوفة
    const user = auth.currentUser;
    const msgs = snap.docs
      .map((d) => {
        // ترتيب بساعة الخادم — ساعة جهاز المرسل قد تكون منحرفة فتختلط الرسائل
        const data = d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
        const serverAt = data.serverAt as { toMillis?: () => number } | undefined;
        const sortAt =
          typeof serverAt?.toMillis === 'function'
            ? serverAt.toMillis()
            : Number(data.createdAt ?? 0);
        return { id: d.id, ...data, sortAt } as ChatMessage & { sortAt: number };
      })
      .filter((m) => {
        if (m.deleted) return false;
        if (user && m.hiddenFor?.[user.uid]) return false;
        return true;
      });
    // كسر التعادل بساعة العميل — رسالتان بنفس مللي ثانية الخادم تحفظان ترتيب كتابتهما
    msgs.sort(
      (a, b) =>
        (a.sortAt || a.createdAt || 0) - (b.sortAt || b.createdAt || 0) ||
        (a.createdAt || 0) - (b.createdAt || 0),
    );
    // فور تسليم قائمة غير فارغة نرفع العلم كي لا نمحوها لاحقاً بخطأ عابر
    if (msgs.length > 0) deliveredNonEmpty = true;
    callback(msgs);
  };

  // ⚡ أحدث 100 رسالة بترتيب الخادم — الاستعلام القديم بلا orderBy كان يجلب
  // «أول 200 مستند حسب معرّف الوثيقة» فيثقل المحادثات الطويلة على الشبكة
  // وقد يُسقط الرسائل الأحدث كلياً عند تجاوز 200 رسالة.
  // الفهرس المركّب (conversationId + createdAt DESC) موجود في firestore.indexes.json؛
  // وعند غيابه من المشروع المنشور نرجع تلقائياً للاستعلام القديم بدل كسر الشات.
  let disposed = false;
  let unsub: () => void = () => {};

  const attach = (ordered: boolean) => {
    const q = ordered
      ? query(
          collection(firestore, 'messages'),
          where('conversationId', '==', conversationId),
          orderBy('createdAt', 'desc'),
          limit(100),
        )
      : query(
          collection(firestore, 'messages'),
          where('conversationId', '==', conversationId),
          limit(200),
        );
    unsub = onSnapshot(
      q,
      handleSnapshot,
      (err) => {
        if (ordered && !disposed) {
          // غالباً فهرس غير منشور (failed-precondition) — fallback شفاف
          console.warn('subscribeToMessages (ordered) fallback:', err?.message ?? err);
          attach(false);
          return;
        }
        console.error('subscribeToMessages:', err);
        // لا نمحو قائمة معبّأة بخطأ عابر — نُبقي آخر قائمة جيدة، ونسمح فقط
        // بقائمة فارغة عند التحميل الأول (قبل تسليم أي رسائل)
        if (!deliveredNonEmpty) callback([]);
      },
    );
  };

  // نفس إصلاح سباق الإقلاع في subscribeToConversations: الاشتراك قبل اكتمال
  // استعادة الجلسة كان يفشل بـ permission-denied فتبقى الشاشة فارغة حتى إعادة الفتح
  let attachedUid: string | null = null;
  const authUnsub = subscribeWhenAuthenticated(
    (user) => {
      if (disposed || attachedUid === user.uid) return;
      unsub();
      attachedUid = user.uid;
      attach(true);
    },
    () => {
      if (disposed) return;
      unsub();
      unsub = () => {};
      attachedUid = null;
      // وميض مصادقة عابر — لا نمحو قائمة معبّأة، نُبقي آخر قائمة جيدة
      if (!deliveredNonEmpty) callback([]);
    },
  );

  return () => {
    disposed = true;
    authUnsub();
    unsub();
  };
};

// === Seed demo conversations ===
export const seedDemoConversations = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  // Check if any conversation exists
  const q = query(
    collection(firestore, 'conversations'),
    where('participants', 'array-contains', user.uid),
    limit(1),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const demos = [
    {
      uid: 'demo_msg_user_1',
      name: 'مريم العتيبي',
      avatar: 'https://i.pravatar.cc/100?img=47',
      lastMsg: 'كيف حالك اليوم؟',
      offset: 1000 * 60 * 3,
      unread: 2,
    },
    {
      uid: 'demo_msg_user_2',
      name: 'محمد العتيبي',
      avatar: 'https://i.pravatar.cc/100?img=15',
      lastMsg: 'شكراً على الهدية الجميلة',
      offset: 1000 * 60 * 30,
      unread: 0,
    },
    {
      uid: 'demo_msg_user_3',
      name: 'سارة أحمد',
      avatar: 'https://i.pravatar.cc/100?img=44',
      lastMsg: 'متى موعدنا التالي في الغرفة؟',
      offset: 1000 * 60 * 60 * 2,
      unread: 1,
    },
    {
      uid: 'demo_msg_user_4',
      name: 'يوسف الفهد',
      avatar: 'https://i.pravatar.cc/100?img=33',
      lastMsg: 'تم! سأكون هناك',
      offset: 1000 * 60 * 60 * 5,
      unread: 0,
    },
    {
      uid: 'demo_msg_user_5',
      name: 'ليلى المغربية',
      avatar: 'https://i.pravatar.cc/100?img=45',
      lastMsg: 'صورة',
      offset: 1000 * 60 * 60 * 24,
      unread: 0,
    },
  ];

  for (const d of demos) {
    const sortedUids = [user.uid, d.uid].sort();
    const convId = `${sortedUids[0]}_${sortedUids[1]}`;
    await setDoc(doc(firestore, 'conversations', convId), {
      participants: sortedUids,
      participantNames: {
        [user.uid]: user.displayName ?? 'مستخدم',
        [d.uid]: d.name,
      },
      participantAvatars: {
        [user.uid]: user.photoURL ?? '',
        [d.uid]: d.avatar,
      },
      lastMessage: d.lastMsg,
      lastMessageAt: Date.now() - d.offset,
      unreadBy: { [user.uid]: d.unread, [d.uid]: 0 },
    });
  }
};
