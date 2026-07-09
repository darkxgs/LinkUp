/**
 * LinkUp App — Notifications Service (Firestore)
 */

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, auth, functions } from './index';
import { subscribeWhenAuthenticated } from './authReady';

export type NotificationType =
  | 'follow'
  | 'gift'
  | 'like'
  | 'comment'
  | 'mention'
  | 'message'
  | 'visit'
  | 'system'
  | 'room_invite'
  | 'game_challenge'
  | 'moderation'
  | 'post';

export type ModerationScenario =
  | 'account_warning'
  | 'account_banned'
  | 'account_unbanned'
  | 'withdrawal_blocked'
  | 'withdrawal_unblocked'
  | 'verification_required'
  | 'content_removed'
  | 'custom';

export interface Notification {
  id: string;
  uid: string;
  type: NotificationType;
  fromUid?: string;
  fromName?: string;
  fromAvatar?: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: number;
}

export function isBroadcastNotification(notif: Notification): boolean {
  return !!notif.data?.broadcastId;
}

/** عنوان ونص منفصلان لإشعارات الإدارة والبث الجماعي */
export function parseNotificationDisplay(notif: Notification): {
  title: string;
  body: string;
} {
  const data = notif.data ?? {};
  if (typeof data.title === 'string' && data.title.length > 0) {
    const bodyText =
      typeof data.body === 'string' && data.body.length > 0
        ? data.body
        : notif.message.includes('\n')
          ? notif.message.split('\n').slice(1).join('\n')
          : '';
    return { title: data.title, body: bodyText };
  }
  const lines = notif.message.split('\n').filter(Boolean);
  if (lines.length >= 2) {
    return { title: lines[0] ?? '', body: lines.slice(1).join('\n') };
  }
  return { title: notif.message, body: '' };
}

export type CreateNotificationInput = {
  uid: string;
  type: NotificationType;
  message: string;
  fromUid?: string;
  fromName?: string;
  fromAvatar?: string;
  data?: Record<string, any>;
  isRead?: boolean;
  createdAt?: number;
};

/** Firestore يرفض الحقول ذات القيمة undefined */
function toFirestorePayload<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** إنشاء إشعار — يُستبعد تلقائياً أي حقل undefined */
export const createNotification = async (
  input: CreateNotificationInput,
): Promise<string> => {
  if (
    input.fromUid &&
    input.fromUid === input.uid &&
    (input.type === 'gift' || input.type === 'like' || input.type === 'comment' || input.type === 'mention')
  ) {
    return '';
  }

  const ref = await addDoc(
    collection(firestore, 'notifications'),
    toFirestorePayload({
      uid: input.uid,
      type: input.type,
      message: input.message,
      fromUid: input.fromUid,
      fromName: input.fromName,
      fromAvatar: input.fromAvatar,
      data: input.data ?? {},
      isRead: input.isRead ?? false,
      createdAt: input.createdAt ?? Date.now(),
    }),
  );
  return ref.id;
};

// === Get notifications ===
export const getNotifications = async (): Promise<Notification[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('uid', '==', user.uid),
      limit(100),
    );
    const snap = await getDocs(q);
    const notifs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Notification);
    const filtered = filterVisibleNotifications(notifs, user.uid);
    filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return filtered.slice(0, 50);
  } catch (e) {
    console.error('getNotifications:', e);
    return [];
  }
};

const BROADCAST_MAX_AGE_MS = 7 * 86400000;

