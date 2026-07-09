/**
 * HostTasksTracker — تتبع وقت الاتصال والتفاعل اليومي للمضيفة
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { trackHostOnlineMinutes } from '@/services/firebase/hostTasks';
import { canEarnHostTasks } from '@/utils/genderAccess';

const TICK_MS = 2 * 60 * 1000;

export function HostTasksTracker() {
  const { user } = useAuth();
  const lastTickRef = useRef(Date.now());
  const isActiveRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    if (!user?.uid || !canEarnHostTasks(user)) return;

    const tick = () => {
      if (!isActiveRef.current) return;
      const now = Date.now();
      const elapsedMin = Math.floor((now - lastTickRef.current) / 60_000);
      lastTickRef.current = now;
      if (elapsedMin >= 1) {
        void trackHostOnlineMinutes(elapsedMin, false);
      }
    };

    lastTickRef.current = Date.now();
    const iv = setInterval(tick, TICK_MS);

    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      if (active && !isActiveRef.current) {
        lastTickRef.current = Date.now();
      } else if (!active && isActiveRef.current) {
        tick();
      }
      isActiveRef.current = active;
    });

    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [user?.uid]);

  return null;
}
