/**
 * Room Effects — إعدادات المؤثرات (شخصية + إعدادات الغرفة)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set, onValue, off, get } from 'firebase/database';
import { realtimeDb } from './firebase/index';

const PERSONAL_PREFS_KEY = '@linkup:room_effects_personal';

export interface RoomEffectsSettings {
  soundEffects: boolean;
  animations: boolean;
  updatedAt: number;
  updatedBy?: string;
}

export interface PersonalEffectsPrefs {
  animatedGifts: boolean;
  animatedEntries: boolean;
  ambientSoundEffects: boolean;
}

export const DEFAULT_ROOM_EFFECTS: RoomEffectsSettings = {
  soundEffects: true,
  animations: true,
  updatedAt: Date.now(),
};

export const DEFAULT_PERSONAL_EFFECTS: PersonalEffectsPrefs = {
  animatedGifts: true,
  animatedEntries: true,
  ambientSoundEffects: true,
};

export function subscribeToRoomEffectsSettings(
  roomId: string,
  callback: (settings: RoomEffectsSettings) => void,
): () => void {
  const settingsRef = ref(realtimeDb, `rooms/${roomId}/effectsSettings`);
  const handler = onValue(settingsRef, (snap) => {
    if (!snap.exists()) {
      callback(DEFAULT_ROOM_EFFECTS);
      return;
    }
    const raw = snap.val();
    callback({
      soundEffects: raw.soundEffects !== false,
      animations: raw.animations !== false,
      updatedAt: Number(raw.updatedAt) || Date.now(),
      updatedBy: raw.updatedBy,
    });
  });
  return () => off(settingsRef, 'value', handler);
}

export async function updateRoomEffectsSettings(
  roomId: string,
  patch: Partial<Pick<RoomEffectsSettings, 'soundEffects' | 'animations'>>,
  updatedBy: string,
): Promise<void> {
  const settingsRef = ref(realtimeDb, `rooms/${roomId}/effectsSettings`);
  const snap = await get(settingsRef);
  const current = snap.exists()
    ? {
        soundEffects: snap.val().soundEffects !== false,
        animations: snap.val().animations !== false,
        updatedAt: Number(snap.val().updatedAt) || Date.now(),
      }
    : DEFAULT_ROOM_EFFECTS;

  await set(settingsRef, {
    ...current,
    ...patch,
    updatedAt: Date.now(),
    updatedBy,
  });
}

export async function loadPersonalEffectsPrefs(): Promise<PersonalEffectsPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_PREFS_KEY);
    if (!raw) return DEFAULT_PERSONAL_EFFECTS;
    const parsed = JSON.parse(raw) as Partial<PersonalEffectsPrefs>;
    return {
      animatedGifts: parsed.animatedGifts !== false,
      animatedEntries: parsed.animatedEntries !== false,
      ambientSoundEffects: parsed.ambientSoundEffects !== false,
    };
  } catch {
    return DEFAULT_PERSONAL_EFFECTS;
  }
}

export async function savePersonalEffectsPrefs(prefs: PersonalEffectsPrefs): Promise<void> {
  await AsyncStorage.setItem(PERSONAL_PREFS_KEY, JSON.stringify(prefs));
}

export function shouldPlayGiftAnimation(
  room: RoomEffectsSettings,
  personal: PersonalEffectsPrefs,
): boolean {
  return room.animations && personal.animatedGifts;
}

export function shouldPlayEntryAnimation(
  room: RoomEffectsSettings,
  personal: PersonalEffectsPrefs,
): boolean {
  return room.animations && personal.animatedEntries;
}

export function shouldPlayRoomSoundEffects(
  room: RoomEffectsSettings,
  personal: PersonalEffectsPrefs,
): boolean {
  return room.soundEffects && personal.ambientSoundEffects;
}
