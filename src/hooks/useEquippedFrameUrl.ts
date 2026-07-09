import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { subscribeToRoomFrames, type RoomFrame } from '@/services/firebase/roomDecor';
import { getEquippedFrameUrlFromUserData } from '@/services/firebase/userFrames';
import { useConfig } from '@/contexts/ConfigContext';

/** إطار الملف الشخصي المفعّل لمستخدم — يتحدّث حياً ويتجاهل المنتهي */
export function useEquippedFrameUrl(uid?: string | null): string | undefined {
  const [catalog, setCatalog] = useState<RoomFrame[]>([]);
  const [frameUrl, setFrameUrl] = useState<string | undefined>();
  const { vipSystem } = useConfig();

  useEffect(() => {
    const unsub = subscribeToRoomFrames(setCatalog);
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setFrameUrl(undefined);
      return;
    }
    const ref = doc(firestore, 'users', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setFrameUrl(undefined);
          return;
        }
        setFrameUrl(getEquippedFrameUrlFromUserData(
          snap.data() as Record<string, unknown>,
          catalog,
          Date.now(),
          vipSystem?.privileges,
          vipSystem || undefined
        ));
      },
      () => setFrameUrl(undefined),
    );
  }, [uid, catalog, vipSystem?.privileges]);

  return frameUrl;
}
