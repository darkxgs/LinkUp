/**
 * DeviceSecurityGuard — يخرج المستخدم فوراً إذا أُزيل هذا الجهاز من الحساب
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/useAuth';
import { firestore } from '@/services/firebase';
import { getOrCreateDeviceId } from '@/services/accountSecurity';

export function DeviceSecurityGuard() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const signingOutRef = useRef(false);
  // معرّف هذا الجهاز يُجلب مرة واحدة ويُخزَّن هنا (لا إعادة جلب مع كل لقطة)
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    // آخر قائمة إزالة وصلت من اللقطة الحيّة — بلا getDoc إضافي
    let latestRevoked: string[] = [];

    const kickIfRevoked = () => {
      if (signingOutRef.current) return;
      const deviceId = deviceIdRef.current;
      if (!deviceId || !latestRevoked.includes(deviceId)) return;
      signingOutRef.current = true;
      Alert.alert(
        t('accountSecurity.deviceRevokedTitle'),
        t('accountSecurity.deviceRevokedBody'),
        [{ text: t('common.ok'), onPress: () => void signOut() }],
        { cancelable: false },
      );
      void signOut();
    };

    // جلب معرّف الجهاز مرة واحدة فقط ثم إعادة الفحص (يعالج سباق أول لقطة)
    if (!deviceIdRef.current) {
      void getOrCreateDeviceId()
        .then((id) => {
          if (cancelled) return;
          deviceIdRef.current = id;
          kickIfRevoked();
        })
        .catch(() => {
          // تجاهل — بلا معرّف جهاز لن نطرد أحداً
        });
    }

    // الاشتراك يوصّل الإزالة لحظياً — نقرأ revokedDeviceIds من نفس اللقطة المُسلَّمة
    const unsub = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
      latestRevoked = (snap.data()?.revokedDeviceIds as string[]) ?? [];
      kickIfRevoked();
    });

    return () => {
      cancelled = true;
      unsub();
      signingOutRef.current = false;
    };
  }, [user?.uid, signOut, t]);

  return null;
}
