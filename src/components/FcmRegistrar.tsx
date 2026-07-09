import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { setPushNotificationsEnabled } from '@/services/firebase/pushNotifications';
import { subscribeNotificationSettings } from '@/services/firebase/notificationSettings';

export function FcmRegistrar() {
  const uid = useAuthStore((s) => s.user?.uid);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uid) {
      if (registeredRef.current) {
        setPushNotificationsEnabled(registeredRef.current, false).catch(() => {});
        registeredRef.current = null;
      }
      return;
    }

    registeredRef.current = uid;
    return subscribeNotificationSettings(uid, (settings) => {
      setPushNotificationsEnabled(uid, settings.pushEnabled !== false).catch(() => {});
    });
  }, [uid]);

  return null;
}
