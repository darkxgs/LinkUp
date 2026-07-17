/**
 * هل توجد إشعارات غير مقروءة؟ — مصدر واحد مشترَك لنقطة جرس الرئيسية الحمراء.
 * (كانت النقطة hardcoded دائماً؛ الآن مربوطة بـisRead الحيّ فتختفي فور قراءة الكل.)
 * مستمع onSnapshot واحد يُشارَك بين كل الطالبين مهما تعدّدت شاشات الرئيسية.
 */
import { useEffect, useState } from 'react';
import { subscribeToNotifications } from '@/services/firebase/notifications';

let hasUnread = false;
let started = false;
let teardown: (() => void) | null = null;
const listeners = new Set<(v: boolean) => void>();

function ensureStarted(): void {
  if (started) return;
  started = true;
  teardown = subscribeToNotifications((items) => {
    const next = items.some((n) => !n.isRead);
    if (next === hasUnread) return;
    hasUnread = next;
    for (const l of listeners) l(hasUnread);
  });
}

export function useHasUnreadNotifications(): boolean {
  const [value, setValue] = useState(hasUnread);

  useEffect(() => {
    listeners.add(setValue);
    ensureStarted();
    setValue(hasUnread);
    return () => {
      listeners.delete(setValue);
      if (listeners.size === 0) {
        teardown?.();
        teardown = null;
        started = false;
        hasUnread = false;
      }
    };
  }, []);

  return value;
}
