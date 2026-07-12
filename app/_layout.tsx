/**
 * LinkUp App — Root Layout
 * متوافق مع Expo Go — لا يحتاج prebuild
 * يحمّل خطوط Cairo من Google Fonts
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import {
  useFonts,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo';
import {
  BalooBhaijaan2_600SemiBold,
  BalooBhaijaan2_700Bold,
  BalooBhaijaan2_800ExtraBold,
} from '@expo-google-fonts/baloo-bhaijaan-2';
// ملاحظة: خطوط Tajawal و Baloo 500Medium أُزيلت من الإقلاع لأنها غير مستخدمة في
// أي عرض فعلي — تحميلها كان يؤخّر بدء التطبيق بلا فائدة (قابلة للإعادة عند الحاجة).

import { initI18n } from '@/localization/i18n';
import i18n from '@/localization/i18n';
import { verifyFirebaseConnection, isFirebaseReady } from '@/services/firebase';
import { useAuthStore } from '@/stores/authStore';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AlertProvider } from '@/components/ui';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { OutgoingChallengeGate } from '@/components/OutgoingChallengeGate';
import { BroadcastBanner } from '@/components/BroadcastBanner';
import { AccountModerationGate } from '@/components/AccountModerationGate';
import { GiftReceivedOverlay } from '@/components/post/GiftReceivedOverlay';
import { AppUpdateGate } from '@/components/AppUpdateGate';
import { UserHeartbeat } from '@/components/UserHeartbeat';
import { DeviceSecurityGuard } from '@/components/DeviceSecurityGuard';
import { HostTasksTracker } from '@/components/HostTasksTracker';
import { FcmRegistrar } from '@/components/FcmRegistrar';
import { AppPermissionsPrompt } from '@/components/permissions/AppPermissionsPrompt';
import { PushNotificationRouter } from '@/components/PushNotificationRouter';
import { RoomFloatingOverlay } from '@/components/room/RoomFloatingOverlay';
import { LazyCallFloatingOverlay } from '@/components/call/LazyCallFloatingOverlay';
import { RoomAudioHost } from '@/components/room/RoomAudioHost';
import { RoomAppLifecycle } from '@/components/room/RoomAppLifecycle';
import { RoomSessionHost } from '@/components/room/RoomSessionHost';
import { RoomPasswordGateHost } from '@/components/room/RoomPasswordGateHost';
import { RoomPinnedBackgroundHost } from '@/components/room/RoomPinnedBackgroundHost';
import { RoomPinnedMediaHost } from '@/components/room/RoomPinnedMediaHost';
import { RoomBackgroundKeepAlive } from '@/components/room/RoomBackgroundKeepAlive';
import { LazyRoomMusicOverlay } from '@/components/room/LazyRoomMusicOverlay';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { DeferredMount } from '@/components/DeferredMount';
import { LocationUpdater } from '@/components/LocationUpdater';
import { NetworkMonitor } from '@/components/NetworkMonitor';
import { OfflineBanner } from '@/components/OfflineBanner';
// لا حاجة لاستدعاء RTL هنا — initI18n() يطبّق الاتجاه حسب اللغة المحفوظة

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  // تحميل خطوط هوية LinkUp (مطابقة للتصميم الجديد)
  //  - Cairo: الخط الأساسي للنصوص العربية (6 أوزان)
  //  - Baloo Bhaijaan 2: خط العرض للعناوين الكبيرة والأرقام والشعار
  const [fontsLoaded] = useFonts({
    // Cairo — نصوص الواجهة
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
    // Baloo Bhaijaan 2 — Display (شعار LinkUp، الأرقام الكبيرة، العناوين البطولية)
    BalooBhaijaan2_600SemiBold,
    BalooBhaijaan2_700Bold,
    BalooBhaijaan2_800ExtraBold,
  });

  useEffect(() => {
    const init = async () => {
      try {
        // initI18n يقرأ اللغة المحفوظة ويطبّق RTL/LTR تلقائياً (يجب أن يسبق كل شيء)
        await initI18n();

        // ⚡ تهيئة auth + فحص اتصال Firebase بالتوازي بدل التسلسل (إقلاع أسرع)
        //    فحص الاتصال مجرّد probe شبكي ولا يجب أن يحجب تهيئة الحساب.
        const [, fbOk] = await Promise.all([
          initialize(),
          verifyFirebaseConnection().catch(() => false),
        ]);
        console.log('Firebase ready:', fbOk, '| configured:', isFirebaseReady());
      } catch (e) {
        console.error('Initialization failed:', e);
      }
    };
    init();
  }, [initialize]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* حاجز الأخطاء العام — أي خطأ render كان يترك شاشة بيضاء ميتة؛
          الآن شاشة عربية ودّية مع «إعادة المحاولة» + تسجيل العطل */}
      <AppErrorBoundary>
      <SafeAreaProvider>
          <I18nextProvider i18n={i18n}>
            <ConfigProvider>
            <AlertProvider>
            <DeepLinkHandler />
            <NetworkMonitor />
            {/* معظم شاشات التطبيق فاتحة — أيقونات داكنة افتراضياً؛
                الشاشات الداكنة (سبلاش/روم/مكالمات) تستخدم useLightStatusBarOnFocus */}
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 200, // سريع
                freezeOnBlur: true, // تجميد الشاشات غير الفعالة
              }}
            >
              <Stack.Screen name="index" options={{ animation: 'none' }} />
              <Stack.Screen name="splash" options={{ animation: 'none' }} />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[userId]" />
              <Stack.Screen name="room/[id]" />
              <Stack.Screen name="room/create" />
              <Stack.Screen name="room/edit" />
              <Stack.Screen name="room/customize" />
              <Stack.Screen name="call/[id]" />
              <Stack.Screen name="call/video/[id]" />
              <Stack.Screen name="call/incoming" />
              <Stack.Screen name="match/[type]" />
              <Stack.Screen name="post/create" />
              <Stack.Screen name="post/[id]" />
              <Stack.Screen name="profile/[userId]" />
              <Stack.Screen name="profile/edit" />
              <Stack.Screen name="profile/me" />
              <Stack.Screen name="profile/gift-wall" />
              <Stack.Screen name="profile/list" />
              <Stack.Screen name="settings/privacy" />
              <Stack.Screen name="settings/notifications" />
              <Stack.Screen name="wallet/index" />
              <Stack.Screen name="wallet/recharge" />
              <Stack.Screen name="wallet/coins-history" />
              <Stack.Screen name="wallet/recharge-problem" />
              <Stack.Screen name="wallet/withdraw" />
              <Stack.Screen name="wallet/transfer" />
              <Stack.Screen name="wallet/exchange" />
              <Stack.Screen name="wallet/pearl-wallet" />
              <Stack.Screen name="wallet/pearl-log" />
              <Stack.Screen name="agency/hub" />
              <Stack.Screen name="agency/join" />
              <Stack.Screen name="agency/search" />
              <Stack.Screen name="agency/center" />
              <Stack.Screen name="agency/prince" />
              <Stack.Screen name="agency/apply" />
              <Stack.Screen name="agency/confirm-host" />
              <Stack.Screen name="agency/invite" />
              <Stack.Screen name="agency/members" />
              <Stack.Screen name="agency/collect" />
              <Stack.Screen name="agency/my-invites" />
              <Stack.Screen name="agency/bd-center" />
              <Stack.Screen name="agency/host-chart" />
              <Stack.Screen name="agency/host-completions" />
              <Stack.Screen name="agency/refunds" />
              <Stack.Screen name="agency/host-balances" />
              <Stack.Screen name="agency/host-stats" />
              <Stack.Screen name="rooms/my-rooms" />
              <Stack.Screen name="wallet/kyc" />
              <Stack.Screen name="gifts/index" />
              <Stack.Screen name="gifts/[id]" />
              <Stack.Screen name="store/index" />
              <Stack.Screen name="store/inventory" />
              <Stack.Screen name="vip/index" />
              <Stack.Screen name="vip/rules" />
              <Stack.Screen name="vip/aristocracy" />
              <Stack.Screen name="vip/aristocracy-rules" />
              <Stack.Screen name="vip/aristocracy-my" />
              <Stack.Screen name="games/index" />
              <Stack.Screen name="games/casino" />
              <Stack.Screen name="games/intelligence" />
              <Stack.Screen name="games/challenges/index" />
              <Stack.Screen name="games/challenges/active" />
              <Stack.Screen name="games/penalty-kicks" />
              <Stack.Screen name="games/webview" />
              <Stack.Screen name="visitors/index" />
              <Stack.Screen name="lottery/index" />
              <Stack.Screen name="search/index" />
              <Stack.Screen name="leaderboards/index" />
              <Stack.Screen name="relationships/index" />
              <Stack.Screen name="agencies/index" />
              <Stack.Screen name="blocked/index" />
              <Stack.Screen name="report/index" />
              <Stack.Screen name="report/my" />
              <Stack.Screen name="report/[id]" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="support/index" />
              <Stack.Screen name="settings/index" />
              <Stack.Screen name="settings/security" />
              <Stack.Screen name="settings/password" />
              <Stack.Screen name="settings/phone" />
              <Stack.Screen name="settings/devices" />
              <Stack.Screen name="about/index" />
              <Stack.Screen name="about/[id]" />
              <Stack.Screen name="wealth-level" />
              <Stack.Screen name="titles/index" />
              <Stack.Screen name="titles/about" />
              <Stack.Screen name="rewards/index" />
            </Stack>
            {/* === حرجة عند البدء: المكالمات + الروم النشط + التوجيه === */}
            {/* مودال المكالمة الواردة — يظهر فوق كل الشاشات */}
            <IncomingCallModal />
            <AppPermissionsPrompt />
            <LocationUpdater />
            {/* دعوات التحدي تصل كرسالة داخل المحادثة (بدون شاشة مكالمة) */}
            <OutgoingChallengeGate />
            <PushNotificationRouter />
            <RoomAudioHost />
            <RoomPinnedBackgroundHost />
            <RoomPinnedMediaHost />
            <RoomBackgroundKeepAlive />
            <RoomAppLifecycle />
            <RoomSessionHost />
            <RoomPasswordGateHost />

            {/* === مؤجّلة: خلفية/تحليلات/بانرات/حُرّاس — لا تحجب أول إطار === */}
            {/* تُركّب بعد ظهور أول شاشة فيصبح التطبيق قابلاً للتصفّح فوراً */}
            <DeferredMount>
              {/* Banner للإشعارات الجماعية من الأدمن */}
              <BroadcastBanner />
              <AccountModerationGate />
              <AppUpdateGate />
              {/* تحديث lastSeen للـ Analytics */}
              <UserHeartbeat />
              <DeviceSecurityGuard />
              <HostTasksTracker />
              {/* تسجيل FCM token عند تسجيل الدخول */}
              <FcmRegistrar />
            </DeferredMount>
            {/* الفقاعة العائمة للروم — داخل AlertProvider لتشارك نفس native View
                الأب مع Stack. على أندرويد elevation: 30 + renderToHardwareTextureAndroid
                تضمن الظهور فوق react-native-screens على الأجهزة الحقيقية. */}
            <RoomFloatingOverlay />
            <LazyRoomMusicOverlay />
            <LazyCallFloatingOverlay />
            <OfflineBanner />
            {/* بانر لحظي لصاحب المنشور عند وصول هدية على منشوره */}
            <GiftReceivedOverlay />
            </AlertProvider>
            </ConfigProvider>
          </I18nextProvider>
      </SafeAreaProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
