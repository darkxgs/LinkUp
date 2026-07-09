/**
 * Broadcasts Service — استماع للإشعارات الجماعية من الأدمن
 *
 * عند إرسال الأدمن لإشعار جماعي:
 *  - الأدمن يكتب وثيقة في broadcasts (جذر)
 *  - التطبيق يستمع لها ويعرض banner / toast / modal
 *
 * البنية في Firestore:
 *   broadcasts/{id} → { title, body, type, target, sentCount, sentAt }
 */

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { firestore } from './firebase/index';

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'promo' | 'reward' | 'warning';
  target: 'all' | 'vip' | 'active';
  sentCount: number;
  sentAt: number;
}

/**
 * الاستماع لآخر إشعار جماعي (يستخدمها BroadcastBanner)
 */
export const subscribeToLatestBroadcast = (
  callback: (broadcast: Broadcast | null) => void,
): (() => void) => {
  const q = query(
    collection(firestore, 'broadcasts'),
    orderBy('sentAt', 'desc'),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const d = snap.docs[0];
      if (!d) { callback(null); return; }
      const data = d.data();
      callback({
        id: d.id,
        title: data.title ?? '',
        body: data.body ?? '',
        type: data.type ?? 'info',
        target: data.target ?? 'all',
        sentCount: data.sentCount ?? 0,
        sentAt: data.sentAt ?? Date.now(),
      });
    },
    () => callback(null),
  );
};

/**
 * الاستماع لكل البثوث الأخيرة (لشاشة الإشعارات)
 */
export const subscribeToBroadcasts = (
  callback: (broadcasts: Broadcast[]) => void,
  max = 20,
): (() => void) => {
  const q = query(
    collection(firestore, 'broadcasts'),
    orderBy('sentAt', 'desc'),
    limit(max),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: Broadcast[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? '',
          body: data.body ?? '',
          type: data.type ?? 'info',
          target: data.target ?? 'all',
          sentCount: data.sentCount ?? 0,
          sentAt: data.sentAt ?? Date.now(),
        };
      });
      callback(items);
    },
    () => callback([]),
  );
};
