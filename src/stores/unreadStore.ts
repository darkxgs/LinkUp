/**
 * إجمالي الرسائل غير المقروءة (حيّ) — لشارة تبويب الدردشة في شريط التنقّل.
 * اشتراك واحد على مستوى التطبيق عبر subscribeToConversations (آمن ضد سباق
 * الإقلاع بعد إصلاح chat.ts) — يتحدّث فور كل snapshot ويصفّر عند تسجيل الخروج.
 */
import { create } from 'zustand';

import { subscribeToConversations } from '@/services/firebase/chat';
import { auth } from '@/services/firebase';

interface UnreadState {
  totalUnread: number;
}

export const useUnreadStore = create<UnreadState>(() => ({ totalUnread: 0 }));

let started = false;

/** يبدأ التتبّع مرة واحدة لكل عمر التطبيق — يُستدعى من شريط التبويبات */
export function startUnreadTracking(): void {
  if (started) return;
  started = true;
  // العدّ فقط يحتاج unreadBy الموجود على المستند الخام — نمرّر enrich:false
  // لتخطّي جلب مستندات الأطراف (كان ~50 قراءة getDoc على كل لقطة، طوال عمر التطبيق).
  subscribeToConversations((convs) => {
    const uid = auth.currentUser?.uid;
    const totalUnread = uid
      ? convs.reduce((sum, c) => sum + (c.unreadBy?.[uid] ?? 0), 0)
      : 0;
    useUnreadStore.setState({ totalUnread });
  }, { enrich: false });
}
