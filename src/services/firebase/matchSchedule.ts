/**
 * LinkUp App — جدولة المطابقة
 * المستخدم يحجز وقتاً مستقبلياً لمطابقة صوت/فيديو، ويصله تذكير محلي في وقته.
 */
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, limit,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { firestore, auth } from './index';

export type MatchType = 'voice' | 'video';

export interface MatchSchedule {
  id: string;
  uid: string;
  type: MatchType;
  ageRanges: string[];
  scheduledAt: number;
  status: 'scheduled' | 'done' | 'cancelled';
  notificationId?: string;
  createdAt: number;
}

/** نافذة اعتبار الجدولة "جاهزة الآن" (من وقتها حتى 30 دقيقة بعده) */
export const DUE_WINDOW_MS = 30 * 60 * 1000;

async function ensureNotifPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

/** ينشئ جدولة + يبرمج تذكيراً محلياً في وقتها */
export const createMatchSchedule = async (input: {
  type: MatchType;
  ageRanges: string[];
  scheduledAt: number;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (input.scheduledAt <= Date.now() + 60 * 1000) {
    throw new Error('اختر وقتاً في المستقبل');
  }

  // برمج التذكير المحلي (إن سُمح به)
  let notificationId: string | undefined;
  if (await ensureNotifPermission()) {
    try {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'حان وقت المطابقة 🎯',
          body: `مطابقة ${input.type === 'video' ? 'فيديو' : 'صوت'} مجدولة — افتح التطبيق وابدأ الآن`,
          data: { kind: 'match_schedule', matchType: input.type },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(input.scheduledAt) } as any,
      });
    } catch {
      // التذكير غير حرج — الجدولة تبقى محفوظة
    }
  }

  const ref = await addDoc(collection(firestore, 'matchSchedules'), {
    uid: user.uid,
    type: input.type,
    ageRanges: input.ageRanges ?? [],
    scheduledAt: input.scheduledAt,
    status: 'scheduled',
    ...(notificationId ? { notificationId } : {}),
    createdAt: Date.now(),
  });
  return ref.id;
};

/** جدولاتي القادمة/الجاهزة (status=scheduled) */
export const subscribeToMySchedules = (
  cb: (items: MatchSchedule[]) => void,
): (() => void) => {
  const uid = auth.currentUser?.uid;
  if (!uid) { cb([]); return () => {}; }
  const q = query(
    collection(firestore, 'matchSchedules'),
    where('uid', '==', uid),
    where('status', '==', 'scheduled'),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const cutoff = Date.now() - DUE_WINDOW_MS; // أخفِ المنتهية القديمة
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as MatchSchedule)
        .filter((s) => s.scheduledAt >= cutoff)
        .sort((a, b) => a.scheduledAt - b.scheduledAt);
      cb(items);
    },
    () => cb([]),
  );
};

/** هل الجدولة جاهزة الآن (حان وقتها خلال نافذة DUE)؟ */
export const isDue = (s: MatchSchedule): boolean => {
  const now = Date.now();
  return s.scheduledAt <= now && now - s.scheduledAt <= DUE_WINDOW_MS;
};

export const cancelMatchSchedule = async (s: MatchSchedule): Promise<void> => {
  if (s.notificationId) {
    try { await Notifications.cancelScheduledNotificationAsync(s.notificationId); } catch {}
  }
  await deleteDoc(doc(firestore, 'matchSchedules', s.id)).catch(() => {});
};

export const markScheduleDone = async (s: MatchSchedule): Promise<void> => {
  if (s.notificationId) {
    try { await Notifications.cancelScheduledNotificationAsync(s.notificationId); } catch {}
  }
  await updateDoc(doc(firestore, 'matchSchedules', s.id), { status: 'done' }).catch(() => {});
};
