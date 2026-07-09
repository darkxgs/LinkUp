/**
 * LinkUp — شاشة البداية (مسار مستقل)
 * 3 ثوانٍ ثابتة + تحميل الأصول ثم التوجيه للتطبيق
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Asset } from 'expo-asset';

import { LinkUpSplashScreen } from '@/components/splash/LinkUpSplashScreen';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import {
  APP_SPLASH_DURATION_MS,
  SPLASH_PRELOAD_ASSETS,
} from '@/constants/brandAssets';
import { useAuth } from '@/hooks/useAuth';
import { resolveUnauthenticatedEntryRoute } from '@/services/onboardingStorage';

export default function SplashRoute() {
  // خلفية السبلاش داكنة (#0A0506) — أيقونات الشريط فاتحة أثناء العرض فقط
  useLightStatusBarOnFocus();
  const router = useRouter();
  const { isAuthenticated, isLoading, user, authReady } = useAuth();
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Asset.loadAsync([...SPLASH_PRELOAD_ASSETS])
      .then(() => {
        if (!cancelled) setAssetsReady(true);
      })
      .catch(() => {
        if (!cancelled) setAssetsReady(true);
      });

    const timer = setTimeout(() => setMinTimeDone(true), APP_SPLASH_DURATION_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!minTimeDone || !assetsReady || isLoading || !authReady) return;

    if (isAuthenticated && user) {
      router.replace('/(tabs)' as any);
      return;
    }

    void (async () => {
      const route = await resolveUnauthenticatedEntryRoute();
      router.replace(route as any);
    })();
  }, [assetsReady, authReady, isAuthenticated, isLoading, minTimeDone, router, user]);

  return <LinkUpSplashScreen />;
}
