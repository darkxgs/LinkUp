/**
 * توجيه المستخدم عند استلام/الضغط على إشعار Push
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  resolveNotificationRoute,
  routeInputFromPushData,
} from '@/utils/notificationRouting';

function normalizeData(raw: Record<string, unknown>): Record<string, string | undefined> {
  const data: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (v != null) data[k] = String(v);
  }
  return data;
}

function navigateFromPush(
  router: ReturnType<typeof useRouter>,
  data: Record<string, string | undefined>,
) {
  const type = data.type ?? data.notifType;

  if (type === 'incoming_call') {
    const q = new URLSearchParams({
      from: data.fromUid ?? data.from ?? '',
      channel: data.channelName ?? data.channel ?? '',
      type: data.callType ?? 'voice',
      fromName: data.fromName ?? '',
      fromAvatar: data.fromAvatar ?? '',
      callId: data.callId ?? '',
    });
    router.push(`/call/incoming?${q.toString()}` as any);
    return;
  }

  const route = resolveNotificationRoute(routeInputFromPushData(data));
  router.push(route as any);
}

export function PushNotificationRouter() {
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledRef.current === id) return;
      handledRef.current = id;

      const raw = response.notification.request.content.data as Record<string, unknown>;
      navigateFromPush(router, normalizeData(raw));
    };

    Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {});

    const tapSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    const receiveSub = Notifications.addNotificationReceivedListener((notification) => {
      const raw = notification.request.content.data as Record<string, unknown>;
      const data = normalizeData(raw);
      if (data.type === 'incoming_call' || data.notifType === 'incoming_call') {
        // التطبيق مفتوح: IncomingCallModal يستمع لـ Firestore مباشرة — تجنّب شاشة مزدوجة
        if (AppState.currentState === 'active') return;
        navigateFromPush(router, data);
      }
    });

    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [router]);

  return null;
}
