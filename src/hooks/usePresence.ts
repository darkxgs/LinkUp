/**
 * اشتراك مباشر في presence/* من Realtime Database
 */

import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToPresenceMap,
  subscribeToPresenceForUids,
  type PresenceMap,
} from '@/services/firebase/presence';
import { ONLINE_THRESHOLD_MS } from '@/utils/presence';

export function usePresenceMap() {
  const [map, setMap] = useState<PresenceMap>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = subscribeToPresenceMap(setMap);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, []);

  return { presenceMap: map, now };
}

/**
 * حضور مجموعة uids محدّدة فقط — بديل قابل للتوسّع لـ usePresenceMap للعرض على الشاشة.
 * يشترك فقط في حضور الـuids المعروضة بدل شجرة presence/ كاملة.
 */
export function usePresenceForUids(uids: string[]) {
  const [map, setMap] = useState<PresenceMap>({});
  const [now, setNow] = useState(Date.now());

  // مفتاح ثابت مرتّب يمنع إعادة الاشتراك ما لم تتغيّر المجموعة فعلاً
  const key = useMemo(
    () => Array.from(new Set(uids.filter(Boolean))).sort().join(','),
    [uids],
  );

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (!list.length) {
      setMap({});
      return;
    }
    const unsub = subscribeToPresenceForUids(list, setMap);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [key]);

  return { presenceMap: map, now };
}

export { ONLINE_THRESHOLD_MS };
