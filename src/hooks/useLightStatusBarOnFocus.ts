/**
 * أيقونات شريط الحالة فاتحة أثناء التركيز على شاشة داكنة،
 * وتُعاد داكنة عند مغادرتها (الافتراضي العام في app/_layout هو dark
 * لأن معظم شاشات التطبيق فاتحة الخلفية).
 *
 * نستخدم useFocusEffect بدل <StatusBar> لأن مكوّن expo-status-bar
 * لا يُرجع النمط السابق عند unmount — فيبقى الشريط فاتحاً بعد الرجوع.
 */
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';

export function useLightStatusBarOnFocus(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [enabled]),
  );
}
