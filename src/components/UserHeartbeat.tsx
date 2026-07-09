/**
 * UserHeartbeat — يحدّث users/{uid}.lastSeen كل دقيقتين
 *
 * مهم للـ Analytics: يقيس DAU/WAU/MAU بشكل صحيح،
 * ويسمح للأدمن أن يعرف من نشط الآن.
 *
 * Mount مرّة واحدة في _layout.
 */

import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { AppState } from 'react-native';
import { firestore } from '@/services/firebase/index';
import { pingUserPresence } from '@/services/firebase/presence';
import { useAuth } from '@/hooks/useAuth';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // كل دقيقتين

export function UserHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    const ping = async () => {
      const ts = Date.now();
      try {
        await Promise.all([
          updateDoc(doc(firestore, 'users', user.uid), { lastSeen: ts }),
          pingUserPresence(user.uid),
        ]);
      } catch {
        try {
          await pingUserPresence(user.uid);
        } catch {
          // فشل صامت
        }
      }
    };

    // ⚡ jitter عشوائي (0–5ث) لتفادي موجة كتابة متزامنة عند إقلاع/استئناف 900 جهاز معاً
    let mounted = true;
    const pingJittered = () => {
      const delay = Math.floor(Math.random() * 5000);
      setTimeout(() => {
        if (mounted) void ping();
      }, delay);
    };

    // ping أول (مؤجّل بـ jitter) ثم دوري
    pingJittered();
    const iv = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    // ping عند رجوع التطبيق من الخلفية (مؤجّل بـ jitter أيضاً)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pingJittered();
    });

    return () => {
      mounted = false;
      clearInterval(iv);
      sub.remove();
    };
  }, [user?.uid]);

  return null;
}
