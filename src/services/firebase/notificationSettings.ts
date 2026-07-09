/**
 * إعدادات إشعارات المستخدم — تُحفظ في users/{uid}.notificationSettings
 */

import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';

export type NotifAudience = 'everyone' | 'followers' | 'friends' | 'none';
export type QuickNotifFilter = 'all' | 'followers' | 'friends' | 'none';

export interface NotificationSettings {
  /** إشعارات الدفع (FCM) عند إغلاق التطبيق */
  pushEnabled: boolean;
  enabled: boolean;
  messages: boolean;
  calls: boolean;
  gifts: boolean;
  visitors: boolean;
  promotions: boolean;
  social: boolean;
  quickFilter: QuickNotifFilter;
  followNotif: NotifAudience;
  privateMessage: boolean;
  privateMessageOutside: boolean;
  roomJoin: NotifAudience;
  likeNotif: NotifAudience;
  commentNotif: NotifAudience;
  mentionNotif: NotifAudience;
  postGiftNotif: NotifAudience;
  postGiftReceive: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  enabled: true,
  messages: true,
  calls: true,
  gifts: true,
  visitors: false,
  promotions: true,
  social: true,
  quickFilter: 'all',
  followNotif: 'everyone',
  privateMessage: true,
  privateMessageOutside: true,
  roomJoin: 'everyone',
  likeNotif: 'everyone',
  commentNotif: 'everyone',
  mentionNotif: 'everyone',
  postGiftNotif: 'everyone',
  postGiftReceive: true,
};

export function mergeNotificationSettings(
  raw?: Partial<NotificationSettings> | null,
): NotificationSettings {
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(raw ?? {}) };
}

export async function getNotificationSettings(uid: string): Promise<NotificationSettings> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const data = snap.data()?.notificationSettings as Partial<NotificationSettings> | undefined;
  return mergeNotificationSettings(data);
}

export async function updateNotificationSettings(
  uid: string,
  patch: Partial<NotificationSettings>,
): Promise<void> {
  const current = await getNotificationSettings(uid);
  await updateDoc(doc(firestore, 'users', uid), {
    notificationSettings: { ...current, ...patch },
    updatedAt: Date.now(),
  });
}

export function subscribeNotificationSettings(
  uid: string,
  callback: (settings: NotificationSettings) => void,
): () => void {
  return onSnapshot(
    doc(firestore, 'users', uid),
    (snap) => {
      const data = snap.data()?.notificationSettings as Partial<NotificationSettings> | undefined;
      callback(mergeNotificationSettings(data));
    },
    () => callback({ ...DEFAULT_NOTIFICATION_SETTINGS }),
  );
}
