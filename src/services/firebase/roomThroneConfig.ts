/**
 * إعدادات العرش — config/roomThrone (لوحة التحكم)
 */
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from './index';
import { isAgencyLiveRoom, type Room } from './rooms';
import { isAgencyThroneUnlockedByLevel, AGENCY_THRONE_UNLOCK_LEVEL } from '@/services/agencyLevels';

export { AGENCY_THRONE_UNLOCK_LEVEL };

export interface RoomThroneConfig {
  enabled: boolean;
  minGiftCoins: number;
  titleAr: string;
  titleEn: string;
  hintAr: string;
  hintEn: string;
}

export const DEFAULT_ROOM_THRONE_CONFIG: RoomThroneConfig = {
  enabled: true,
  minGiftCoins: 2000,
  titleAr: 'العرش ينتظر',
  titleEn: 'The Throne Awaits',
  hintAr: 'تولّى مقعد العرش إذا تجاوزت قيمة هداياك المرسلة {{coins}} كوين',
  hintEn: 'Take the throne if your sent gifts exceed {{coins}} coins',
};

/** العرش يظهر فقط في غرف الوكالة عندما يصل مستوى الوكالة 15+ ويفعّله صاحب الوكالة */
export function isAgencyRoomThroneActive(
  room: Pick<Room, 'isAgencyRoom' | 'agencyId' | 'throneEnabled' | 'agencyPeriodLevel'> | null | undefined,
  globalConfig: RoomThroneConfig,
): boolean {
  if (!globalConfig.enabled) return false;
  if (!isAgencyLiveRoom(room)) return false;
  if (!isAgencyThroneUnlockedByLevel(room?.agencyPeriodLevel)) return false;
  return room?.throneEnabled === true;
}

export function isAgencyRoomThroneUnlocked(
  room: Pick<Room, 'isAgencyRoom' | 'agencyId' | 'agencyPeriodLevel'> | null | undefined,
  globalConfig: RoomThroneConfig,
): boolean {
  if (!globalConfig.enabled) return false;
  if (!isAgencyLiveRoom(room)) return false;
  return isAgencyThroneUnlockedByLevel(room?.agencyPeriodLevel);
}

export function subscribeToRoomThroneConfig(
  callback: (config: RoomThroneConfig) => void,
): () => void {
  const ref = doc(firestore, 'config', 'roomThrone');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_ROOM_THRONE_CONFIG);
        return;
      }
      const d = snap.data();
      callback({
        enabled: d.enabled !== false,
        minGiftCoins: Number(d.minGiftCoins) || DEFAULT_ROOM_THRONE_CONFIG.minGiftCoins,
        titleAr: d.titleAr ?? DEFAULT_ROOM_THRONE_CONFIG.titleAr,
        titleEn: d.titleEn ?? DEFAULT_ROOM_THRONE_CONFIG.titleEn,
        hintAr: d.hintAr ?? DEFAULT_ROOM_THRONE_CONFIG.hintAr,
        hintEn: d.hintEn ?? DEFAULT_ROOM_THRONE_CONFIG.hintEn,
      });
    },
    () => callback(DEFAULT_ROOM_THRONE_CONFIG),
  );
}

export async function getRoomThroneConfig(): Promise<RoomThroneConfig> {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'roomThrone'));
    if (!snap.exists()) return DEFAULT_ROOM_THRONE_CONFIG;
    const d = snap.data();
    return {
      enabled: d.enabled !== false,
      minGiftCoins: Number(d.minGiftCoins) || DEFAULT_ROOM_THRONE_CONFIG.minGiftCoins,
      titleAr: d.titleAr ?? DEFAULT_ROOM_THRONE_CONFIG.titleAr,
      titleEn: d.titleEn ?? DEFAULT_ROOM_THRONE_CONFIG.titleEn,
      hintAr: d.hintAr ?? DEFAULT_ROOM_THRONE_CONFIG.hintAr,
      hintEn: d.hintEn ?? DEFAULT_ROOM_THRONE_CONFIG.hintEn,
    };
  } catch {
    return DEFAULT_ROOM_THRONE_CONFIG;
  }
}
