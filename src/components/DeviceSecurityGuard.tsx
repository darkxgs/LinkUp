/**
 * DeviceSecurityGuard — يخرج المستخدم فوراً إذا أُزيل هذا الجهاز من الحساب
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/useAuth';
import { firestore } from '@/services/firebase';
import { isCurrentDeviceRevoked } from '@/services/accountSecurity';

export function DeviceSecurityGuard() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;

    const kickIfRevoked = async () => {
      if (signingOutRef.current) return;
      try {
        const revoked = await isCurrentDeviceRevoked(user.uid);
        if (!revoked) return;
        signingOutRef.current = true;
        Alert.alert(
          t('accountSecurity.deviceRevokedTitle'),
          t('accountSecurity.deviceRevokedBody'),
          [{ text: t('common.ok'), onPress: () => void signOut() }],
          { cancelable: false },
        );
        await signOut();
      } catch {
        // ignore
      }
    };

    void kickIfRevoked();
    const unsub = onSnapshot(doc(firestore, 'users', user.uid), () => {
      void kickIfRevoked();
    });
    const iv = setInterval(() => void kickIfRevoked(), 60_000);

    return () => {
      unsub();
      clearInterval(iv);
      signingOutRef.current = false;
    };
  }, [user?.uid, signOut, t]);

  return null;
}
