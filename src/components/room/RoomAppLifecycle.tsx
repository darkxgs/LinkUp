/**
 * لا نُخرج المستخدم من الروم عند إرسال التطبيق للخلفية (واتساب، تصفّح، إلخ).
 * الإبقاء على المقعد والصوت: RoomBackgroundKeepAlive + RoomVoiceSessionGuard.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/hooks/useAuth';

export function RoomAppLifecycle() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;
    const sub = AppState.addEventListener('change', () => {});
    return () => sub.remove();
  }, [user?.uid]);

  return null;
}