/** آخر إشعار جماعي غير مقروء — يظهر في BroadcastBanner */
export const subscribeToUnreadBroadcast = (
  callback: (notif: Notification | null) => void,
): (() => void) => {
  // نفس إصلاح سباق الإقلاع في subscribeToNotifications — الربط عند جاهزية الجلسة
  let fsUnsub: (() => void) | null = null;
  let attachedUid: string | null = null;
  let disposed = false;

  const authUnsub = subscribeWhenAuthenticated(
    (user) => {
      if (disposed || attachedUid === user.uid) return;
      fsUnsub?.();
      attachedUid = user.uid;
      const q = query(
        collection(firestore, 'notifications'),
        where('uid', '==', user.uid),
        limit(80),
      );
      fsUnsub = onSnapshot(
        q,
        (snap) => {
          const now = Date.now();
          const latest = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Notification)
            .filter(
              (n) =>
                !n.isRead &&
                isBroadcastNotification(n) &&
                now - (n.createdAt ?? 0) <= BROADCAST_MAX_AGE_MS,
            )
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
          callback(latest ?? null);
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

/** تحديث مباشر لإشعارات المستخدم */
/** إشعار نشاط ذاتي (مثل هدية أرسلها المستخدم لنفسه) — لا يُعرض */
export function isSelfActivityNotification(
  notif: Notification,
  currentUid?: string | null,
): boolean {
  if (!currentUid || !notif.fromUid) return false;
  if (notif.fromUid !== currentUid || notif.uid !== currentUid) return false;
  return notif.type === 'gift' || notif.type === 'like' || notif.type === 'comment' || notif.type === 'mention';
}

/** إشعار زيارة ملف — لا يُعرض (الزوار في صفحة الزوار فقط) */
export function isVisitorNotification(notif: Notification): boolean {
  if (notif.type === 'visit') return true;
  return notif.data?.type === 'visit';
}

function filterVisibleNotifications(
  notifs: Notification[],
  currentUid?: string | null,
): Notification[] {
  return notifs.filter(
    (n) => !isSelfActivityNotification(n, currentUid) && !isVisitorNotification(n),
  );
}

export const subscribeToNotifications = (
  callback: (items: Notification[]) => void,
): (() => void) => {
  // لا نقرأ auth.currentUser لحظة الاستدعاء — عند فتح التطبيق يُركَّب المستمع
  // قبل اكتمال استعادة الجلسة فيكون null ولا يُربط أي مستمع حقيقي (سباق الإقلاع).
  // نرتبط عند جاهزية الجلسة ونعيد الربط عند تبدّل المستخدم.
  let fsUnsub: (() => void) | null = null;
  let attachedUid: string | null = null;
  let disposed = false;

  const authUnsub = subscribeWhenAuthenticated(
    (user) => {
      if (disposed || attachedUid === user.uid) return;
      fsUnsub?.();
      attachedUid = user.uid;
      const q = query(
        collection(firestore, 'notifications'),
        where('uid', '==', user.uid),
        limit(100),
      );
      fsUnsub = onSnapshot(
        q,
        (snap) => {
          const notifs = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Notification);
          const filtered = filterVisibleNotifications(notifs, user.uid);
          filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          callback(filtered.slice(0, 50));
        },
        () => callback([]),
      );
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

/** تسجيل مشاهدة بث جماعي (مرة واحدة لكل مستخدم على السيرفر) */
export const recordBroadcastView = async (broadcastId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !broadcastId?.trim()) return;
  try {
    const fn = httpsCallable<{ broadcastId: string }, { ok?: boolean }>(
      functions,
      'recordBroadcastView',
    );
    await fn({ broadcastId: broadcastId.trim() });
  } catch (e) {
    console.warn('recordBroadcastView:', e);
  }
};

// === Mark as read ===
export const markAsRead = async (
  notifId: string,
  opts?: { broadcastId?: string },
): Promise<void> => {
  try {
    let broadcastId = opts?.broadcastId;
    if (!broadcastId) {
      const snap = await getDoc(doc(firestore, 'notifications', notifId));
      broadcastId = snap.data()?.data?.broadcastId as string | undefined;
    }
    await updateDoc(doc(firestore, 'notifications', notifId), { isRead: true });
    if (broadcastId) {
      await recordBroadcastView(broadcastId);
    }
  } catch (e) {
    console.error('markAsRead:', e);
  }
};

export const markAllAsRead = async (
  items: { id: string; data?: Record<string, unknown> }[],
): Promise<void> => {
  if (!items.length) return;
  try {
    const batch = writeBatch(firestore);
    const broadcastIds = new Set<string>();
    for (const item of items) {
      batch.update(doc(firestore, 'notifications', item.id), { isRead: true });
      const bid = item.data?.broadcastId;
      if (typeof bid === 'string' && bid.length > 0) broadcastIds.add(bid);
    }
    await batch.commit();
    await Promise.all(
      [...broadcastIds].map((id) => recordBroadcastView(id)),
    );
  } catch (e) {
    console.error('markAllAsRead:', e);
  }
};

/** إزالة إشعارات رسائل شات — بعد قراءة المحادثة أو حذفها */
export async function dismissChatMessageNotifications(opts: {
  fromUid?: string;
  conversationId?: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  if (!opts.fromUid?.trim() && !opts.conversationId?.trim()) return;

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('uid', '==', user.uid),
      where('type', '==', 'message'),
      limit(100),
    );
    const snap = await getDocs(q);
    const toRemove = snap.docs.filter((d) => {
      const data = d.data();
      if (opts.fromUid?.trim() && data.fromUid !== opts.fromUid.trim()) return false;
      if (opts.conversationId?.trim()) {
        const cid = (data.data as Record<string, unknown> | undefined)?.conversationId;
        if (typeof cid === 'string' && cid.length > 0 && cid !== opts.conversationId.trim()) {
          return false;
        }
      }
      return true;
    });
    if (!toRemove.length) return;

    const batch = writeBatch(firestore);
    toRemove.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.warn('dismissChatMessageNotifications:', e);
  }
}

/** إزالة إشعارات رسائل محادثات مقروءة أو محذوفة (تنظيف قديم) */
export async function syncMessageNotificationsWithInbox(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('uid', '==', user.uid),
      where('type', '==', 'message'),
      limit(100),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const byFrom = new Map<string, string | undefined>();
    snap.docs.forEach((d) => {
      const data = d.data();
      const fromUid = data.fromUid as string | undefined;
      if (!fromUid || fromUid === user.uid) return;
      const cid = (data.data as Record<string, unknown> | undefined)?.conversationId;
      if (!byFrom.has(fromUid)) {
        byFrom.set(fromUid, typeof cid === 'string' ? cid : undefined);
      }
    });

    for (const [fromUid, conversationId] of byFrom) {
      const sortedUids = [user.uid, fromUid].sort();
      const convId = conversationId || `${sortedUids[0]}_${sortedUids[1]}`;
      const convSnap = await getDoc(doc(firestore, 'conversations', convId));
      if (!convSnap.exists()) {
        await dismissChatMessageNotifications({ fromUid, conversationId: convId });
        continue;
      }
      const conv = convSnap.data()!;
      const unread = Number(conv.unreadBy?.[user.uid] ?? 0);
      const hidden = conv.hiddenBy?.[user.uid] === true;
      if (unread <= 0 || hidden) {
        await dismissChatMessageNotifications({ fromUid, conversationId: convId });
      }
    }
  } catch (e) {
    console.warn('syncMessageNotificationsWithInbox:', e);
  }
}

// === Seed demo notifications (أول مرة فقط) ===
export const seedDemoNotifications = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  const checkQ = query(
    collection(firestore, 'notifications'),
    where('uid', '==', user.uid),
    limit(1),
  );
  const checkSnap = await getDocs(checkQ);
  if (!checkSnap.empty) return;

  const demos: CreateNotificationInput[] = [
    {
      uid: user.uid,
      type: 'follow',
      fromName: 'مريم العتيبي',
      fromAvatar: 'https://i.pravatar.cc/100?img=47',
      message: 'بدأت متابعتك',
      isRead: false,
      createdAt: Date.now() - 1000 * 60 * 5,
    },
    {
      uid: user.uid,
      type: 'gift',
      fromName: 'محمد العتيبي',
      fromAvatar: 'https://i.pravatar.cc/100?img=15',
      message: 'أرسل لك تاج (1000 عملة)',
      data: { giftId: 'crown', giftValue: 1000 },
      isRead: false,
      createdAt: Date.now() - 1000 * 60 * 30,
    },
    {
      uid: user.uid,
      type: 'like',
      fromName: 'سارة أحمد',
      fromAvatar: 'https://i.pravatar.cc/100?img=44',
      message: 'أعجبت بمنشورك',
      isRead: false,
      createdAt: Date.now() - 1000 * 60 * 60 * 2,
    },
    {
      uid: user.uid,
      type: 'visit',
      fromName: 'يوسف الفهد',
      fromAvatar: 'https://i.pravatar.cc/100?img=33',
      message: 'زار ملفك الشخصي',
      isRead: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 4,
    },
    {
      uid: user.uid,
      type: 'room_invite',
      fromName: 'ليلى المغربية',
      fromAvatar: 'https://i.pravatar.cc/100?img=45',
      message: 'دعتك للانضمام إلى غرفتها "موسيقى عربية"',
      isRead: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 8,
    },
    {
      uid: user.uid,
      type: 'comment',
      fromName: 'علي القحطاني',
      fromAvatar: 'https://i.pravatar.cc/100?img=8',
      message: 'علّق على منشورك: "رائع!"',
      isRead: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 12,
    },
    {
      uid: user.uid,
      type: 'system',
      message: 'تم تفعيل حساب VIP الخاص بك بنجاح',
      isRead: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
    },
    {
      uid: user.uid,
      type: 'mention',
      fromName: 'فاطمة الزهراء',
      fromAvatar: 'https://i.pravatar.cc/100?img=16',
      message: 'أشارت إليك في تعليق',
      isRead: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 36,
    },
  ];

  for (const d of demos) {
    await createNotification(d);
  }
};
