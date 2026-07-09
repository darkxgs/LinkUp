/**
 * رسائل طائرة في الغرفة (امتياز SVIP «رسائل طائرة») — RTDB
 * المسار: rooms/{roomId}/flyingMessages/{pushId}
 */
import { ref, push, set, onChildAdded, query, limitToLast, off, get } from 'firebase/database';
import { realtimeDb, auth } from './index';

async function assertUserCanSendFlyingMessage(roomId: string, uid: string): Promise<void> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/chatMutedUsers/${uid}`));
  if (snap.exists()) {
    throw new Error('تم إيقاف الكتابة والتعليقات لك في هذه الغرفة');
  }
}

export interface FlyingMessage {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  text: string;
  createdAt: number;
}

/** إرسال رسالة طائرة (يُفترض أن المُرسِل يملك الامتياز — الفحص في طبقة الاستدعاء) */
export async function sendFlyingMessage(
  roomId: string,
  text: string,
  sender: { name: string; avatar?: string },
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !roomId) return;
  await assertUserCanSendFlyingMessage(roomId, user.uid);
  const clean = text.trim().slice(0, 120);
  if (!clean) return;
  const node = push(ref(realtimeDb, `rooms/${roomId}/flyingMessages`));
  await set(node, {
    uid: user.uid,
    name: sender.name || 'SVIP',
    avatar: sender.avatar || '',
    text: clean,
    createdAt: Date.now(),
  });
}

/** الاشتراك بالرسائل الطائرة الجديدة فقط (بعد لحظة الاشتراك) */
export function subscribeFlyingMessages(
  roomId: string,
  onMessage: (msg: FlyingMessage) => void,
): () => void {
  const q = query(ref(realtimeDb, `rooms/${roomId}/flyingMessages`), limitToLast(1));
  const startedAt = Date.now();
  const handler = onChildAdded(q, (snap) => {
    const v = snap.val() as Omit<FlyingMessage, 'id'> | null;
    if (!v) return;
    // تجاهل القديمة قبل لحظة الاشتراك (تجنّب إعادة التشغيل عند الدخول)
    if (typeof v.createdAt === 'number' && v.createdAt < startedAt - 2000) return;
    onMessage({ id: snap.key ?? String(v.createdAt), ...v });
  });
  return () => off(q, 'child_added', handler);
}
