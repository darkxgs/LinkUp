/**
 * LocationUpdater — يطلب إذن الموقع عند فتح التطبيق (إن لم يُمنح)
 * ويحدّث Firestore فوراً — خارج DeferredMount لبدء أسرع.
 */

import { useEffect } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  bootstrapUserLocation,
  ensureUserLocationSynced,
} from '@/services/locationService';

const STARTUP_DELAY_MS = Platform.OS === 'web' ? 0 : 900;

export function LocationUpdater() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid || Platform.OS === 'web') return;

    let cancelled = false;

    const sync = async (force: boolean) => {
      if (cancelled) return;
      if (force) {
        await bootstrapUserLocation();
      } else {
        await ensureUserLocationSynced(false);
      }
    };

    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    const handle = InteractionManager.runAfterInteractions(() => {
      startupTimer = setTimeout(() => {
        void sync(true);
      }, STARTUP_DELAY_MS);
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync(false);
    });

    return () => {
      cancelled = true;
      handle.cancel?.();
      if (startupTimer) clearTimeout(startupTimer);
      sub.remove();
    };
  }, [user?.uid]);

  return null;
}
