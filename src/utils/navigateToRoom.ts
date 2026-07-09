import { Alert } from 'react-native';
import type { Router } from 'expo-router';

import { auth } from '@/services/firebase';
import {
  fetchRoomForEntry,
  isRoomPasswordVerified,
  markRoomPasswordVerified,
  roomRequiresPassword,
} from '@/services/roomEntryGate';
import { useRoomEntryGateStore } from '@/stores/roomEntryGateStore';
import { enterAgencyLiveRoom } from '@/services/agencyService';

type NavigateRoomOptions = {
  replace?: boolean;
};

function goToRoom(router: Router, roomId: string, options?: NavigateRoomOptions): void {
  const href = `/room/${roomId}` as const;
  if (options?.replace) {
    router.replace(href as any);
    return;
  }
  router.push(href as any);
}

/**
 * يفتح غرفة صوتية — يعرض موديل كلمة المرور قبل الانتقال إن كانت مقفلة.
 */
export async function navigateToRoom(
  router: Router,
  roomId: string,
  options?: NavigateRoomOptions,
): Promise<void> {
  const trimmed = roomId?.trim();
  if (!trimmed) return;

  const room = await fetchRoomForEntry(trimmed);
  if (!room) {
    Alert.alert('تعذّر الدخول', 'الغرفة غير متوفرة أو مغلقة.');
    return;
  }

  const myUid = auth.currentUser?.uid;
  if (!roomRequiresPassword(room, myUid) || isRoomPasswordVerified(trimmed)) {
    goToRoom(router, trimmed, options);
    return;
  }

  const allowed = await useRoomEntryGateStore.getState().prompt(room);
  if (!allowed) return;
  markRoomPasswordVerified(trimmed);
  goToRoom(router, trimmed, options);
}

/** فتح غرفة وكالة — كلمة المرور قبل الدخول */
export async function enterAgencyRoomAndNavigate(
  router: Router,
  agencyId: string,
  options?: NavigateRoomOptions,
): Promise<void> {
  const roomId = await enterAgencyLiveRoom(agencyId);
  await navigateToRoom(router, roomId, options);
}
