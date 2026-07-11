/**
 * حضور مباشر عبر Realtime Database — presence/{uid} (نفس نظام التطبيق)
 */
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';

/** اشتراك في حضور مستخدم واحد — يُستدعى بـ callback(timestamp | null) عند كل تغيير */
export function subscribeToUserPresence(
  uid: string,
  callback: (lastPingAt: number | null) => void,
): () => void {
  if (!uid) return () => {};
  const uidRef = ref(realtimeDb, `presence/${uid}`);
  const handler = (snap: DataSnapshot) => {
    const value = snap.val();
    const n = typeof value === 'number' ? value : Number(value);
    callback(Number.isFinite(n) && n > 0 ? n : null);
  };
  onValue(uidRef, handler);
  return () => off(uidRef, 'value', handler);
}

/** يُعتبر المستخدم متصلاً إذا كان آخر ping خلال آخر 3 دقائق (heartbeat التطبيق كل 2 دقيقة + هامش) */
export const PRESENCE_ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function isPresenceOnline(lastPingAt: number | null): boolean {
  return lastPingAt != null && Date.now() - lastPingAt < PRESENCE_ONLINE_WINDOW_MS;
}
